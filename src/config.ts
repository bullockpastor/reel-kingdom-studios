import { z } from "zod";
import { config as dotenv } from "dotenv";

dotenv();

const configSchema = z.object({
  PORT: z.coerce.number().default(8010),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  VIDEO_DB_URL: z.string(),
  STUDIO_ROOT: z.string().default("/Volumes/T9/ReelKingdomStudios"),
  REDIS_URL: z.string().default("redis://localhost:6381"),

  COMFYUI_URL: z.string().default("http://127.0.0.1:8188"),

  WAN21_STEPS: z.coerce.number().default(30),
  WAN21_CFG: z.coerce.number().default(6),
  WAN21_SAMPLER: z.string().default("euler"),
  WAN21_DEFAULT_WIDTH: z.coerce.number().default(832),
  WAN21_DEFAULT_HEIGHT: z.coerce.number().default(480),
  WAN21_DEFAULT_FPS: z.coerce.number().default(16),

  STORYBOARD_LLM_PROVIDER: z.enum(["ollama", "claude", "gemini"]).default("ollama"),
  OLLAMA_URL: z.string().default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().default("llama3.2"),
  OLLAMA_API_KEY: z.string().optional(),

  PREMIUM_VIDEO_PROVIDER: z
    .enum(["openai_sora", "runway_gen4", "kling_video", "google_veo"])
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),

  // OpenAI Sora
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_VIDEO_MODEL: z.string().default("sora-2"),

  // Runway Gen4
  RUNWAY_API_KEY: z.string().optional(),
  RUNWAY_VIDEO_MODEL: z.string().default("gen4.5"),

  // Kling Video
  KLING_API_KEY: z.string().optional(),
  KLING_VIDEO_MODEL: z.string().default("kling-v1"),

  // Google Veo (Vertex AI)
  GOOGLE_VEO_MODEL: z.string().default("veo-2.0-generate-001"),
  GOOGLE_VERTEX_PROJECT: z.string().optional(),
  GOOGLE_VERTEX_LOCATION: z.string().default("us-central1"),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),

  FFMPEG_PATH: z.string().default("ffmpeg"),
  DEFAULT_TRANSITION_DURATION: z.coerce.number().default(0.5),
  DEFAULT_OUTPUT_FORMAT: z.enum(["mp4", "webm"]).default("mp4"),

  QC_MAX_FAILURES_BEFORE_PREMIUM: z.coerce.number().default(2),

  // Visual QC (vision model for frame-based quality check)
  VISUAL_QC_PROVIDER: z.enum(["openai", "anthropic", "google"]).optional().or(z.literal("")).transform((v) => v || undefined),
  VISUAL_QC_MODEL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  PREMIUM_POLL_TIMEOUT_MS: z.coerce.number().default(600_000),

  // Audio (TTS, music)
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().default("21m00Tcm4TlvDq8ikWAM"), // Rachel
  AUDIO_LIBRARY_PATH: z.string().optional(),

  // Cost caps (optional, reject/warn premium when exceeded)
  PREMIUM_MONTHLY_CAP: z.coerce.number().optional(),
  PREMIUM_PROJECT_CAP: z.coerce.number().optional(),
});

export type Config = z.infer<typeof configSchema>;
export const config: Config = configSchema.parse(process.env);

export const STUDIO_NAME = "Reel Kingdom Studios";
export const STUDIO_TAGLINE = "Local-First Cinematic Intelligence Platform";
export const STUDIO_VERSION = "0.1.0";
