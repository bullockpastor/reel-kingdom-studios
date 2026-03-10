/**
 * Extract sample frames from a video file using FFmpeg.
 * Used for vision-based QC (sending frames to GPT-4V, Claude, etc.)
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { config } from "../config.js";

const execFileAsync = promisify(execFile);

export interface ExtractedFrame {
  /** Path to the extracted image file (PNG) */
  filePath: string;
  /** Timestamp in seconds where this frame was taken */
  timestampSeconds: number;
  /** Base64-encoded image data for API submission */
  base64: string;
}

/**
 * Extract N frames from a video at evenly distributed timestamps.
 * Returns base64-encoded PNGs suitable for vision APIs.
 */
export async function extractFrames(
  videoPath: string,
  outputDir: string,
  count: number = 3
): Promise<ExtractedFrame[]> {
  if (!existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }

  mkdirSync(outputDir, { recursive: true });

  // Get duration via ffprobe
  const ffprobePath = config.FFMPEG_PATH.replace(/ffmpeg$/i, "ffprobe");
  const { stdout: probeOut } = await execFileAsync(ffprobePath || "ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "csv=p=0",
    videoPath,
  ]);
  const durationSec = parseFloat(probeOut.trim()) || 5;

  const frames: ExtractedFrame[] = [];
  const step = durationSec > 0 ? durationSec / (count + 1) : 1;

  for (let i = 1; i <= count; i++) {
    const ts = Math.min(step * i, durationSec - 0.1);
    const filename = `frame_${i}_${Math.round(ts * 100)}.png`;
    const outPath = join(outputDir, filename);

    await execFileAsync(config.FFMPEG_PATH, [
      "-ss",
      String(ts),
      "-i",
      videoPath,
      "-vframes",
      "1",
      "-y",
      outPath,
    ], { timeout: 10000 });

    if (existsSync(outPath)) {
      const buf = readFileSync(outPath);
      frames.push({
        filePath: outPath,
        timestampSeconds: ts,
        base64: buf.toString("base64"),
      });
    }
  }

  return frames;
}
