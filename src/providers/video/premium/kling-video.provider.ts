import type { IPremiumVideoProvider } from "./premium.interface.js";
import type {
  PremiumRenderRequest,
  PremiumRenderResult,
  PremiumRenderCapabilities,
} from "./premium.types.js";
import { downloadVideoFile, sleep, msElapsed } from "./download.utils.js";
import { fetchWithRetry } from "../../../utils/retry.js";
import { config } from "../../../config.js";

const KLING_BASE = "https://api.klingai.com/v1";
const POLL_INTERVAL_MS = 5_000;

type KlingStatus = "submitted" | "processing" | "succeed" | "failed";

interface KlingTaskResponse {
  code: number;
  message: string;
  data: {
    task_id: string;
    task_status: KlingStatus;
    task_status_msg?: string;
    task_result?: {
      videos: Array<{ url: string; duration: string }>;
    };
  };
}

export class KlingVideoProvider implements IPremiumVideoProvider {
  readonly provider = "kling_video" as const;

  readonly capabilities: PremiumRenderCapabilities = {
    maxDurationSeconds: 10,
    supportedResolutions: [
      { width: 1920, height: 1080 },
      { width: 1080, height: 1920 },
      { width: 1080, height: 1080 },
    ],
    supportedAspectRatios: ["16:9", "9:16", "1:1"],
    supportsNegativePrompt: true,
    supportsSeed: false,
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
    };
  }

  async render(req: PremiumRenderRequest): Promise<PremiumRenderResult> {
    const startMs = Date.now();

    const createResp = await fetchWithRetry(`${KLING_BASE}/videos/text2video`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        prompt: req.prompt,
        negative_prompt: req.negativePrompt,
        duration: String(req.durationSeconds),
        aspect_ratio: req.aspectRatio || `${req.width}:${req.height}`,
        cfg_scale: 0.5,
        mode: "std",
      }),
    });

    if (!createResp.ok) {
      const text = await createResp.text();
      return {
        success: false,
        provider: "kling_video",
        error: `Kling submission failed: HTTP ${createResp.status} — ${text}`,
        durationMs: msElapsed(startMs),
      };
    }

    const createData = (await createResp.json()) as KlingTaskResponse;
    if (createData.code !== 0) {
      return {
        success: false,
        provider: "kling_video",
        error: `Kling error: ${createData.message}`,
        durationMs: msElapsed(startMs),
      };
    }

    const taskId = createData.data.task_id;

    const deadline = startMs + config.PREMIUM_POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);

      const pollResp = await fetchWithRetry(`${KLING_BASE}/videos/text2video/${taskId}`, {
        headers: this.headers(),
      });

      if (!pollResp.ok) {
        return {
          success: false,
          provider: "kling_video",
          requestId: taskId,
          error: `Kling poll failed: HTTP ${pollResp.status}`,
          durationMs: msElapsed(startMs),
        };
      }

      const pollData = (await pollResp.json()) as KlingTaskResponse;
      const taskStatus = pollData.data.task_status;

      if (taskStatus === "succeed" && pollData.data.task_result?.videos?.[0]) {
        const videoUrl = pollData.data.task_result.videos[0].url;
        const videoPath = await downloadVideoFile(videoUrl, req.outputDir, req.filenamePrefix);

        return {
          success: true,
          videoPath,
          requestId: taskId,
          provider: "kling_video",
          rawResponseMeta: pollData.data as unknown as Record<string, unknown>,
          durationMs: msElapsed(startMs),
        };
      }

      if (taskStatus === "failed") {
        return {
          success: false,
          provider: "kling_video",
          requestId: taskId,
          error: pollData.data.task_status_msg ?? "Kling task failed",
          rawResponseMeta: pollData.data as unknown as Record<string, unknown>,
          durationMs: msElapsed(startMs),
        };
      }
    }

    return {
      success: false,
      provider: "kling_video",
      requestId: taskId,
      error: `Kling task timed out after ${config.PREMIUM_POLL_TIMEOUT_MS / 1000}s`,
      durationMs: msElapsed(startMs),
    };
  }

  async checkHealth(): Promise<{ healthy: boolean; message?: string }> {
    try {
      // A GET with a filter is a lightweight check; any non-5xx means API is reachable
      const resp = await fetch(`${KLING_BASE}/videos/text2video?pageNum=1&pageSize=1`, {
        headers: this.headers(),
      });
      return resp.status < 500
        ? { healthy: true }
        : { healthy: false, message: `Kling API returned ${resp.status}` };
    } catch (e) {
      return { healthy: false, message: String(e) };
    }
  }
}
