export type PremiumProvider = "openai_sora" | "runway_gen4" | "kling_video" | "google_veo";

export interface PremiumRenderRequest {
  shotId: string;
  prompt: string;
  negativePrompt?: string;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  aspectRatio?: string;
  seed?: number;
  outputDir: string;
  filenamePrefix: string;
  triggerReason?: "cinema_mode" | "qc_fail_twice" | "manual";
}

export interface PremiumRenderResult {
  success: boolean;
  videoPath?: string;        // local path to the downloaded video
  requestId?: string;        // provider's job/task ID
  costEstimate?: number;     // estimated cost in USD
  provider: PremiumProvider;
  rawResponseMeta?: Record<string, unknown>;
  error?: string;
  durationMs?: number;
}

export interface PremiumRenderCapabilities {
  maxDurationSeconds: number;
  supportedResolutions: Array<{ width: number; height: number }>;
  supportedAspectRatios: string[];
  supportsNegativePrompt: boolean;
  supportsSeed: boolean;
}

export interface PremiumProviderConfig {
  provider: PremiumProvider;
  capabilities: PremiumRenderCapabilities;
}
