import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const execFileAsync = promisify(execFile);

const TRANSITION_MAP: Record<string, string> = {
  crossfade: "fade",
  cut: "fade",
  fade_to_black: "fadeblack",
  wipe: "wipeleft",
};

export interface AssemblyShot {
  filePath: string;
  durationSeconds: number;
  trimStart: number;
  trimEnd: number;
  transitionType: string;
  transitionDuration: number;
  speedFactor: number;
  reframeFocus: string;   // center | left | right | upper | lower
  reframePan: string;     // none | slow_ltr | slow_rtl
}

export interface AssemblyOptions {
  shots: AssemblyShot[];
  outputPath: string;
  outputFormat: "mp4" | "webm";
  targetWidth: number;
  targetHeight: number;
  nativeWidth: number;    // Wan2.1 render width (e.g. 832)
  nativeHeight: number;   // Wan2.1 render height (e.g. 480)
}

/**
 * Build a reframe crop+pan filter for a single shot.
 * Returns an FFmpeg filter expression like:
 *   crop=w:h:x_expr:y_expr
 *
 * For static crops (pan=none), x and y are constant.
 * For panning crops (slow_ltr/slow_rtl), x animates over time.
 */
function buildReframeFilter(
  nativeW: number,
  nativeH: number,
  targetW: number,
  targetH: number,
  focus: string,
  pan: string,
  durationSeconds: number,
  fps: number = 16
): string | null {
  const targetRatio = targetW / targetH;
  const nativeRatio = nativeW / nativeH;

  // If aspect ratios match (within tolerance), no reframing needed
  if (Math.abs(targetRatio - nativeRatio) < 0.05) return null;

  let cropW: number;
  let cropH: number;

  if (targetRatio < nativeRatio) {
    // Target is taller (e.g. 9:16 from 16:9) — crop width
    cropH = nativeH;
    cropW = Math.round(nativeH * targetRatio);
  } else {
    // Target is wider — crop height
    cropW = nativeW;
    cropH = Math.round(nativeW / targetRatio);
  }

  // Ensure even dimensions
  cropW = cropW - (cropW % 2);
  cropH = cropH - (cropH % 2);

  const maxX = nativeW - cropW;
  const maxY = nativeH - cropH;

  // Calculate static Y position based on focus
  let yPos: number;
  switch (focus) {
    case "upper":
      yPos = 0;
      break;
    case "lower":
      yPos = maxY;
      break;
    default: // center, left, right
      yPos = Math.round(maxY / 2);
      break;
  }

  // Calculate X position (static or animated)
  if (pan === "none") {
    let xPos: number;
    switch (focus) {
      case "left":
        xPos = 0;
        break;
      case "right":
        xPos = maxX;
        break;
      default: // center, upper, lower
        xPos = Math.round(maxX / 2);
        break;
    }
    return `crop=${cropW}:${cropH}:${xPos}:${yPos}`;
  }

  // Animated pan: x moves from start to end over the shot duration
  const totalFrames = Math.round(durationSeconds * fps);
  if (pan === "slow_ltr") {
    // Left to right: x goes from 0 to maxX
    return `crop=${cropW}:${cropH}:'min(${maxX}\\,floor(n*${maxX}/${totalFrames}))':${yPos}`;
  } else {
    // Right to left: x goes from maxX to 0
    return `crop=${cropW}:${cropH}:'max(0\\,${maxX}-floor(n*${maxX}/${totalFrames}))':${yPos}`;
  }
}

export async function assembleVideo(options: AssemblyOptions): Promise<void> {
  const { shots, outputPath, targetWidth, targetHeight, nativeWidth, nativeHeight } = options;

  if (shots.length === 0) throw new Error("No shots to assemble");

  const needsReframe = Math.abs(targetWidth / targetHeight - nativeWidth / nativeHeight) >= 0.05;

  if (shots.length === 1) {
    const s = shots[0];
    const filters: string[] = [];

    if (needsReframe) {
      const reframe = buildReframeFilter(
        nativeWidth, nativeHeight, targetWidth, targetHeight,
        s.reframeFocus, s.reframePan, s.durationSeconds
      );
      if (reframe) filters.push(reframe);
      filters.push(`scale=${targetWidth}:${targetHeight}`);
    }

    const args = ["-i", s.filePath];
    if (filters.length > 0) {
      args.push("-vf", filters.join(","));
    }
    args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", outputPath);
    await execFileAsync(config.FFMPEG_PATH, args, { timeout: 120000 });
    return;
  }

  // Multi-shot: build per-shot reframe filters, then xfade chain
  const inputs: string[] = [];
  const preFilters: string[] = [];

  for (let i = 0; i < shots.length; i++) {
    inputs.push("-i", shots[i].filePath);

    if (needsReframe) {
      const reframe = buildReframeFilter(
        nativeWidth, nativeHeight, targetWidth, targetHeight,
        shots[i].reframeFocus, shots[i].reframePan, shots[i].durationSeconds
      );
      const filters = [];
      if (reframe) filters.push(reframe);
      filters.push(`scale=${targetWidth}:${targetHeight}`);
      preFilters.push(`[${i}:v]${filters.join(",")}[r${i}]`);
    }
  }

  // Build xfade chain
  const xfadeParts: string[] = [];
  let cumulativeOffset = 0;

  for (let i = 0; i < shots.length - 1; i++) {
    const transition = TRANSITION_MAP[shots[i].transitionType] || "fade";
    const dur = shots[i].transitionType === "cut" ? 0 : shots[i].transitionDuration;
    const inputLabel = needsReframe ? `[r${i}]` : `[${i}:v]`;
    const inputA = i === 0 ? inputLabel : `[v${i}]`;
    const inputB = needsReframe ? `[r${i + 1}]` : `[${i + 1}:v]`;
    const outputLabel = i === shots.length - 2 ? "[vfinal]" : `[v${i + 1}]`;

    const effectiveDuration =
      (shots[i].durationSeconds - shots[i].trimStart - shots[i].trimEnd) / shots[i].speedFactor;
    cumulativeOffset += effectiveDuration - dur;

    xfadeParts.push(
      `${inputA}${inputB}xfade=transition=${transition}:duration=${dur}:offset=${cumulativeOffset.toFixed(3)}${outputLabel}`
    );
  }

  const filterComplex = [...preFilters, ...xfadeParts].join(";");

  const args = [
    ...inputs,
    "-filter_complex",
    filterComplex,
    "-map",
    "[vfinal]",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-y",
    outputPath,
  ];

  logger.info({ outputPath, shotCount: shots.length, needsReframe }, "Running FFmpeg assembly");

  try {
    const { stderr } = await execFileAsync(config.FFMPEG_PATH, args, { timeout: 180000 });
    if (stderr) logger.debug({ stderr }, "FFmpeg stderr");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`FFmpeg assembly failed: ${message}`);
  }
}
