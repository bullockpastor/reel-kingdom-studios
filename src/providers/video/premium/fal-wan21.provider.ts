import type { IPremiumVideoProvider } from "./premium.interface.js";
import type {
  PremiumRenderRequest,
  PremiumRenderResult,
  PremiumRenderCapabilities,
} from "./premium.types.js";
import { downloadVideoFile, sleep, msElapsed } from "./download.utils.js";
import { config } from "../../../config.js";
import { logger } from "../../../utils/logger.js";

const FAL_BASE = "https://queue.fal.run";
const FAL_MODEL = "fal-ai/wan/v2.1/t2v";
const POLL_INTERVAL_MS = 5_000;

type FalStatus = "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

interface FalQueueResponse {
  request_id: string;
  status: FalStatus;
}

interface FalStatusResponse {
  status: FalStatus;
  logs?: Array<{ message: string }>;
}

interface FalResultResponse {
  video?: { url: string };
}

/**
 * Map pixel dimensions to fal.ai Wan2.1 resolution string.
 * fal.ai accepts "480p" | "720p" | "1080p".
 */
function toFalResolution(width: number, height: number): string {
  const long = Math.max(width, height);
  if (long >= 900) return "1080p";
  if (long >= 600) return "720p";
  return "480p";
}

/**
 * Map pixel dimensions to fal.ai aspect ratio string.
 */
function toFalAspectRatio(width: number, height: number): string {
  const r = width / height;
  if (r >= 1.5) return "16:9";
  if (r <= 0.7) return "9:16";
  return "1:1";
}

export class FalWan21Provider implements IPremiumVideoProvider {
  readonly provider = "fal_wan21" as const;

  readonly capabilities: PremiumRenderCapabilities = {
    maxDurationSeconds: 10,
    supportedResolutions: [
      { width: 832, height: 480 },
      { width: 480, height: 832 },
      { width: 1280, height: 720 },
      { width: 720, height: 1280 },
    ],
    supportedAspectRatios: ["16:9", "9:16", "1:1"],
    supportsNegativePrompt: true,
    supportsSeed: true,
  };

  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private headers() {
    return {
      Authorization: `Key ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  async render(req: PremiumRenderRequest): Promise<PremiumRenderResult> {
    const startMs = Date.now();
    const resolution = toFalResolution(req.width, req.height);
    const aspectRatio = toFalAspectRatio(req.width, req.height);
    const numFrames = Math.round(req.durationSeconds * req.fps);

    const body: Record<string, unknown> = {
      prompt: req.prompt,
      negative_prompt: req.negativePrompt || "blurry, low quality, watermark, text, deformed",
      num_frames: numFrames,
      frames_per_second: req.fps,
      resolution,
      aspect_ratio: aspectRatio,
      num_inference_steps: 30,
    };
    if (req.seed !== undefined) body.seed = req.seed;

    // Submit job
    const submitResp = await fetch(`${FAL_BASE}/${FAL_MODEL}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!submitResp.ok) {
      const text = await submitResp.text();
      return {
        success: false,
        provider: "fal_wan21",
        error: `fal.ai submission failed: HTTP ${submitResp.status} — ${text}`,
        durationMs: msElapsed(startMs),
      };
    }

    const queued = (await submitResp.json()) as FalQueueResponse;
    const requestId = queued.request_id;

    logger.info(
      { shotId: req.shotId, requestId, resolution, aspectRatio, numFrames },
      "fal.ai Wan2.1 job submitted — polling"
    );

    // Poll for completion
    const deadline = startMs + config.PREMIUM_POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);

      const statusResp = await fetch(
        `${FAL_BASE}/${FAL_MODEL}/requests/${requestId}/status`,
        { headers: this.headers() }
      );

      if (!statusResp.ok) {
        return {
          success: false,
          provider: "fal_wan21",
          requestId,
          error: `fal.ai status poll failed: HTTP ${statusResp.status}`,
          durationMs: msElapsed(startMs),
        };
      }

      const status = (await statusResp.json()) as FalStatusResponse;

      if (status.status === "COMPLETED") {
        // Fetch result
        const resultResp = await fetch(
          `${FAL_BASE}/${FAL_MODEL}/requests/${requestId}`,
          { headers: this.headers() }
        );

        if (!resultResp.ok) {
          return {
            success: false,
            provider: "fal_wan21",
            requestId,
            error: `fal.ai result fetch failed: HTTP ${resultResp.status}`,
            durationMs: msElapsed(startMs),
          };
        }

        const result = (await resultResp.json()) as FalResultResponse;

        if (!result.video?.url) {
          return {
            success: false,
            provider: "fal_wan21",
            requestId,
            error: "fal.ai returned no video URL",
            durationMs: msElapsed(startMs),
          };
        }

        const videoPath = await downloadVideoFile(
          result.video.url,
          req.outputDir,
          req.filenamePrefix
        );

        return {
          success: true,
          videoPath,
          requestId,
          provider: "fal_wan21",
          durationMs: msElapsed(startMs),
        };
      }

      if (status.status === "FAILED") {
        return {
          success: false,
          provider: "fal_wan21",
          requestId,
          error: "fal.ai job failed",
          durationMs: msElapsed(startMs),
        };
      }

      logger.debug({ requestId, status: status.status }, "fal.ai: still processing");
    }

    return {
      success: false,
      provider: "fal_wan21",
      requestId,
      error: `fal.ai job timed out after ${config.PREMIUM_POLL_TIMEOUT_MS / 1000}s`,
      durationMs: msElapsed(startMs),
    };
  }

  async checkHealth(): Promise<{ healthy: boolean; message?: string }> {
    return this.apiKey
      ? { healthy: true }
      : { healthy: false, message: "FAL_API_KEY not configured" };
  }
}
