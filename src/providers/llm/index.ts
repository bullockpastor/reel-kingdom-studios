import type { LLMProvider } from "./llm-provider.interface.js";
import { OllamaProvider } from "./ollama.provider.js";
import { ClaudeProvider } from "./claude.provider.js";
import { GeminiProvider } from "./gemini.provider.js";
import { config } from "../../config.js";

let provider: LLMProvider | undefined;

export function getLLMProvider(): LLMProvider {
  if (!provider) {
    switch (config.STORYBOARD_LLM_PROVIDER) {
      case "ollama":
        provider = new OllamaProvider();
        break;
      case "claude":
        provider = new ClaudeProvider();
        break;
      case "gemini":
        provider = new GeminiProvider();
        break;
    }
  }
  return provider;
}

export type { LLMProvider, StoryboardResult } from "./llm-provider.interface.js";
