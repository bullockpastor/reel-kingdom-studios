import type { Shot, Project } from "@prisma/client";
import { db } from "../db.js";
import { renderQueue } from "../queue/render.queue.js";
import { runAgent, renderOrchestratorAgent } from "../agents/index.js";
import { projectShotsDir } from "../storage/studio-root.js";
import { logger } from "../utils/logger.js";

interface RenderOptions {
  engine: "local" | "premium";
  width: number;
  height: number;
  fps: number;
  seed?: number;
  cinemaMode?: boolean;
}

export async function queueRender(
  shot: Shot & { project: Project },
  options: RenderOptions
) {
  const outputDir = projectShotsDir(shot.projectId);

  // Determine trigger reason for premium
  let triggerReason: "cinema_mode" | "qc_fail_twice" | "manual" | undefined;
  if (options.engine === "premium") {
    if (options.cinemaMode) triggerReason = "cinema_mode";
    else if (shot.qcFailCount >= 2) triggerReason = "qc_fail_twice";
    else triggerReason = "manual";
  }

  // Create render job record
  const renderJob = await db.renderJob.create({
    data: {
      shotId: shot.id,
      engine: options.engine === "premium" ? "premium" : "comfyui",
      attempt: shot.qcFailCount + 1,
    },
  });

  // Enqueue to BullMQ
  const job = await renderQueue.add(`render-${shot.id}`, {
    shotId: shot.id,
    renderJobId: renderJob.id,
    projectId: shot.projectId,
    engine: options.engine === "premium" ? "premium" : "comfyui",
    prompt: shot.prompt,
    negativePrompt: shot.negativePrompt,
    durationSeconds: shot.durationSeconds,
    width: options.width,
    height: options.height,
    fps: options.fps,
    seed: options.seed,
    outputDir,
    triggerReason,
  });

  // Update job with BullMQ ID
  await db.renderJob.update({
    where: { id: renderJob.id },
    data: { bullmqJobId: job.id },
  });

  // Update shot status
  await db.shot.update({
    where: { id: shot.id },
    data: { status: "queued" },
  });

  logger.info(
    { shotId: shot.id, renderJobId: renderJob.id, engine: options.engine },
    "Render job queued"
  );

  return {
    renderJob,
    bullmqJobId: job.id,
    message: `Render job queued (engine: ${options.engine})`,
  };
}

/**
 * Use Agent 5 (Render Orchestrator) to plan rendering for all shots in a project.
 */
export async function planRenders(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { shots: { orderBy: { shotIndex: "asc" } }, storyboard: true },
  });

  if (!project) throw new Error("Project not found");

  const input = JSON.stringify({
    projectId,
    shots: project.shots.map((s) => ({
      shotIndex: s.shotIndex,
      prompt: s.prompt,
      durationSeconds: s.durationSeconds,
      cameraMotion: s.cameraMotion,
      mood: s.mood,
    })),
  });

  const result = await runAgent(renderOrchestratorAgent, input);
  return result.parsed as {
    renderPlan: Array<{
      shotIndex: number;
      engine: string;
      priority: string;
      width: number;
      height: number;
      fps: number;
      steps: number;
      reason: string;
    }>;
  };
}
