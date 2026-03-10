import { resolveAgentRoute, getProviderInstance } from "../services/model-router.service.js";
import { logger } from "../utils/logger.js";

export interface AgentDefinition {
  name: string;
  systemPrompt: string;
  outputSchema?: Record<string, unknown>; // JSON Schema for structured output
  temperature?: number;
}

export interface AgentRunResult {
  agentName: string;
  rawOutput: string;
  parsed: unknown;
  durationMs: number;
}

/**
 * Run a single agent: sends systemPrompt + userInput to the routed LLM provider.
 * The provider is determined by the Model Router (settings.json overrides → static defaults → Ollama fallback).
 */
export async function runAgent(
  agent: AgentDefinition,
  userInput: string
): Promise<AgentRunResult> {
  const start = Date.now();

  const route = resolveAgentRoute(agent.name);
  const llm = getProviderInstance(route);

  logger.info(
    { agent: agent.name, provider: route.provider, model: route.model, reason: route.reason },
    `Running agent: ${agent.name} via ${route.provider}`
  );

  const rawOutput = await llm.chat(
    [
      { role: "system", content: agent.systemPrompt },
      { role: "user", content: userInput },
    ],
    {
      temperature: agent.temperature,
      outputSchema: agent.outputSchema,
      model: route.model,
    }
  );

  const durationMs = Date.now() - start;

  let parsed: unknown = rawOutput;
  if (agent.outputSchema) {
    try {
      parsed = JSON.parse(rawOutput);
    } catch {
      logger.warn({ agent: agent.name }, "Failed to parse agent output as JSON");
    }
  }

  logger.info({ agent: agent.name, provider: route.provider, durationMs }, `Agent ${agent.name} completed`);

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
