import { z } from "zod";

export const storyboardShotSchema = z.object({
  shotIndex: z.number().int().min(0),
  prompt: z.string().min(10),
  negativePrompt: z.string().default(""),
  durationSeconds: z.number().min(1).max(15),
  cameraMotion: z.string(),
  mood: z.string(),
  transitionToNext: z.enum(["crossfade", "cut", "fade_to_black"]),
});

export const storyboardResultSchema = z.object({
  title: z.string().min(1),
  totalDurationSeconds: z.number().min(5).max(120),
  shots: z.array(storyboardShotSchema).min(1).max(12),
  styleNotes: z.string(),
  colorPalette: z.string(),
});

export type StoryboardShotParsed = z.infer<typeof storyboardShotSchema>;
export type StoryboardResultParsed = z.infer<typeof storyboardResultSchema>;

/** JSON Schema representation for Ollama's structured output `format` field */
export const storyboardJsonSchema = {
  type: "object",
  required: ["title", "totalDurationSeconds", "shots", "styleNotes", "colorPalette"],
  properties: {
    title: { type: "string" },
    totalDurationSeconds: { type: "number" },
    styleNotes: { type: "string" },
    colorPalette: { type: "string" },
    shots: {
      type: "array",
      items: {
        type: "object",
        required: [
          "shotIndex",
          "prompt",
          "negativePrompt",
          "durationSeconds",
          "cameraMotion",
          "mood",
          "transitionToNext",
        ],
        properties: {
          shotIndex: { type: "integer" },
          prompt: { type: "string" },
          negativePrompt: { type: "string" },
          durationSeconds: { type: "number" },
          cameraMotion: { type: "string" },
          mood: { type: "string" },
          transitionToNext: {
            type: "string",
            enum: ["crossfade", "cut", "fade_to_black"],
          },
        },
      },
    },
  },
};
