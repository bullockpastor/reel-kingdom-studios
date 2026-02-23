import { z } from "zod";
import { config as dotenv } from "dotenv";

dotenv();

const configSchema = z.object({
  PORT: z.coerce.number().default(8010),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  VIDEO_DB_URL: z.string(),
  STUDIO_ROOT: z.string().default("/Volumes/T9/StudioRoot"),
  REDIS_URL: z.string().default("redis://localhost:6381"),

  COMFYUI_URL: z.string().default("http://127.0.0.1:8188"),

  WAN21_STEPS: z.coerce.number().default(30),
  WAN21_CFG: z.coerce.number().default(6),
  WAN21_SAMPLER: z.string().default("uni_pc"),
  WAN21_DEFAULT_WIDTH: z.coerce.number().default(832),
  WAN21_DEFAULT_HEIGHT: z.coerce.number().default(480),
  WAN21_DEFAULT_FPS: z.coerce.number().default(16),

  STORYBOARD_LLM_PROVIDER: z.enum(["ollama", "claude", "gemini"]).default("ollama"),
  OLLAMA_URL: z.string().default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().default("llama3.2"),

  PREMIUM_PROVIDER: z.enum(["runway", "kling", "pika"]).optional().or(z.literal("")).transform(v => v || undefined),

  FFMPEG_PATH: z.string().default("ffmpeg"),
  DEFAULT_TRANSITION_DURATION: z.coerce.number().default(0.5),
  DEFAULT_OUTPUT_FORMAT: z.enum(["mp4", "webm"]).default("mp4"),

  QC_MAX_FAILURES_BEFORE_PREMIUM: z.coerce.number().default(2),
});

export type Config = z.infer<typeof configSchema>;
export const config: Config = configSchema.parse(process.env);
