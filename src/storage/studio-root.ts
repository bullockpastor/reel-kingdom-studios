import { mkdirSync, accessSync, constants } from "node:fs";
import { join } from "node:path";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

export function ensureStudioRoot(): void {
  try {
    accessSync(config.STUDIO_ROOT, constants.W_OK);
  } catch {
    throw new Error(
      `STUDIO_ROOT ${config.STUDIO_ROOT} does not exist or is not writable. Please mount the drive.`
    );
  }
  logger.info(`STUDIO_ROOT verified: ${config.STUDIO_ROOT}`);
}

export function ensureProjectDirs(projectId: string): {
  shotsDir: string;
  outputDir: string;
} {
  const shotsDir = join(config.STUDIO_ROOT, projectId, "shots");
  const outputDir = join(config.STUDIO_ROOT, projectId, "output");
  mkdirSync(shotsDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });
  return { shotsDir, outputDir };
}

export function projectShotsDir(projectId: string): string {
  return join(config.STUDIO_ROOT, projectId, "shots");
}

export function projectOutputDir(projectId: string): string {
  return join(config.STUDIO_ROOT, projectId, "output");
}

export function ensurePresenterDirs(presenterId: string): { referenceDir: string } {
  const referenceDir = join(config.STUDIO_ROOT, "presenters", presenterId, "reference");
  mkdirSync(referenceDir, { recursive: true });
  return { referenceDir };
}

export function shotRenderDir(
  projectId: string,
  shotId: string,
  tier: "draft" | "final" = "draft"
): string {
  const dir = join(config.STUDIO_ROOT, projectId, "shots", shotId, "renders", tier);
  mkdirSync(dir, { recursive: true });
  return dir;
}
