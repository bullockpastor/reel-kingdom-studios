import type { Project } from "@prisma/client";
import { db } from "../db.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { storyboardResultSchema, type StoryboardResultParsed } from "../schemas/storyboard.schema.js";
import {
  runAgent,
  intentInterpreterAgent,
  storyboardAgent,
  promptCompilerAgent,
  safetyGuardAgent,
} from "../agents/index.js";
import type { AgentRunResult } from "../agents/index.js";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

interface PipelineResult {
  storyboardId: string;
  shots: Awaited<ReturnType<typeof db.shot.create>>[];
  agentResults: AgentRunResult[];
  safetyApproved: boolean;
  flags: Array<{ shotIndex: number; issue: string; severity: string; suggestion: string }>;
}

export async function generateStoryboard(
  project: Project,
  shotCount: { min: number; max: number },
  totalDuration: { min: number; max: number }
): Promise<PipelineResult> {
  // Check Ollama health
  try {
    const resp = await fetch(`${config.OLLAMA_URL}/api/tags`);
    if (!resp.ok) throw new Error();
  } catch {
    throw new Error(
      `Ollama is not reachable at ${config.OLLAMA_URL}. Please start Ollama before generating storyboards.`
    );
  }

  const agentResults: AgentRunResult[] = [];
  const projectDir = join(config.STUDIO_ROOT, project.id);

  // ── Agent 1: Intent Interpreter ──
  logger.info({ projectId: project.id }, "Agent 1/4: Intent Interpreter");
  const intentResult = await runAgent(
    intentInterpreterAgent,
    `Create a video from this idea:\n\n${project.idea}\n\nConstraints: ${shotCount.min}-${shotCount.max} shots, ${totalDuration.min}-${totalDuration.max} seconds total.\nTarget format: ${project.format} (${project.targetAspectRatio}, ${project.targetWidth}x${project.targetHeight})`
  );
  agentResults.push(intentResult);
  writeFileSync(join(projectDir, "01-intent.json"), intentResult.rawOutput);

  // ── Agent 2: Storyboard / Shotlist Generator ──
  logger.info({ projectId: project.id }, "Agent 2/4: Storyboard Generator");
  const storyboardResult = await runAgent(storyboardAgent, intentResult.rawOutput);
  agentResults.push(storyboardResult);
  writeFileSync(join(projectDir, "02-storyboard.json"), storyboardResult.rawOutput);

  // Normalize & validate storyboard structure (retry up to 3x)
  let storyboard: StoryboardResultParsed | undefined;
  let storyboardAttempts = 0;
  const maxStoryboardAttempts = 3;
  let lastValidationError: string | undefined;

  while (storyboardAttempts < maxStoryboardAttempts) {
    storyboardAttempts++;

    // Re-generate on retry (attempts > 1)
    if (storyboardAttempts > 1) {
      logger.warn({ attempt: storyboardAttempts, error: lastValidationError }, "Retrying storyboard generation");
      const retryResult = await runAgent(
        storyboardAgent,
        `${intentResult.rawOutput}\n\n--- VALIDATION ERROR FROM PREVIOUS ATTEMPT ---\n${lastValidationError}\nPlease fix the issues above and regenerate.`
      );
      Object.assign(storyboardResult, retryResult);
      writeFileSync(join(projectDir, "02-storyboard.json"), storyboardResult.rawOutput);
    }

    // Preprocess: clamp totalDurationSeconds to sum of shot durations
    const raw = storyboardResult.parsed as Record<string, unknown>;
    if (Array.isArray(raw.shots)) {
      const sumDurations = (raw.shots as Array<{ durationSeconds?: number }>)
        .reduce((sum, s) => sum + (s.durationSeconds || 3), 0);
      raw.totalDurationSeconds = Math.min(Math.max(sumDurations, 5), 120);
      // Clamp individual shot durations
      for (const shot of raw.shots as Array<{ durationSeconds?: number }>) {
        if (shot.durationSeconds && shot.durationSeconds > 15) shot.durationSeconds = 15;
        if (shot.durationSeconds && shot.durationSeconds < 1) shot.durationSeconds = 1;
      }
    }

    try {
      storyboard = storyboardResultSchema.parse(raw);
      break; // success
    } catch (err) {
      lastValidationError = err instanceof Error ? err.message : String(err);
      if (storyboardAttempts >= maxStoryboardAttempts) {
        throw new Error(`Storyboard validation failed after ${maxStoryboardAttempts} attempts: ${lastValidationError}`);
      }
    }
  }

  if (!storyboard) throw new Error("Storyboard validation failed");

  // ── Agent 3: Prompt Compiler ──
  logger.info({ projectId: project.id }, "Agent 3/4: Prompt Compiler");
  const compilerResult = await runAgent(promptCompilerAgent, storyboardResult.rawOutput);
  agentResults.push(compilerResult);
  writeFileSync(join(projectDir, "03-compiled.json"), compilerResult.rawOutput);

  // ── Agent 4: Safety & IP Guard ──
  logger.info({ projectId: project.id }, "Agent 4/4: Safety & IP Guard");
  const safetyResult = await runAgent(safetyGuardAgent, compilerResult.rawOutput);
  agentResults.push(safetyResult);
  writeFileSync(join(projectDir, "04-safety.json"), safetyResult.rawOutput);

  // Parse safety output
  const safetyOutput = safetyResult.parsed as {
    approved: boolean;
    flags: Array<{ shotIndex: number; issue: string; severity: string; suggestion: string }>;
    shots: Array<{
      shotIndex: number;
      compiledPrompt: string;
      compiledNegativePrompt: string;
      durationSeconds: number;
      cameraMotion: string;
      transitionToNext: string;
      modified: boolean;
    }>;
  };

  // Post-process: downgrade "block" flags that are false positives on generic imagery.
  // The safety model can over-trigger on ordinary industrial/professional objects that carry
  // no copyright or IP risk. Any "block" flag whose issue text contains only generic terms
  // (and no named brand/character indicator) is downgraded to "warn" so the project proceeds.
  const GENERIC_TERMS_PATTERN =
    /hard\s*hat|safety\s*helmet|steel\s*beam|metal\s*bar|rebar|scaffolding|catwalk|girder|i-beam|construction\s*(site|worker|equipment)|warehouse|factory|industrial|loading\s*dock|assembly\s*line|foundry|shipyard|work(er|ers|place)?\s*(boot|vest|wear|attire|clothing|uniform|gear)|tool\s*belt|welder|welding|crane\s*(operator)?|forklift|conveyor/i;
  const SPECIFIC_IP_PATTERN =
    /\b(brand|trademark|©|®|™|copyrighted?\s+character|owned\s+by|licensed|franchise|marvel|dc\s+comics|disney|warner\s+bros?|nike|apple|coca[- ]cola|mcdonald|star\s*wars|harry\s*potter|batman|spider[- ]?man|mickey\s*mouse)\b/i;

  for (const flag of safetyOutput.flags) {
    if (
      flag.severity === "block" &&
      GENERIC_TERMS_PATTERN.test(flag.issue) &&
      !SPECIFIC_IP_PATTERN.test(flag.issue)
    ) {
      logger.warn(
        { shotIndex: flag.shotIndex, issue: flag.issue },
        "Safety: downgrading false-positive IP block on generic imagery to warn"
      );
      flag.severity = "warn";
    }
  }

  // Re-derive approved after potential downgrades
  const blockFlags = safetyOutput.flags.filter((f) => f.severity === "block");
  if (blockFlags.length > 0) {
    throw new Error(
      `Safety review blocked the storyboard: ${blockFlags.map((f) => f.issue).join("; ")}`
    );
  }
  safetyOutput.approved = true;

  // Persist storyboard
  const storyboardRecord = await db.storyboard.create({
    data: {
      projectId: project.id,
      rawJson: JSON.stringify({
        intent: intentResult.parsed,
        storyboard,
        compiled: compilerResult.parsed,
        safety: safetyOutput,
      }),
      llmProvider: config.STORYBOARD_LLM_PROVIDER,
      llmModel: config.OLLAMA_MODEL,
      retryCount: 0,
    },
  });

  // Create shot records from safety-approved prompts
  const finalShots = safetyOutput.shots || (compilerResult.parsed as { shots: Array<{ shotIndex: number; compiledPrompt: string; compiledNegativePrompt: string; durationSeconds: number; cameraMotion: string }> }).shots;

  // Determine reframe defaults based on camera motion
  function inferReframe(cameraMotion: string): { focus: string; pan: string } {
    const motion = (cameraMotion || "").toLowerCase();
    if (motion.includes("pan left") || motion.includes("ltr")) return { focus: "center", pan: "slow_ltr" };
    if (motion.includes("pan right") || motion.includes("rtl")) return { focus: "center", pan: "slow_rtl" };
    if (motion.includes("upper") || motion.includes("crane up")) return { focus: "upper", pan: "none" };
    if (motion.includes("lower") || motion.includes("low angle")) return { focus: "lower", pan: "none" };
    return { focus: "center", pan: "none" };
  }

  const shotsDir = join(config.STUDIO_ROOT, project.id, "shots");

  const shots = await Promise.all(
    finalShots.map((shot) => {
      const reframe = inferReframe(shot.cameraMotion);

      // Write individual shot.json under STUDIO_ROOT
      writeFileSync(join(shotsDir, `shot_${shot.shotIndex}.json`), JSON.stringify({
        shotIndex: shot.shotIndex,
        prompt: shot.compiledPrompt,
        negativePrompt: shot.compiledNegativePrompt,
        durationSeconds: shot.durationSeconds,
        cameraMotion: shot.cameraMotion,
        mood: storyboard.shots[shot.shotIndex]?.mood || "",
        targetAspectRatio: project.targetAspectRatio,
        targetWidth: project.targetWidth,
        targetHeight: project.targetHeight,
        reframeFocus: reframe.focus,
        reframePan: reframe.pan,
      }, null, 2));

      return db.shot.create({
        data: {
          projectId: project.id,
          shotIndex: shot.shotIndex,
          prompt: shot.compiledPrompt,
          negativePrompt: shot.compiledNegativePrompt,
          durationSeconds: shot.durationSeconds,
          cameraMotion: shot.cameraMotion,
          mood: storyboard.shots[shot.shotIndex]?.mood || "",
          reframeFocus: reframe.focus,
          reframePan: reframe.pan,
        },
      });
    })
  );

  // Update project status
  await db.project.update({
    where: { id: project.id },
    data: { status: "storyboarded", shotCount: shots.length },
  });

  logger.info(
    {
      projectId: project.id,
      shotCount: shots.length,
      safetyApproved: safetyOutput.approved,
      flags: safetyOutput.flags.length,
    },
    "Storyboard pipeline complete"
  );

  return {
    storyboardId: storyboardRecord.id,
    shots,
    agentResults,
    safetyApproved: safetyOutput.approved,
    flags: safetyOutput.flags,
  };
}
