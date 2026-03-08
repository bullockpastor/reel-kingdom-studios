import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";

export async function downloadVideoFile(
  url: string,
  outputDir: string,
  filenamePrefix: string,
  ext = "mp4"
): Promise<string> {
  await mkdir(outputDir, { recursive: true });
  const filename = `${filenamePrefix}_${Date.now()}.${ext}`;
  const filePath = path.join(outputDir, filename);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status} from ${url}`);
  }
  if (!response.body) {
    throw new Error("Response body is empty");
  }

  const writer = createWriteStream(filePath);
  await pipeline(
    Readable.fromWeb(response.body as import("node:stream/web").ReadableStream),
    writer
  );
  return filePath;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function msElapsed(startMs: number): number {
  return Date.now() - startMs;
}
