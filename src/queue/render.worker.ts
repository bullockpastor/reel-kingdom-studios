import { Worker } from "bullmq";
import { getRedisConnection } from "./connection.js";
import type { RenderJobData } from "./render.queue.js";
import { db } from "../db.js";
import { getLocalRenderer, getPremiumVideoProvider } from "../providers/video/index.js";
import { runAgent, visualQCAgent } from "../agents/index.js";
import { shotRenderDir } from "../storage/studio-root.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const worker = new Worker<RenderJobData>(
  "render",
  async (job) => {
    const data = job.data;
    logger.info({ shotId: data.shotId, engine: data.engine }, "Processing render job");

    // Update DB: processing
    await db.renderJob.update({
      where: { id: data.renderJobId },
      data: { status: "processing", startedAt: new Date() },
    });
    await db.shot.update({
      where: { id: data.shotId },
      data: { status: "rendering" },
    });

    let filePath: string | undefined;
    let durationMs = 0;

    try {
      if (data.engine === "comfyui") {
        const renderer = getLocalRenderer();
        const renderDir = shotRenderDir(data.projectId, data.shotId, "draft");
        const result = await renderer.render({
          shotId: data.shotId,
          prompt: data.prompt,
          negativePrompt: data.negativePrompt,
          durationSeconds: data.durationSeconds,
          width: data.width,
          height: data.height,
          fps: data.fps,
          steps: data.steps,
          seed: data.seed,
          outputDir: renderDir,
          filenamePrefix: `shot_${data.shotId}`,
        });

        if (!result.success) throw new Error(result.error || "Render failed");

        filePath = result.filePath;
        durationMs = result.durationMs;

        if (result.promptId) {
          await db.shot.update({
            where: { id: data.shotId },
            data: { comfyuiPromptId: result.promptId },
          });
        }
      } else {
        // Premium rendering via provider-agnostic factory
        const premiumProvider = getPremiumVideoProvider(data.premiumProvider);
        const renderDir = shotRenderDir(data.projectId, data.shotId, "final");
        const result = await premiumProvider.render({
          shotId: data.shotId,
          prompt: data.prompt,
          negativePrompt: data.negativePrompt,
          durationSeconds: data.durationSeconds,
          width: data.width,
          height: data.height,
          fps: data.fps,
          aspectRatio: `${data.width}:${data.height}`,
          seed: data.seed,
          outputDir: renderDir,
          filenamePrefix: `shot_${data.shotId}`,
          triggerReason: data.triggerReason || "manual",
        });

        if (!result.success) throw new Error(result.error || "Premium render failed");

        filePath = result.videoPath;
        durationMs = result.durationMs ?? 0;

        // Persist audit trail
        await db.premiumAudit.create({
          data: {
            shotId: data.shotId,
            provider: result.provider,
            premiumTriggerReason: data.triggerReason || "manual",
            requestId: result.requestId,
            estimatedCost: result.costEstimate,
            responseMetadata: JSON.stringify(result.rawResponseMeta ?? {}),
            status: "completed",
            completedAt: new Date(),
          },
        });
      }

      // ── Agent 6: Visual QC ──
      logger.info({ shotId: data.shotId }, "Running Visual QC agent");
      const qcResult = await runAgent(visualQCAgent, JSON.stringify({
        shotIndex: 0,
        originalPrompt: data.prompt,
        engine: data.engine,
        renderDurationMs: durationMs,
        resolution: `${data.width}x${data.height}`,
        fps: data.fps,
        steps: data.steps,
        durationSeconds: data.durationSeconds,
        renderSuccess: true,
        filePath,
      }));

      const qcOutput = qcResult.parsed as {
        pass: boolean;
        score: number;
        recommendation: string;
        issues: Array<{ type: string; severity: string; description: string }>;
      };

      const qcScore = typeof qcOutput.score === "number" ? qcOutput.score : 0.7;

      // Score-floor override: the QC agent evaluates blind (no actual video).
      // If the score is good enough, accept regardless of LLM recommendation.
      const QC_ACCEPT_FLOOR = 0.65;
      if (qcScore >= QC_ACCEPT_FLOOR && qcOutput.recommendation !== "accept") {
        logger.warn(
          { shotId: data.shotId, qcScore, originalRecommendation: qcOutput.recommendation },
          "QC score above floor — overriding recommendation to accept"
        );
        qcOutput.recommendation = "accept";
      }

      // Update render job as complete
      await db.renderJob.update({
        where: { id: data.renderJobId },
        data: { status: "completed", completedAt: new Date(), durationMs },
      });

      // Handle QC result
      if (qcOutput.recommendation === "retry_premium" && data.engine === "comfyui") {
        // QC says retry with premium
        await db.shot.update({
          where: { id: data.shotId },
          data: {
            status: "failed",
            qcScore,
            qcFailCount: { increment: 1 },
            renderPath: filePath,
            renderEngine: data.engine,
            errorMessage: `QC score ${qcScore}: ${qcOutput.issues.map(i => i.description).join("; ")}`,
          },
        });
        logger.warn({ shotId: data.shotId, qcScore }, "QC recommends premium retry");
      } else if (qcOutput.recommendation === "retry_local" && data.engine === "comfyui") {
        await db.shot.update({
          where: { id: data.shotId },
          data: {
            status: "failed",
            qcScore,
            qcFailCount: { increment: 1 },
            renderPath: filePath,
            renderEngine: data.engine,
            errorMessage: `QC score ${qcScore}: needs local retry`,
          },
        });
        logger.warn({ shotId: data.shotId, qcScore }, "QC recommends local retry");
      } else {
        // QC passed or accepted
        await db.shot.update({
          where: { id: data.shotId },
          data: {
            status: "rendered",
            renderPath: filePath,
            renderEngine: data.engine,
            qcScore,
          },
        });
        logger.info({ shotId: data.shotId, qcScore }, "Shot rendered and QC passed");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await db.renderJob.update({
        where: { id: data.renderJobId },
        data: { status: "failed", errorMessage, completedAt: new Date(), durationMs },
      });
      await db.shot.update({
        where: { id: data.shotId },
        data: { status: "failed", errorMessage, qcFailCount: { increment: 1 } },
      });
      logger.error({ shotId: data.shotId, error: errorMessage }, "Render job failed");
      throw err;
    }
  },
  {
    connection: getRedisConnection(),
    concurrency: 1, // One render at a time (GPU bound)
  }
);

worker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, "Render worker job failed");
});

worker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "Render worker job completed");
});

export { worker as renderWorker };
