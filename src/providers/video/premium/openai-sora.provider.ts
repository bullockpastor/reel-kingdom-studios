import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { IPremiumVideoProvider } from "./premium.interface.js";
import type {
  PremiumRenderRequest,
  PremiumRenderResult,
  PremiumRenderCapabilities,
} from "./premium.types.js";
import { downloadVideoFile, sleep, msElapsed } from "./download.utils.js";

const SORA_BASE = "https://api.openai.com/v1/video/generations";
const POLL_INTERVAL_MS = 10_000;
const MAX_WAIT_MS = 600_000; // 10 minutes

interface SoraJobResponse {
  id: string;
  status: "queued" | "processing" | "completed" | "failed" | "rejected";
  data?: Array<{ url?: string; b64_json?: string }>;
  error?: { message: string };
}

export class OpenAISoraProvider implements IPremiumVideoProvider {
  readonly provider = "openai_sora" as const;

  readonly capabilities: PremiumRenderCapabilities = {
    maxDurationSeconds: 20,
    supportedResolutions: [
      { width: 1920, height: 1080 },
      { width: 1080, height: 1920 },
      { width: 1080, height: 1080 },
    ],
    supportedAspectRatios: ["16:9", "9:16", "1:1"],
    supportsNegativePrompt: false,
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

    const createResp = await fetch(SORA_BASE, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        prompt: req.prompt,
        size: `${req.width}x${req.height}`,
        duration: req.durationSeconds,
        n: 1,
      }),
    });

    if (!createResp.ok) {
      const text = await createResp.text();
      return {
        success: false,
        provider: "openai_sora",
        error: `Sora submission failed: HTTP ${createResp.status} — ${text}`,
        durationMs: msElapsed(startMs),
      };
    }

    const createData = (await createResp.json()) as SoraJobResponse;
    const jobId = createData.id;

    const deadline = startMs + MAX_WAIT_MS;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);

      const pollResp = await fetch(`${SORA_BASE}/${jobId}`, {
        headers: this.headers(),
      });

      if (!pollResp.ok) {
        return {
          success: false,
          provider: "openai_sora",
          requestId: jobId,
          error: `Sora poll failed: HTTP ${pollResp.status}`,
          durationMs: msElapsed(startMs),
        };
      }

      const pollData = (await pollResp.json()) as SoraJobResponse;

      if (pollData.status === "completed" && pollData.data?.[0]) {
        const video = pollData.data[0];
        let videoPath: string;

        if (video.url) {
          videoPath = await downloadVideoFile(video.url, req.outputDir, req.filenamePrefix);
        } else if (video.b64_json) {
          mkdirSync(req.outputDir, { recursive: true });
          const filename = `${req.filenamePrefix}_${Date.now()}.mp4`;
          videoPath = path.join(req.outputDir, filename);
          writeFileSync(videoPath, Buffer.from(video.b64_json, "base64"));
        } else {
          return {
            success: false,
            provider: "openai_sora",
            requestId: jobId,
            error: "Sora returned no video data",
            rawResponseMeta: pollData as unknown as Record<string, unknown>,
            durationMs: msElapsed(startMs),
          };
        }

        return {
          success: true,
          videoPath,
          requestId: jobId,
          provider: "openai_sora",
          rawResponseMeta: pollData as unknown as Record<string, unknown>,
          durationMs: msElapsed(startMs),
        };
      }

      if (pollData.status === "failed" || pollData.status === "rejected") {
        return {
          success: false,
          provider: "openai_sora",
          requestId: jobId,
          error: pollData.error?.message ?? `Sora job ${pollData.status}`,
          rawResponseMeta: pollData as unknown as Record<string, unknown>,
          durationMs: msElapsed(startMs),
        };
      }
    }

    return {
      success: false,
      provider: "openai_sora",
      requestId: jobId,
      error: `Sora job timed out after ${MAX_WAIT_MS / 1000}s`,
      durationMs: msElapsed(startMs),
    };
  }

  async checkHealth(): Promise<{ healthy: boolean; message?: string }> {
    try {
      const resp = await fetch("https://api.openai.com/v1/models", {
        headers: this.headers(),
      });
      return resp.ok
        ? { healthy: true }
        : { healthy: false, message: `OpenAI API returned ${resp.status}` };
    } catch (e) {
      return { healthy: false, message: String(e) };
    }
  }
}
