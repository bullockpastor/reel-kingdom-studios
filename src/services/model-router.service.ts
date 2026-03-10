import type { AgentChatProvider } from "../providers/llm/agent-chat.interface.js";
import { OllamaProvider } from "../providers/llm/ollama.provider.js";
import { ClaudeProvider } from "../providers/llm/claude.provider.js";
import { GeminiProvider } from "../providers/llm/gemini.provider.js";
import { readSettings, writeSettings } from "../settings.js";
import { logger } from "../utils/logger.js";

export interface AgentRoute {
  provider: "ollama" | "claude" | "gemini";
  model?: string;
}

export interface ResolvedRoute extends AgentRoute {
  agentName: string;
  reason: "default" | "override" | "fallback";
  fallbackUsed: boolean;
}

export interface RouteTableEntry {
  agentName: string;
  defaultRoute: AgentRoute;
  override: AgentRoute | null;
  effectiveRoute: AgentRoute;
  reason: "default" | "override" | "fallback";
  fallbackUsed: boolean;
  providerAvailable: boolean;
}

// Static defaults — tuned for each agent's task type
const DEFAULT_ROUTES: Record<string, AgentRoute> = {
  "Intent Interpreter":   { provider: "ollama" },
  "Storyboard Generator": { provider: "ollama" },
  "Prompt Compiler":      { provider: "ollama" },
  "Safety & IP Guard":    { provider: "claude" },
  "Render Orchestrator":  { provider: "ollama" },
  "Visual QC":            { provider: "ollama" },
  "Editor / Assembler":   { provider: "claude" },
  "Script Director":      { provider: "claude" },
  "Performance Director": { provider: "claude" },
};

// Provider singletons
const providers: Record<"ollama" | "claude" | "gemini", AgentChatProvider> = {
  ollama: new OllamaProvider(),
  claude: new ClaudeProvider(),
  gemini: new GeminiProvider(),
};

export function resolveAgentRoute(agentName: string): ResolvedRoute {
  const defaultRoute: AgentRoute = DEFAULT_ROUTES[agentName] ?? { provider: "ollama" };
  const settings = readSettings();
  const override = settings.agentRoutes?.[agentName] ?? null;

  const candidate: AgentRoute = override ?? defaultRoute;
  const reason: "default" | "override" = override ? "override" : "default";

  const candidateProvider = providers[candidate.provider];
  if (!candidateProvider.isAvailable()) {
    logger.warn(
      { agentName, configured: candidate.provider },
      `${candidate.provider} not available for agent "${agentName}", falling back to Ollama`
    );
    return {
      agentName,
      provider: "ollama",
      model: undefined,
      reason: "fallback",
      fallbackUsed: true,
    };
  }

  return {
    agentName,
    ...candidate,
    reason,
    fallbackUsed: false,
  };
}

export function getProviderInstance(route: AgentRoute): AgentChatProvider {
  return providers[route.provider];
}

export function getAllRoutes(): RouteTableEntry[] {
  const settings = readSettings();
  const allAgentNames = new Set([
    ...Object.keys(DEFAULT_ROUTES),
    ...Object.keys(settings.agentRoutes ?? {}),
  ]);

  return Array.from(allAgentNames).sort().map((agentName) => {
    const defaultRoute = DEFAULT_ROUTES[agentName] ?? { provider: "ollama" as const };
    const override = settings.agentRoutes?.[agentName] ?? null;
    const resolved = resolveAgentRoute(agentName);

    return {
      agentName,
      defaultRoute,
      override,
      effectiveRoute: { provider: resolved.provider, model: resolved.model },
      reason: resolved.reason,
      fallbackUsed: resolved.fallbackUsed,
      providerAvailable: providers[resolved.provider].isAvailable(),
    };
  });
}

export function setAgentRouteOverride(agentName: string, route: AgentRoute): void {
  const settings = readSettings();
  writeSettings({
    agentRoutes: {
      ...(settings.agentRoutes ?? {}),
      [agentName]: route,
    },
  });
}

export function deleteAgentRouteOverride(agentName: string): void {
  const settings = readSettings();
  if (!settings.agentRoutes?.[agentName]) return;
  const next = { ...settings.agentRoutes };
  delete next[agentName];
  writeSettings({ agentRoutes: next });
}
