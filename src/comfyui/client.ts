import { config } from "../config.js";
import { logger } from "../utils/logger.js";

interface HistoryEntry {
  outputs: Record<string, { images?: Array<{ filename: string; subfolder: string; type: string }> }>;
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
    timeoutMs = 600000
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

  async downloadOutput(filename: string, subfolder: string, outputDir: string): Promise<string> {
    const url = `${this.baseUrl}/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}&type=output`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`ComfyUI /view returned ${response.status}`);
    }

    const { writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const buffer = Buffer.from(await response.arrayBuffer());
    const outputPath = join(outputDir, filename);
    await writeFile(outputPath, buffer);
    return outputPath;
  }

  async getSystemStats(): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseUrl}/system_stats`);
    if (!response.ok) throw new Error(`ComfyUI /system_stats returned ${response.status}`);
    return (await response.json()) as Record<string, unknown>;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/system_stats`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async interrupt(): Promise<void> {
    await fetch(`${this.baseUrl}/interrupt`, { method: "POST" });
  }
}
