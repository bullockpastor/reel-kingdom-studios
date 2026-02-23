export interface RenderRequest {
  shotId: string;
  prompt: string;
  negativePrompt: string;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  steps?: number;
  seed?: number;
  outputDir: string;
  filenamePrefix: string;
}

export interface RenderResult {
  success: boolean;
  filePath?: string;
  promptId?: string;
  durationMs: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface VideoRenderer {
  readonly name: string;
  readonly engine: string;
  render(request: RenderRequest): Promise<RenderResult>;
  healthCheck(): Promise<boolean>;
}
