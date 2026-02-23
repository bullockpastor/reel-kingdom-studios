export interface PremiumRenderRequest {
  shotId: string;
  prompt: string;
  negativePrompt: string;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  aspectRatio: string;
  seed?: number;
  triggerReason: "cinema_mode" | "qc_fail_twice" | "manual";
}

export interface PremiumRenderResult {
  success: boolean;
  filePath?: string;
  requestId: string;
  estimatedCost: number;
  provider: string;
  responseMetadata: Record<string, unknown>;
  error?: string;
}

export interface PremiumProviderParams {
  runway?: { model?: string; mode?: string };
  kling?: { model?: string; mode?: string };
  pika?: { model?: string; style?: string };
}

export interface PremiumRenderer {
  readonly name: string;
  readonly provider: string;
  render(request: PremiumRenderRequest, params?: PremiumProviderParams): Promise<PremiumRenderResult>;
  checkStatus(requestId: string): Promise<{ status: string; progress?: number }>;
  healthCheck(): Promise<boolean>;
}
