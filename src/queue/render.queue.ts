import { Queue } from "bullmq";
import { getRedisConnection } from "./connection.js";

export interface RenderJobData {
  shotId: string;
  renderJobId: string;
  projectId: string;
  engine: "comfyui" | "premium";
  prompt: string;
  negativePrompt: string;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  steps?: number;
  seed?: number;
  outputDir: string;
  triggerReason?: "cinema_mode" | "qc_fail_twice" | "manual";
  /** Per-shot provider override (openai_sora | runway_gen4 | kling_video | google_veo). */
  premiumProvider?: string;
}

export const renderQueue = new Queue<RenderJobData>("render", {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 10000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});
