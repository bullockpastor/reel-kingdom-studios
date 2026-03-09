import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface WorkflowParams {
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  seed?: number;
  filenamePrefix: string;
  steps?: number;
}

export function buildWan21Workflow(params: WorkflowParams): Record<string, unknown> {
  const templatePath = join(__dirname, "workflows", "wan21-t2v.json");
  const template = readFileSync(templatePath, "utf-8");

  // WAN2.1 latent requires (length - 1) % 4 == 0  (e.g. 1, 5, 9, 13, 17, 21, 25, 29, 33…)
  const rawFrames = Math.round(params.durationSeconds * params.fps);
  const frameCount = Math.max(1, rawFrames - ((rawFrames - 1) % 4));
  const seed = params.seed ?? Math.floor(Math.random() * 2147483647);
  const steps = params.steps ?? config.WAN21_STEPS;

  const workflow = template
    .replace("{{POSITIVE_PROMPT}}", params.prompt.replace(/"/g, '\\"'))
    .replace("{{NEGATIVE_PROMPT}}", params.negativePrompt.replace(/"/g, '\\"'))
    .replace("{{WIDTH}}", String(params.width))
    .replace("{{HEIGHT}}", String(params.height))
    .replace("{{FRAME_COUNT}}", String(frameCount))
    .replace("{{SEED}}", String(seed))
    .replace("{{STEPS}}", String(steps))
    .replace("{{CFG}}", String(config.WAN21_CFG))
    .replace("{{SAMPLER}}", config.WAN21_SAMPLER)
    .replace("{{FPS}}", String(params.fps))
    .replace("{{FILENAME_PREFIX}}", params.filenamePrefix);

  return JSON.parse(workflow);
}
