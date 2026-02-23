import { getLLMProvider } from "../providers/llm/index.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

export interface AgentDefinition {
  name: string;
  systemPrompt: string;
  outputSchema?: Record<string, unknown>; // JSON Schema for Ollama structured output
  temperature?: number;
}

export interface AgentRunResult {
  agentName: string;
  rawOutput: string;
  parsed: unknown;
  durationMs: number;
}

/**
 * Run a single agent: sends systemPrompt + userInput to the LLM and returns the response.
 * If outputSchema is provided, Ollama's `format` param constrains the output to valid JSON.
 */
export async function runAgent(
  agent: AgentDefinition,
  userInput: string
): Promise<AgentRunResult> {
  const start = Date.now();

  logger.info({ agent: agent.name }, `Running agent: ${agent.name}`);

  const ollamaUrl = config.OLLAMA_URL;
  const model = config.OLLAMA_MODEL;

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: agent.systemPrompt },
      { role: "user", content: userInput },
    ],
    stream: false,
    options: { temperature: agent.temperature ?? 0.7 },
  };

  if (agent.outputSchema) {
    body.format = agent.outputSchema;
  }

  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as { message?: { content?: string } };
  const rawOutput = data.message?.content || "";
  const durationMs = Date.now() - start;

  let parsed: unknown = rawOutput;
  if (agent.outputSchema) {
    try {
      parsed = JSON.parse(rawOutput);
    } catch {
      logger.warn({ agent: agent.name }, "Failed to parse agent output as JSON");
    }
  }

  logger.info({ agent: agent.name, durationMs }, `Agent ${agent.name} completed`);

  return { agentName: agent.name, rawOutput, parsed, durationMs };
}

/**
 * Run a pipeline of agents in sequence.
 * Each agent receives the previous agent's output as its user input.
 */
export async function runPipeline(
  agents: AgentDefinition[],
  initialInput: string
): Promise<AgentRunResult[]> {
  const results: AgentRunResult[] = [];
  let currentInput = initialInput;

  for (const agent of agents) {
    const result = await runAgent(agent, currentInput);
    results.push(result);
    currentInput = result.rawOutput;
  }

  return results;
}
