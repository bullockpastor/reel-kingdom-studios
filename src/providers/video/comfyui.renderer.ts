import type { VideoRenderer, RenderRequest, RenderResult } from "./video-renderer.interface.js";
import { ComfyUIClient } from "../../comfyui/client.js";
import { buildWan21Workflow } from "../../comfyui/workflow-builder.js";
import { logger } from "../../utils/logger.js";

export class ComfyUIRenderer implements VideoRenderer {
  readonly name = "ComfyUI Wan2.1";
  readonly engine = "comfyui";
  private client: ComfyUIClient;

  constructor() {
    this.client = new ComfyUIClient();
  }

  async render(request: RenderRequest): Promise<RenderResult> {
    const start = Date.now();

    try {
      const workflow = buildWan21Workflow({
        prompt: request.prompt,
        negativePrompt: request.negativePrompt,
        width: request.width,
        height: request.height,
        fps: request.fps,
        durationSeconds: request.durationSeconds,
        seed: request.seed,
        steps: request.steps,
        filenamePrefix: request.filenamePrefix,
      });

      logger.info({ shotId: request.shotId }, "Queueing ComfyUI render");
      const { promptId } = await this.client.queuePrompt(workflow);

      logger.info({ shotId: request.shotId, promptId }, "Polling for completion");
      const history = await this.client.pollUntilComplete(promptId);

      // Find the output file (videos from SaveVideo, or images from SaveAnimatedWEBP)
      const outputFile = this.client.findOutputFile(history);

      if (!outputFile) {
        throw new Error("ComfyUI completed but produced no output files");
      }

      const { filename, subfolder } = outputFile;
      const filePath = await this.client.downloadOutput(filename, subfolder, request.outputDir);

      const durationMs = Date.now() - start;
      logger.info({ shotId: request.shotId, filePath, durationMs }, "Render complete");

      return { success: true, filePath, promptId, durationMs };
    } catch (err) {
      const durationMs = Date.now() - start;
      const error = err instanceof Error ? err.message : String(err);
      logger.error({ shotId: request.shotId, error }, "Render failed");
      return { success: false, durationMs, error };
    }
  }

  async healthCheck(): Promise<boolean> {
    return this.client.healthCheck();
  }
}
