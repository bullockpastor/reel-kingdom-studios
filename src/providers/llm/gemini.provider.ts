import type { LLMProvider, StoryboardResult } from "./llm-provider.interface.js";
import type { AgentChatProvider, ChatMessage, ChatOptions } from "./agent-chat.interface.js";
import { config } from "../../config.js";

const DEFAULT_MODEL = "gemini-2.0-flash";

export class GeminiProvider implements LLMProvider, AgentChatProvider {
  readonly name = "gemini";
  readonly providerKey = "gemini" as const;

  isAvailable(): boolean {
    return !!config.GEMINI_API_KEY;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    if (!config.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    const model = options?.model ?? DEFAULT_MODEL;
    const systemMsg = messages.find((m) => m.role === "system");
    const userMessages = messages.filter((m) => m.role !== "system");

    const generationConfig: Record<string, unknown> = {
      temperature: options?.temperature ?? 0.7,
    };
    if (options?.outputSchema) {
      generationConfig.responseMimeType = "application/json";
      generationConfig.responseSchema = options.outputSchema;
    }

    const body: Record<string, unknown> = {
      contents: userMessages.map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      })),
      generationConfig,
    };
    if (systemMsg) {
      body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return text;
  }

  async generateStoryboard(): Promise<StoryboardResult> {
    throw new Error("Gemini storyboard generation not implemented. Use STORYBOARD_LLM_PROVIDER=ollama");
  }

  async healthCheck(): Promise<boolean> {
    return this.isAvailable();
  }
}
