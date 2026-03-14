import { Worker } from "bullmq";
import { getRedisConnection } from "./connection.js";
import type { AssemblyJobData } from "./assembly.queue.js";
import { assembleVideo } from "../ffmpeg/assembler.js";
import { db } from "../db.js";
import { logger } from "../utils/logger.js";

const worker = new Worker<AssemblyJobData>(
  "assembly",
  async (job) => {
    const data = job.data;
    logger.info({ projectId: data.projectId }, "Processing assembly job");

    await db.project.update({
      where: { id: data.projectId },
      data: { status: "assembling" },
    });

    try {
      await assembleVideo({
        primaryAudioPath: data.primaryAudioPath,
        backgroundMusicPath: data.backgroundMusicPath,
        showLowerThirds: data.showLowerThirds ?? false,
        showScriptureOverlays: data.showScriptureOverlays ?? false,
        shots: data.shots.map((s) => ({
          filePath: s.filePath,
          durationSeconds: s.durationSeconds,
          trimStart: s.trimStart,
          trimEnd: s.trimEnd,
          transitionType: s.transitionType,
          transitionDuration: s.transitionDuration,
          speedFactor: s.speedFactor,
          reframeFocus: s.reframeFocus,
          reframePan: s.reframePan,
          lowerThirdEnabled: s.lowerThirdEnabled,
          lowerThird: s.lowerThird,
          scriptureOverlay: s.scriptureOverlay,
        })),
        outputPath: data.outputPath,
        outputFormat: data.outputFormat,
        targetWidth: data.targetWidth,
        targetHeight: data.targetHeight,
        nativeWidth: data.nativeWidth,
        nativeHeight: data.nativeHeight,
      });

      await db.project.update({
        where: { id: data.projectId },
        data: { status: "assembled", outputPath: data.outputPath },
      });

      logger.info({ projectId: data.projectId, outputPath: data.outputPath }, "Assembly complete");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await db.project.update({
        where: { id: data.projectId },
        data: { status: "failed" },
      });
      logger.error({ projectId: data.projectId, error: errorMessage }, "Assembly failed");
      throw err;
    }
  },
  {
    connection: getRedisConnection(),
    concurrency: 1,
  }
);

worker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, "Assembly worker job failed");
});

export { worker as assemblyWorker };
