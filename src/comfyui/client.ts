import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

interface OutputFile {
  filename: string;
  subfolder: string;
  type: string;
}

interface NodeOutput {
  images?: OutputFile[];
  videos?: OutputFile[];
  gifs?: OutputFile[];
}

export interface HistoryEntry {
  outputs: Record<string, NodeOutput>;
  status: { status_str: string; completed: boolean };
}

export class ComfyUIClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || config.COMFYUI_URL;
  }

  async queuePrompt(workflow: Record<string, unknown>): Promise<{ promptId: string }> {
    const response = await fetch(`${this.baseUrl}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow, client_id: "video-studio" }),
    });

    if (!response.ok) {
      throw new Error(`ComfyUI /prompt returned ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as { prompt_id: string };
    return { promptId: data.prompt_id };
  }

  async getHistory(promptId: string): Promise<HistoryEntry | null> {
    const response = await fetch(`${this.baseUrl}/history/${promptId}`);
    if (!response.ok) return null;

    const data = (await response.json()) as Record<string, HistoryEntry>;
    return data[promptId] || null;
  }

  async pollUntilComplete(
    promptId: string,
    intervalMs = 5000,
    timeoutMs = config.COMFYUI_RENDER_TIMEOUT_MS
  ): Promise<HistoryEntry> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const history = await this.getHistory(promptId);

      if (history?.status?.completed) {
        return history;
      }

      logger.debug({ promptId, elapsed: Date.now() - start }, "Polling ComfyUI...");
      await new Promise((r) => setTimeout(r, intervalMs));
    }

    throw new Error(`ComfyUI render timed out after ${timeoutMs / 1000}s for prompt ${promptId}`);
  }

  /**
   * Find the first video/image output file from a completed history entry.
   */
  findOutputFile(history: HistoryEntry): OutputFile | null {
    for (const nodeOutput of Object.values(history.outputs)) {
      // Check videos first (SaveVideo, SaveWEBM)
      if (nodeOutput.videos && nodeOutput.videos.length > 0) {
        return nodeOutput.videos[0];
      }
      // Fall back to gifs/images (SaveAnimatedWEBP, etc.)
      if (nodeOutput.gifs && nodeOutput.gifs.length > 0) {
        return nodeOutput.gifs[0];
      }
      if (nodeOutput.images && nodeOutput.images.length > 0) {
        return nodeOutput.images[0];
      }
    }
    return null;
  }

  async downloadOutput(filename: string, subfolder: string, outputDir: string): Promise<string> {
    const url = `${this.baseUrl}/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}&type=output`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`ComfyUI /view returned ${response.status}`);
    }

    await mkdir(outputDir, { recursive: true });
    const buffer = Buffer.from(await response.arrayBuffer());
    const outputPath = join(outputDir, filename);
    await writeFile(outputPath, buffer);
    return outputPath;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/queue`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async getQueue(): Promise<{ queue_running: unknown[]; queue_pending: unknown[] }> {
    const response = await fetch(`${this.baseUrl}/queue`);
    if (!response.ok) throw new Error(`ComfyUI /queue returned ${response.status}`);
    return (await response.json()) as { queue_running: unknown[]; queue_pending: unknown[] };
  }

  async interrupt(): Promise<void> {
    await fetch(`${this.baseUrl}/interrupt`, { method: "POST" });
  }
}
