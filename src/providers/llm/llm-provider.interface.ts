export interface StoryboardShot {
  shotIndex: number;
  prompt: string;
  negativePrompt: string;
  durationSeconds: number;
  cameraMotion: string;
  mood: string;
  transitionToNext: "crossfade" | "cut" | "fade_to_black";
}

export interface StoryboardResult {
  title: string;
  totalDurationSeconds: number;
  shots: StoryboardShot[];
  styleNotes: string;
  colorPalette: string;
}

export interface LLMProvider {
  readonly name: string;

  generateStoryboard(
    idea: string,
    shotCount: { min: number; max: number },
    totalDuration: { min: number; max: number }
  ): Promise<StoryboardResult>;

  healthCheck(): Promise<boolean>;
}
