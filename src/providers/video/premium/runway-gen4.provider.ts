import type { IPremiumVideoProvider } from "./premium.interface.js";
import type {
  PremiumRenderRequest,
  PremiumRenderResult,
  PremiumRenderCapabilities,
} from "./premium.types.js";
import { downloadVideoFile, sleep, msElapsed } from "./download.utils.js";

const RUNWAY_BASE = "https://api.dev.runwayml.com/v1";
const RUNWAY_VERSION = "2024-11-06";

// Valid Runway text-to-video models as of 2025-Q1:
// gen3a_turbo | gen4.5 | veo3 | veo3.1 | veo3.1_fast

// Runway ratio accepts pixel-dimension strings, not traditional aspect ratios
const RUNWAY_RATIO_MAP: Record<string, string> = {
  "16:9": "1280:720",
  "9:16": "720:1280",
  "4:3":  "1280:960",
  "1:1":  "1024:1024",
};

function toRunwayRatio(aspectRatio: string | undefined, width: number, height: number): string {
  if (aspectRatio && RUNWAY_RATIO_MAP[aspectRatio]) return RUNWAY_RATIO_MAP[aspectRatio];
  // If already pixel-format (e.g. "1280:720") pass through; otherwise best-effort
  return `${width}:${height}`;
}
const POLL_INTERVAL_MS = 5_000;
const MAX_WAIT_MS = 600_000;

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

    const createResp = await fetch(`${RUNWAY_BASE}/text_to_video`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        promptText: req.prompt,
        duration: req.durationSeconds,
        ratio: toRunwayRatio(req.aspectRatio, req.width, req.height),
        seed: req.seed,
      }),
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

    const deadline = startMs + MAX_WAIT_MS;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);

      const pollResp = await fetch(`${RUNWAY_BASE}/tasks/${taskId}`, {
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
    }

    return {
      success: false,
      provider: "runway_gen4",
      requestId: taskId,
      error: `Runway task timed out after ${MAX_WAIT_MS / 1000}s`,
      durationMs: msElapsed(startMs),
    };
  }

  async checkHealth(): Promise<{ healthy: boolean; message?: string }> {
    try {
      // HEAD or GET /organization is a lightweight auth check for Runway
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
