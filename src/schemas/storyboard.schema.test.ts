import { describe, it, expect } from "vitest";
import { storyboardResultSchema, storyboardShotSchema } from "./storyboard.schema.js";

describe("storyboardResultSchema", () => {
  it("accepts valid storyboard JSON", () => {
    const valid = {
      title: "Test Video",
      totalDurationSeconds: 30,
      shots: [
        {
          shotIndex: 0,
          prompt: "A woman walking through a neon-lit Tokyo alley at night",
          negativePrompt: "blurry, low quality",
          durationSeconds: 5,
          cameraMotion: "slow dolly forward",
          mood: "mysterious",
          transitionToNext: "crossfade" as const,
        },
      ],
      styleNotes: "Neon noir",
      colorPalette: "Blue and purple accents",
    };
    const result = storyboardResultSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects when shots array is empty", () => {
    const invalid = {
      title: "Test",
      totalDurationSeconds: 10,
      shots: [],
      styleNotes: "",
      colorPalette: "",
    };
    const result = storyboardResultSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects when prompt is too short", () => {
    const invalid = {
      title: "Test",
      totalDurationSeconds: 10,
      shots: [
        {
          shotIndex: 0,
          prompt: "short",
          negativePrompt: "",
          durationSeconds: 3,
          cameraMotion: "static",
          mood: "neutral",
          transitionToNext: "cut" as const,
        },
      ],
      styleNotes: "",
      colorPalette: "",
    };
    const result = storyboardResultSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects invalid transitionToNext", () => {
    const invalid = {
      title: "Test",
      totalDurationSeconds: 10,
      shots: [
        {
          shotIndex: 0,
          prompt: "A valid long prompt for the shot",
          negativePrompt: "",
          durationSeconds: 3,
          cameraMotion: "static",
          mood: "neutral",
          transitionToNext: "invalid_transition",
        },
      ],
      styleNotes: "",
      colorPalette: "",
    };
    const result = storyboardResultSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects durationSeconds over 15 per shot", () => {
    const withLongShot = {
      title: "Test",
      totalDurationSeconds: 60,
      shots: [
        {
          shotIndex: 0,
          prompt: "A valid long prompt for the shot",
          negativePrompt: "",
          durationSeconds: 20, // max is 15
          cameraMotion: "static",
          mood: "neutral",
          transitionToNext: "cut" as const,
        },
      ],
      styleNotes: "",
      colorPalette: "",
    };
    const result = storyboardResultSchema.safeParse(withLongShot);
    expect(result.success).toBe(false);
  });
});

describe("storyboardShotSchema", () => {
  it("defaults negativePrompt to empty string", () => {
    const shot = {
      shotIndex: 0,
      prompt: "A valid prompt with enough characters",
      durationSeconds: 3,
      cameraMotion: "static",
      mood: "neutral",
      transitionToNext: "cut" as const,
    };
    const result = storyboardShotSchema.safeParse(shot);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.negativePrompt).toBe("");
    }
  });
});
