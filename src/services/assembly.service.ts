import type { Project, Shot, Storyboard, PresenterScript, Presenter } from "@prisma/client";
import { join } from "node:path";
import { assemblyQueue } from "../queue/assembly.queue.js";
import { runAgent, editorAssemblerAgent } from "../agents/index.js";
import { projectOutputDir } from "../storage/studio-root.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

export async function queueAssembly(
  project: Project,
  shots: Shot[],
  storyboard: Storyboard | null,
  transitionDuration?: number,
  outputFormat?: "mp4" | "webm",
  audioPaths?: { primaryAudioPath?: string; backgroundMusicPath?: string },
  presenterScript?: (PresenterScript & { presenter: Presenter }) | null
) {
  const format = outputFormat || (config.DEFAULT_OUTPUT_FORMAT as "mp4" | "webm");
  const outputDir = projectOutputDir(project.id);
  const outputPath = join(outputDir, `final.${format}`);

  // ── Agent 7: Editor / Assembler ──
  logger.info({ projectId: project.id }, "Running Editor/Assembler agent");

  const agentInput = JSON.stringify({
    projectId: project.id,
    targetAspectRatio: project.targetAspectRatio,
    targetWidth: project.targetWidth,
    targetHeight: project.targetHeight,
    format: project.format,
    shots: shots.map((s) => ({
      shotIndex: s.shotIndex,
      durationSeconds: s.durationSeconds,
      mood: s.mood,
      cameraMotion: s.cameraMotion,
      renderPath: s.renderPath,
      renderEngine: s.renderEngine,
      reframeFocus: s.reframeFocus,
      reframePan: s.reframePan,
    })),
    storyboard: storyboard ? JSON.parse(storyboard.rawJson) : null,
    defaultTransitionDuration: transitionDuration || config.DEFAULT_TRANSITION_DURATION,
  });

  const editResult = await runAgent(editorAssemblerAgent, agentInput);
  const editPlan = editResult.parsed as {
    editPlan: Array<{
      shotIndex: number;
      trimStart: number;
      trimEnd: number;
      transitionType: string;
      transitionDuration: number;
      speedFactor?: number;
      reframeFocus?: string;
      reframePan?: string;
    }>;
    outputFormat: string;
    totalDurationSeconds: number;
  };

  // Build presenter overlay lookup map if this is a presenter project
  interface PerfShot { segmentIndex: number; lowerThirdTiming?: { in: number; out: number; text: string } | null; scriptureOverlay?: string | null }
  let perfShotMap = new Map<number, PerfShot>();
  if (presenterScript) {
    try {
      const spec = JSON.parse(presenterScript.performanceSpec) as { shots?: PerfShot[] };
      for (const ps of spec.shots ?? []) {
        perfShotMap.set(ps.segmentIndex, ps);
      }
    } catch { /* ignore parse errors */ }
  }

  // Map edit plan to assembly queue data (use shot trim override when set)
  const assemblyShots = shots.map((shot) => {
    const plan = editPlan.editPlan.find((p) => p.shotIndex === shot.shotIndex);
    const hasTrimOverride = (shot.trimStart ?? 0) > 0 || (shot.trimEnd ?? 0) > 0;

    // Resolve presenter overlay data for this shot
    const perfShot = presenterScript ? perfShotMap.get(shot.segmentIndex ?? shot.shotIndex) : null;

    return {
      shotId: shot.id,
      shotIndex: shot.shotIndex,
      filePath: shot.renderPath!,
      durationSeconds: shot.durationSeconds,
      trimStart: hasTrimOverride ? (shot.trimStart ?? 0) : (plan?.trimStart ?? 0),
      trimEnd: hasTrimOverride ? (shot.trimEnd ?? 0) : (plan?.trimEnd ?? 0),
      transitionType: plan?.transitionType ?? "crossfade",
      transitionDuration: plan?.transitionDuration ?? (transitionDuration || config.DEFAULT_TRANSITION_DURATION),
      speedFactor: plan?.speedFactor ?? 1.0,
      reframeFocus: plan?.reframeFocus ?? shot.reframeFocus,
      reframePan: plan?.reframePan ?? shot.reframePan,
      lowerThirdEnabled: shot.lowerThirdEnabled ?? true,
      lowerThird: perfShot?.lowerThirdTiming ?? null,
      scriptureOverlay: perfShot?.scriptureOverlay ?? null,
    };
  });

  // Enqueue
  const job = await assemblyQueue.add(`assemble-${project.id}`, {
    projectId: project.id,
    outputPath,
    outputFormat: format,
    targetWidth: project.targetWidth,
    targetHeight: project.targetHeight,
    nativeWidth: config.WAN21_DEFAULT_WIDTH,
    nativeHeight: config.WAN21_DEFAULT_HEIGHT,
    shots: assemblyShots,
    primaryAudioPath: audioPaths?.primaryAudioPath,
    backgroundMusicPath: audioPaths?.backgroundMusicPath,
    showLowerThirds: presenterScript?.showLowerThirds ?? false,
    showScriptureOverlays: presenterScript?.showScriptureOverlays ?? false,
  });

  logger.info({ projectId: project.id, jobId: job.id }, "Assembly job queued");

  return {
    message: "Assembly job queued",
    jobId: job.id,
    outputPath,
    editPlan: editPlan.editPlan,
    estimatedDuration: editPlan.totalDurationSeconds,
  };
}
