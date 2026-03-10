export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  model?: string;                          // per-call model override
  outputSchema?: Record<string, unknown>;  // JSON Schema — enforces structured JSON output
}

export interface AgentChatProvider {
  readonly providerKey: "ollama" | "claude" | "gemini";
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
  isAvailable(): boolean;  // sync check: API key / local URL configured
}
