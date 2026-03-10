import type { LLMProvider, StoryboardResult } from "./llm-provider.interface.js";
import type { AgentChatProvider, ChatMessage, ChatOptions } from "./agent-chat.interface.js";
import { config } from "../../config.js";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

export class ClaudeProvider implements LLMProvider, AgentChatProvider {
  readonly name = "claude";
  readonly providerKey = "claude" as const;

  isAvailable(): boolean {
    return !!config.ANTHROPIC_API_KEY;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    if (!config.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const model = options?.model ?? DEFAULT_MODEL;
    const systemMsg = messages.find((m) => m.role === "system");
    const userMessages = messages.filter((m) => m.role !== "system");

    const baseBody: Record<string, unknown> = {
      model,
      max_tokens: 4096,
      messages: userMessages.map((m) => ({ role: m.role, content: m.content })),
      temperature: options?.temperature ?? 0.7,
    };
    if (systemMsg) {
      baseBody.system = systemMsg.content;
    }

    // Structured output: force JSON via tool_use
    if (options?.outputSchema) {
      const body = {
        ...baseBody,
        tools: [
          {
            name: "respond",
            description: "Output the structured response as JSON",
            input_schema: options.outputSchema,
          },
        ],
        tool_choice: { type: "tool", name: "respond" },
      };

      const res = await fetch(ANTHROPIC_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
      }

      const data = (await res.json()) as {
        content: Array<{ type: string; name?: string; input?: unknown; text?: string }>;
      };
      const toolBlock = data.content.find((b) => b.type === "tool_use" && b.name === "respond");
      if (!toolBlock?.input) {
        throw new Error("Claude returned no tool_use block");
      }
      return JSON.stringify(toolBlock.input);
    }

    // Plain text output
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(baseBody),
    });

    if (!res.ok) {
      throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
    };
    const textBlock = data.content.find((b) => b.type === "text");
    return textBlock?.text ?? "";
  }

  async generateStoryboard(): Promise<StoryboardResult> {
    throw new Error("Claude storyboard generation not implemented. Use STORYBOARD_LLM_PROVIDER=ollama");
  }

  async healthCheck(): Promise<boolean> {
    return this.isAvailable();
  }
}
