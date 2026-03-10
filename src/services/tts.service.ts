/**
 * Text-to-speech service for presenter pipeline.
 * Uses ElevenLabs API when ELEVENLABS_API_KEY is set.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

export interface TTSOptions {
  voiceId: string;
  text: string;
  outputPath: string;
  stability?: number;
  similarityBoost?: number;
}

/**
 * Generate speech from text and save to file.
 * Returns the path to the generated audio file, or null if TTS is not configured.
 */
export async function generateTTS(options: TTSOptions): Promise<string | null> {
  const apiKey = config.ELEVENLABS_API_KEY;
  if (!apiKey) {
    logger.debug("TTS skipped: ELEVENLABS_API_KEY not set");
    return null;
  }

  const { voiceId, text, outputPath, stability = 0.5, similarityBoost = 0.75 } = options;
  mkdirSync(join(outputPath, ".."), { recursive: true });

  const resp = await fetch(
    `${ELEVENLABS_BASE}/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_monolingual_v1",
        voice_settings: { stability, similarity_boost: similarityBoost },
      }),
    }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`ElevenLabs TTS failed: HTTP ${resp.status} — ${errText}`);
  }

  const arrayBuffer = await resp.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  writeFileSync(outputPath, buffer);
  logger.info({ outputPath, voiceId, textLen: text.length }, "TTS generated");
  return outputPath;
}

/**
 * Generate TTS for multiple segments and return paths with timings.
 */
export async function generateTTSSegments(
  segments: Array<{ index: number; text: string; startOffsetSeconds?: number }>,
  voiceId: string,
  outputDir: string,
  filenamePrefix: string
): Promise<Array<{ index: number; path: string }>> {
  const results: Array<{ index: number; path: string }> = [];
  for (const seg of segments) {
    const path = join(outputDir, `${filenamePrefix}_seg${seg.index}.mp3`);
    const out = await generateTTS({ voiceId, text: seg.text, outputPath: path });
    if (out) results.push({ index: seg.index, path: out });
  }
  return results;
}

interface DirectedSegment {
  index: number;
  text: string;
  beatTimingSeconds?: number;
  pauseBefore?: number;
  pauseAfter?: number;
}

/**
 * Generate TTS for a presenter project from its directed script.
 * Concatenates all segment texts and returns a single audio file path.
 * Returns null if TTS is not configured or voiceId is missing.
 */
export async function preparePresenterTTS(
  projectId: string,
  directedScriptJson: string,
  voiceId: string,
  outputPath: string
): Promise<string | null> {
  if (!config.ELEVENLABS_API_KEY) {
    logger.debug("Presenter TTS skipped: ELEVENLABS_API_KEY not set");
    return null;
  }
  if (!voiceId?.trim()) return null;

  let segments: DirectedSegment[];
  try {
    const parsed = JSON.parse(directedScriptJson) as { segments?: DirectedSegment[] };
    segments = Array.isArray(parsed?.segments) ? parsed.segments : [];
  } catch {
    logger.warn({ projectId }, "Invalid directedScript JSON for TTS");
    return null;
  }

  if (segments.length === 0) return null;

  const fullText = segments
    .sort((a, b) => a.index - b.index)
    .map((s) => s.text.trim())
    .filter(Boolean)
    .join(" ");

  if (!fullText) return null;

  return generateTTS({
    voiceId,
    text: fullText,
    outputPath,
  });
}
