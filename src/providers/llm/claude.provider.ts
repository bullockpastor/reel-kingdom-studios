import type { LLMProvider, StoryboardResult } from "./llm-provider.interface.js";

export class ClaudeProvider implements LLMProvider {
  readonly name = "claude";

  async generateStoryboard(): Promise<StoryboardResult> {
    throw new Error("Claude provider not yet implemented. Set STORYBOARD_LLM_PROVIDER=ollama");
  }

  async healthCheck(): Promise<boolean> {
    return false;
  }
}
