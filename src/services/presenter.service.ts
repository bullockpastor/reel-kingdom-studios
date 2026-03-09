import type { Project, Presenter, PresenterScript } from "@prisma/client";
import { db } from "../db.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import {
  runAgent,
  scriptDirectorAgent,
  performanceDirectorAgent,
} from "../agents/index.js";
import type { AgentRunResult } from "../agents/index.js";
import { queueRender } from "./render.service.js";

/**
 * Derive a stable 32-bit seed from a project ID string.
 * Using the same seed for every shot in a presenter project nudges Runway
 * toward consistent appearance across independently generated clips.
 */
function stableProjectSeed(projectId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < projectId.length; i++) {
    h ^= projectId.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0; // unsigned 32-bit integer
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface ScriptSegment {
  index: number;
  text: string;
  pauseBefore: number;
  pauseAfter: number;
  emphasis: string[];
  beatTimingSeconds: number;
  captionChunk: string;
  deliveryNote: string;
}

interface DirectedScriptOutput {
  segments: ScriptSegment[];
  totalEstimatedDurationSeconds: number;
  globalDeliveryNotes: string;
}

interface PerformanceShot {
  segmentIndex: number;
  cameraFraming: string;
  pacingProfile: string;
  emotionalTone: string;
  gestureIntensity: string;
  templateId: string;
  lowerThirdTiming?: { in: number; out: number; text: string };
  scriptureOverlay?: string;
  safeZone: string;
  verticalCropSafe: boolean;
  visualPrompt: string;
}

interface PerformanceSpecOutput {
  shots: PerformanceShot[];
  globalStyle: string;
}

interface GeneratePipelineOptions {
  videoType?: string;
  targetDurationSeconds?: number;
  templatePreference?: string;
}

interface GeneratePipelineResult {
  presenterScriptId: string;
  shots: Awaited<ReturnType<typeof db.shot.create>>[];
  agentResults: AgentRunResult[];
}

// ─── generatePresenterPipeline ─────────────────────────────────────────────

export async function generatePresenterPipeline(
  project: Project,
  rawScript: string,
  presenter: Presenter,
  options: GeneratePipelineOptions = {}
): Promise<GeneratePipelineResult> {
  const { videoType = "sermon", targetDurationSeconds, templatePreference } = options;
  const agentResults: AgentRunResult[] = [];

  // ── Agent 1: Script Director ──
  logger.info({ projectId: project.id }, "Presenter Agent 1/2: Script Director");

  const scriptInput = JSON.stringify({
    rawScript,
    presenterDescription: presenter.description,
    videoType,
    targetDurationSeconds: targetDurationSeconds ?? null,
  });

  const scriptResult = await runAgent(scriptDirectorAgent, scriptInput);
  agentResults.push(scriptResult);

  const directedOutput = scriptResult.parsed as DirectedScriptOutput;

  if (!directedOutput?.segments || !Array.isArray(directedOutput.segments) || directedOutput.segments.length === 0) {
    throw new Error("Script Director returned no segments. Check the script input and retry.");
  }

  logger.info(
    { projectId: project.id, segmentCount: directedOutput.segments.length },
    "Script Director complete"
  );

  // ── Agent 2: Performance Director ──
  logger.info({ projectId: project.id }, "Presenter Agent 2/2: Performance Director");

  const performanceInput = JSON.stringify({
    directedScript: directedOutput,
    presenterDescription: presenter.description,
    templatePreference: templatePreference ?? presenter.defaultTemplateId ?? null,
  });

  const performanceResult = await runAgent(performanceDirectorAgent, performanceInput);
  agentResults.push(performanceResult);

  const performanceOutput = performanceResult.parsed as PerformanceSpecOutput;

  if (!performanceOutput?.shots || !Array.isArray(performanceOutput.shots) || performanceOutput.shots.length === 0) {
    throw new Error("Performance Director returned no shots. Retry or adjust the script.");
  }

  logger.info(
    { projectId: project.id, shotCount: performanceOutput.shots.length },
    "Performance Director complete"
  );

  // ── Build segment index for fast lookup ──
  const segmentByIndex = new Map<number, ScriptSegment>();
  for (const seg of directedOutput.segments) {
    segmentByIndex.set(seg.index, seg);
  }

  // ── Create Shot records ──
  const shots = await Promise.all(
    performanceOutput.shots.map((shot, i) => {
      const segment = segmentByIndex.get(shot.segmentIndex) ?? directedOutput.segments[i];

      // Clamp to Runway Gen4 max; the provider will further snap to 5s or 10s
      const clampedDuration = Math.min(segment?.beatTimingSeconds ?? 5.0, 10.0);

      return db.shot.create({
        data: {
          projectId: project.id,
          shotIndex: shot.segmentIndex,
          prompt: shot.visualPrompt,
          negativePrompt: "blurry, low quality, watermark, text overlay, deformed, inconsistent identity, flickering",
          durationSeconds: clampedDuration,
          cameraMotion: shot.cameraFraming,
          mood: shot.emotionalTone,
          scriptSegmentJson: segment ? JSON.stringify(segment) : null,
          segmentIndex: shot.segmentIndex,
          templateId: shot.templateId ?? null,
          reframeFocus: "center",
          reframePan: "none",
        },
      });
    })
  );

  // ── Persist PresenterScript ──
  const presenterScriptRecord = await db.presenterScript.create({
    data: {
      projectId: project.id,
      presenterId: presenter.id,
      rawScript,
      directedScript: JSON.stringify(directedOutput),
      performanceSpec: JSON.stringify(performanceOutput),
      deliveryMode: videoType,
      templateId: templatePreference ?? presenter.defaultTemplateId ?? null,
      status: "directed",
    },
  });

  // ── Update project status ──
  await db.project.update({
    where: { id: project.id },
    data: { status: "storyboarded", shotCount: shots.length },
  });

  logger.info(
    { projectId: project.id, shotCount: shots.length, presenterScriptId: presenterScriptRecord.id },
    "Presenter pipeline complete"
  );

  return {
    presenterScriptId: presenterScriptRecord.id,
    shots,
    agentResults,
  };
}

// ─── queuePresenterRenders ─────────────────────────────────────────────────

export async function queuePresenterRenders(
  project: Project,
  presenterScript: PresenterScript & { presenter: Presenter },
  providerOverride?: string
) {
  // Resolve provider via fallback chain
  const resolvedProvider =
    providerOverride ??
    presenterScript.presenter.defaultProvider ??
    "runway_gen4";

  // One seed for the entire project → helps Runway maintain consistent appearance
  // across shots. Derived from the project ID so it's stable across re-queues.
  const presenterSeed = stableProjectSeed(project.id);

  // Load all project shots
  const shots = await db.shot.findMany({
    where: { projectId: project.id },
    orderBy: { shotIndex: "asc" },
  });

  if (shots.length === 0) {
    throw new Error("No shots found for this presenter project. Run direction first.");
  }

  const referenceImagePath = presenterScript.presenter.referenceImagePath ?? undefined;

  const results = [];

  for (const shot of shots) {
    const result = await queueRender(
      { ...shot, project },
      {
        engine: "premium",
        premiumProvider: resolvedProvider,
        width: project.targetWidth,
        height: project.targetHeight,
        fps: config.WAN21_DEFAULT_FPS,
        seed: presenterSeed,
        referenceImagePath,
      }
    );
    results.push(result);
  }

  // Update presenterScript status
  await db.presenterScript.update({
    where: { id: presenterScript.id },
    data: { status: "queued" },
  });

  // Update project status
  await db.project.update({
    where: { id: project.id },
    data: { status: "rendering" },
  });

  logger.info(
    { projectId: project.id, provider: resolvedProvider, shotCount: shots.length },
    "Presenter renders queued"
  );

  return results;
}
