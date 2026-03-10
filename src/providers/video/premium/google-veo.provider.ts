import { createSign } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { IPremiumVideoProvider } from "./premium.interface.js";
import type {
  PremiumRenderRequest,
  PremiumRenderResult,
  PremiumRenderCapabilities,
} from "./premium.types.js";
import { sleep, msElapsed } from "./download.utils.js";
import { fetchWithRetry } from "../../../utils/retry.js";
import { config } from "../../../config.js";

const POLL_INTERVAL_MS = 10_000;

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

interface LROResponse {
  name: string;
  done?: boolean;
  error?: { code: number; message: string };
  response?: Record<string, unknown>;
}

interface VeoPrediction {
  bytesBase64Encoded?: string;
  gcsUri?: string;
  mimeType?: string;
}

export class GoogleVeoProvider implements IPremiumVideoProvider {
  readonly provider = "google_veo" as const;

  readonly capabilities: PremiumRenderCapabilities = {
    maxDurationSeconds: 30,
    supportedResolutions: [
      { width: 1920, height: 1080 },
      { width: 1280, height: 720 },
    ],
    supportedAspectRatios: ["16:9", "9:16"],
    supportsNegativePrompt: true,
    supportsSeed: true,
  };

  private readonly model: string;
  private readonly project: string;
  private readonly location: string;
  private readonly credentialsPath: string;
  private cachedToken: { value: string; expiresAt: number } | null = null;

  constructor(
    model: string,
    project: string,
    location: string,
    credentialsPath: string
  ) {
    this.model = model;
    this.project = project;
    this.location = location;
    this.credentialsPath = credentialsPath;
  }

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt - 60_000) {
      return this.cachedToken.value;
    }

    const key = JSON.parse(
      readFileSync(this.credentialsPath, "utf-8")
    ) as ServiceAccountKey;
    const tokenUri = key.token_uri ?? "https://oauth2.googleapis.com/token";

    const now = Math.floor(Date.now() / 1000);
    const jwtPayload = {
      iss: key.client_email,
      sub: key.client_email,
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
      scope: "https://www.googleapis.com/auth/cloud-platform",
    };

    const header = Buffer.from(
      JSON.stringify({ alg: "RS256", typ: "JWT" })
    ).toString("base64url");
    const body = Buffer.from(JSON.stringify(jwtPayload)).toString("base64url");
    const signingInput = `${header}.${body}`;

    const sign = createSign("RSA-SHA256");
    sign.update(signingInput);
    const signature = sign.sign(key.private_key, "base64url");
    const jwt = `${signingInput}.${signature}`;

    const tokenResp = await fetch(tokenUri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!tokenResp.ok) {
      throw new Error(`Google auth failed: ${await tokenResp.text()}`);
    }

    const tokenData = (await tokenResp.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.cachedToken = {
      value: tokenData.access_token,
      expiresAt: Date.now() + tokenData.expires_in * 1000,
    };

    return tokenData.access_token;
  }

  private vertexBase(): string {
    return `https://${this.location}-aiplatform.googleapis.com/v1`;
  }

  async render(req: PremiumRenderRequest): Promise<PremiumRenderResult> {
    const startMs = Date.now();

    let token: string;
    try {
      token = await this.getAccessToken();
    } catch (e) {
      return {
        success: false,
        provider: "google_veo",
        error: `Auth error: ${String(e)}`,
        durationMs: msElapsed(startMs),
      };
    }

    const endpoint = [
      this.vertexBase(),
      "projects",
      this.project,
      "locations",
      this.location,
      "publishers",
      "google",
      "models",
      `${this.model}:predictLongRunning`,
    ].join("/");

    const createResp = await fetchWithRetry(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [
          {
            prompt: req.prompt,
            negative_prompt: req.negativePrompt,
            aspect_ratio: req.aspectRatio ?? "16:9",
            duration_seconds: req.durationSeconds,
            seed: req.seed,
          },
        ],
        parameters: { sampleCount: 1 },
      }),
    });

    if (!createResp.ok) {
      const text = await createResp.text();
      return {
        success: false,
        provider: "google_veo",
        error: `Veo submission failed: HTTP ${createResp.status} — ${text}`,
        durationMs: msElapsed(startMs),
      };
    }

    const lro = (await createResp.json()) as LROResponse;
    const operationName = lro.name;
    const pollUrl = `${this.vertexBase()}/${operationName}`;

    const deadline = startMs + config.PREMIUM_POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);

      token = await this.getAccessToken(); // refresh if needed

      const pollResp = await fetchWithRetry(pollUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!pollResp.ok) {
        return {
          success: false,
          provider: "google_veo",
          requestId: operationName,
          error: `Veo poll failed: HTTP ${pollResp.status}`,
          durationMs: msElapsed(startMs),
        };
      }

      const pollData = (await pollResp.json()) as LROResponse;

      if (pollData.done) {
        if (pollData.error) {
          return {
            success: false,
            provider: "google_veo",
            requestId: operationName,
            error: `Veo error: ${pollData.error.message}`,
            rawResponseMeta: pollData as unknown as Record<string, unknown>,
            durationMs: msElapsed(startMs),
          };
        }

        const predictions = (
          pollData.response as { predictions?: VeoPrediction[] } | undefined
        )?.predictions;
        const prediction = predictions?.[0];

        if (!prediction) {
          return {
            success: false,
            provider: "google_veo",
            requestId: operationName,
            error: "Veo returned no predictions",
            rawResponseMeta: pollData as unknown as Record<string, unknown>,
            durationMs: msElapsed(startMs),
          };
        }

        mkdirSync(req.outputDir, { recursive: true });
        const filename = `${req.filenamePrefix}_${Date.now()}.mp4`;
        const videoPath = path.join(req.outputDir, filename);

        if (prediction.bytesBase64Encoded) {
          writeFileSync(videoPath, Buffer.from(prediction.bytesBase64Encoded, "base64"));
        } else if (prediction.gcsUri) {
          // Save the URI reference; GCS downloads require additional auth
          writeFileSync(`${videoPath}.gcs-uri.txt`, prediction.gcsUri, "utf-8");
          return {
            success: false,
            provider: "google_veo",
            requestId: operationName,
            error: `Veo output stored in GCS: ${prediction.gcsUri}. Download manually or configure public GCS access.`,
            rawResponseMeta: pollData as unknown as Record<string, unknown>,
            durationMs: msElapsed(startMs),
          };
        } else {
          return {
            success: false,
            provider: "google_veo",
            requestId: operationName,
            error: "Veo prediction contains no downloadable video",
            rawResponseMeta: pollData as unknown as Record<string, unknown>,
            durationMs: msElapsed(startMs),
          };
        }

        return {
          success: true,
          videoPath,
          requestId: operationName,
          provider: "google_veo",
          rawResponseMeta: pollData as unknown as Record<string, unknown>,
          durationMs: msElapsed(startMs),
        };
      }
    }

    return {
      success: false,
      provider: "google_veo",
      requestId: operationName,
      error: `Veo operation timed out after ${config.PREMIUM_POLL_TIMEOUT_MS / 1000}s`,
      durationMs: msElapsed(startMs),
    };
  }

  async checkHealth(): Promise<{ healthy: boolean; message?: string }> {
    try {
      await this.getAccessToken();
      return { healthy: true };
    } catch (e) {
      return { healthy: false, message: String(e) };
    }
  }
}
