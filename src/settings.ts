/**
 * Lightweight studio settings — persisted to STUDIO_ROOT/settings.json.
 * Used for user-configurable defaults that don't belong in .env
 * (e.g. which premium provider is the presenter default).
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { config } from "./config.js";

export interface StudioSettings {
  /** Default provider for new presenter projects */
  presenterDefaultProvider?: string;
  /** Fallback premium provider when the primary fails */
  premiumFallbackProvider?: string;
}

const SETTINGS_PATH = join(config.STUDIO_ROOT, "settings.json");

export function readSettings(): StudioSettings {
  if (!existsSync(SETTINGS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(SETTINGS_PATH, "utf-8")) as StudioSettings;
  } catch {
    return {};
  }
}

export function writeSettings(updates: Partial<StudioSettings>): StudioSettings {
  const current = readSettings();
  const next = { ...current, ...updates };
  writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2));
  return next;
}
