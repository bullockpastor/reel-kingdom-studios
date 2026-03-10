import { readFileSync } from "node:fs";
import { extname } from "node:path";
import type { IPremiumVideoProvider } from "./premium.interface.js";
import type {
  PremiumRenderRequest,
  PremiumRenderResult,
  PremiumRenderCapabilities,
} from "./premium.types.js";
import { downloadVideoFile, sleep, msElapsed } from "./download.utils.js";
import { fetchWithRetry } from "../../../utils/retry.js";
import { config } from "../../../config.js";
import { logger } from "../../../utils/logger.js";

const RUNWAY_BASE = "https://api.dev.runwayml.com/v1";
const RUNWAY_VERSION = "2024-11-06";

// Runway Gen4 only accepts these exact pixel-dimension strings as the ratio field.
const RUNWAY_RATIO_MAP: Record<string, string> = {
  "16:9": "1280:720",
  "9:16": "720:1280",
  "4:3":  "1280:960",
  "1:1":  "1024:1024",
};

/**
 * Map an aspect ratio string or raw dimensions to the nearest Runway-accepted
 * pixel-dimension string. Runway rejects anything not in its supported list.
 */
function toRunwayRatio(aspectRatio: string | undefined, width: number, height: number): string {
  // Named aspect ratio lookup (e.g. "16:9" → "1280:720")
  if (aspectRatio && RUNWAY_RATIO_MAP[aspectRatio]) return RUNWAY_RATIO_MAP[aspectRatio];

  // Snap from raw dimensions to the nearest supported ratio.
  // Handles cases like 832x480 (passed as "832:480") which isn't in the map.
  const r = width / height;
  if (r >= 1.5) return "1280:720";   // 16:9 landscape
  if (r <= 0.7) return "720:1280";   // 9:16 portrait
  if (r >= 1.2) return "1280:960";   // 4:3
  return "1024:1024";                // square
}

/**
 * Runway Gen4/Gen4.5 only supports 5 or 10 second clips.
 * Snap the requested duration to the nearest supported value.
 */
function snapToRunwayDuration(durationSeconds: number): 5 | 10 {
  return durationSeconds <= 7.5 ? 5 : 10;
}

/**
 * Read a local image file and return a base64 data URI suitable for Runway's
 * promptImage field. Returns null if the file cannot be read.
 */
function imageToDataUri(filePath: string): string | null {
  try {
    const ext = extname(filePath).toLowerCase();
    const mime =
      ext === ".png"  ? "image/png"  :
      ext === ".webp" ? "image/webp" :
      ext === ".gif"  ? "image/gif"  :
      "image/jpeg";
    const buf = readFileSync(filePath);
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch (err) {
    logger.warn({ filePath, err }, "Runway: could not read reference image — skipping promptImage");
    return null;
  }
}

const POLL_INTERVAL_MS = 5_000;

type RunwayStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED";

interface RunwayTaskResponse {
  id: string;
  status: RunwayStatus;
  output?: string[];
  failure?: string;
  progress?: number;
}

export class RunwayGen4Provider implements IPremiumVideoProvider {
  readonly provider = "runway_gen4" as const;

  readonly capabilities: PremiumRenderCapabilities = {
    maxDurationSeconds: 10,
    supportedResolutions: [
      { width: 1280, height: 720 },
      { width: 720, height: 1280 },
      { width: 1920, height: 1080 },
    ],
    supportedAspectRatios: ["16:9", "9:16", "4:3"],
    supportsNegativePrompt: false,
    supportsSeed: true,
  };

  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "X-Runway-Version": RUNWAY_VERSION,
    };
  }

  async render(req: PremiumRenderRequest): Promise<PremiumRenderResult> {
    const startMs = Date.now();

    const duration = snapToRunwayDuration(req.durationSeconds);
    const ratio = toRunwayRatio(req.aspectRatio, req.width, req.height);

    // Build promptImage array if a reference image is available (presenter identity anchor)
    let promptImage: Array<{ uri: string }> | undefined;
    if (req.referenceImagePath) {
      const dataUri = imageToDataUri(req.referenceImagePath);
      if (dataUri) {
        promptImage = [{ uri: dataUri }];
        logger.info({ shotId: req.shotId }, "Runway: using reference image for identity anchoring");
      }
    }

    const body: Record<string, unknown> = {
      model: this.model,
      promptText: req.prompt,
      duration,
      ratio,
      seed: req.seed,
    };
    if (promptImage) body.promptImage = promptImage;

    const createResp = await fetchWithRetry(`${RUNWAY_BASE}/text_to_video`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!createResp.ok) {
      const text = await createResp.text();
      return {
        success: false,
        provider: "runway_gen4",
        error: `Runway submission failed: HTTP ${createResp.status} — ${text}`,
        durationMs: msElapsed(startMs),
      };
    }

    const task = (await createResp.json()) as RunwayTaskResponse;
    const taskId = task.id;

    logger.info({ shotId: req.shotId, taskId, duration, ratio }, "Runway task submitted — polling");

    const maxWaitMs = config.PREMIUM_POLL_TIMEOUT_MS;
    const deadline = startMs + maxWaitMs;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);

      const pollResp = await fetchWithRetry(`${RUNWAY_BASE}/tasks/${taskId}`, {
        headers: this.headers(),
      });

      if (!pollResp.ok) {
        return {
          success: false,
          provider: "runway_gen4",
          requestId: taskId,
          error: `Runway poll failed: HTTP ${pollResp.status}`,
          durationMs: msElapsed(startMs),
        };
      }

      const pollData = (await pollResp.json()) as RunwayTaskResponse;

      if (pollData.status === "SUCCEEDED" && pollData.output?.[0]) {
        const videoPath = await downloadVideoFile(
          pollData.output[0],
          req.outputDir,
          req.filenamePrefix
        );

        return {
          success: true,
          videoPath,
          requestId: taskId,
          provider: "runway_gen4",
          rawResponseMeta: pollData as unknown as Record<string, unknown>,
          durationMs: msElapsed(startMs),
        };
      }

      if (pollData.status === "FAILED" || pollData.status === "CANCELED") {
        return {
          success: false,
          provider: "runway_gen4",
          requestId: taskId,
          error: pollData.failure ?? `Runway task ${pollData.status}`,
          rawResponseMeta: pollData as unknown as Record<string, unknown>,
          durationMs: msElapsed(startMs),
        };
      }

      logger.debug({ taskId, status: pollData.status, progress: pollData.progress }, "Runway: still processing");
    }

    return {
      success: false,
      provider: "runway_gen4",
      requestId: taskId,
      error: `Runway task timed out after ${config.PREMIUM_POLL_TIMEOUT_MS / 1000}s`,
      durationMs: msElapsed(startMs),
    };
  }

  async checkHealth(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const resp = await fetch(`${RUNWAY_BASE}/organization`, {
        headers: this.headers(),
      });
      return resp.ok
        ? { healthy: true }
        : { healthy: false, message: `Runway API returned ${resp.status}` };
    } catch (e) {
      return { healthy: false, message: String(e) };
    }
  }
}
