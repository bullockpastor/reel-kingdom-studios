import type { LLMProvider, StoryboardResult } from "./llm-provider.interface.js";

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";

  async generateStoryboard(): Promise<StoryboardResult> {
    throw new Error("Gemini provider not yet implemented. Set STORYBOARD_LLM_PROVIDER=ollama");
  }

  async healthCheck(): Promise<boolean> {
    return false;
  }
}
