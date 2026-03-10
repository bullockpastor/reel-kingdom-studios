import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GitBranch, RotateCcw, Check, ChevronDown } from "lucide-react";
import { api } from "@/api/client";
import type { RouteTableEntry } from "@/api/types";

const PROVIDERS = ["ollama", "claude", "gemini"] as const;
type Provider = (typeof PROVIDERS)[number];

const PROVIDER_COLORS: Record<Provider, string> = {
  ollama: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  claude: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  gemini: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

const STATUS_COLORS = {
  override: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  fallback: "bg-red-500/15 text-red-400 border-red-500/30",
  default: "bg-surface text-text-muted border-border",
};

function ProviderBadge({ provider }: { provider: Provider }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${PROVIDER_COLORS[provider]}`}>
      {provider}
    </span>
  );
}

function ReasonBadge({ reason, fallbackUsed }: { reason: string; fallbackUsed: boolean }) {
  if (fallbackUsed) {
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs ${STATUS_COLORS.fallback}`}>
        fallback
      </span>
    );
  }
  if (reason === "override") {
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs ${STATUS_COLORS.override}`}>
        override
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs ${STATUS_COLORS.default}`}>
      default
    </span>
  );
}

function EditRow({
  entry,
  onSave,
  onCancel,
}: {
  entry: RouteTableEntry;
  onSave: (provider: Provider, model: string) => void;
  onCancel: () => void;
}) {
  const [provider, setProvider] = useState<Provider>(
    (entry.override?.provider as Provider) ?? entry.defaultRoute.provider
  );
  const [model, setModel] = useState(entry.override?.model ?? "");

  return (
    <tr className="bg-surface-elevated/50">
      <td className="px-4 py-3 text-sm font-medium text-text-primary" colSpan={2}>
        {entry.agentName}
      </td>
      <td className="px-4 py-3" colSpan={2}>
        <div className="flex items-center gap-2">
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as Provider)}
            className="bg-surface border border-border rounded px-2 py-1 text-sm text-text-primary"
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="model (optional)"
            className="bg-surface border border-border rounded px-2 py-1 text-sm text-text-primary w-48 placeholder:text-text-muted"
          />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSave(provider, model)}
            className="flex items-center gap-1 px-3 py-1 bg-accent text-white rounded text-xs hover:bg-accent/80 transition-colors"
          >
            <Check size={12} /> Save
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1 border border-border rounded text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

export function ModelRouter() {
  const queryClient = useQueryClient();
  const [editingAgent, setEditingAgent] = useState<string | null>(null);
  const [savedAgent, setSavedAgent] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["model-router-routes"],
    queryFn: () => api.listAgentRoutes(),
    refetchInterval: 10_000,
  });

  const setRoute = useMutation({
    mutationFn: (args: { agentName: string; provider: string; model?: string }) =>
      api.setAgentRoute(args),
    onSuccess: (res) => {
      queryClient.setQueryData(["model-router-routes"], res);
    },
  });

  const deleteRoute = useMutation({
    mutationFn: (agentName: string) => api.deleteAgentRoute(agentName),
    onSuccess: (res) => {
      queryClient.setQueryData(["model-router-routes"], res);
    },
  });

  const handleSave = (agentName: string, provider: Provider, model: string) => {
    setRoute.mutate(
      { agentName, provider, model: model || undefined },
      {
        onSuccess: () => {
          setEditingAgent(null);
          setSavedAgent(agentName);
          setTimeout(() => setSavedAgent(null), 2500);
        },
      }
    );
  };

  const handleReset = (agentName: string) => {
    deleteRoute.mutate(agentName, {
      onSuccess: () => {
        setSavedAgent(agentName);
        setTimeout(() => setSavedAgent(null), 2500);
      },
    });
  };

  const routes = data?.routes ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GitBranch size={20} className="text-accent" />
        <div>
          <h1 className="text-xl font-bold text-text-primary">Model Router</h1>
          <p className="text-sm text-text-muted">
            Route each agent to a different LLM provider. Overrides saved to{" "}
            <code className="text-xs bg-surface px-1 py-0.5 rounded">settings.json</code>.
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full bg-text-muted`} />
          default — using built-in routing table
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-yellow-400" />
          override — manually configured
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          fallback — configured provider unavailable, using Ollama
        </span>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-elevated border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">
                Agent
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">
                Default
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">
                Active
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                  Loading routes…
                </td>
              </tr>
            )}
            {routes.map((entry) =>
              editingAgent === entry.agentName ? (
                <EditRow
                  key={entry.agentName}
                  entry={entry}
                  onSave={(p, m) => handleSave(entry.agentName, p, m)}
                  onCancel={() => setEditingAgent(null)}
                />
              ) : (
                <tr
                  key={entry.agentName}
                  className="hover:bg-surface-elevated/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-text-primary">
                    {entry.agentName}
                  </td>
                  <td className="px-4 py-3">
                    <ProviderBadge provider={entry.defaultRoute.provider as Provider} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ProviderBadge provider={entry.effectiveRoute.provider as Provider} />
                      {entry.effectiveRoute.model && (
                        <span className="text-xs text-text-muted font-mono">
                          {entry.effectiveRoute.model}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {savedAgent === entry.agentName ? (
                      <span className="flex items-center gap-1 text-xs text-green-400">
                        <Check size={12} /> Saved
                      </span>
                    ) : (
                      <ReasonBadge
                        reason={entry.reason}
                        fallbackUsed={entry.fallbackUsed}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingAgent(entry.agentName)}
                        className="flex items-center gap-1 px-2.5 py-1 border border-border rounded text-xs text-text-secondary hover:text-text-primary hover:border-accent/50 transition-colors"
                      >
                        <ChevronDown size={12} /> Edit
                      </button>
                      {entry.override && (
                        <button
                          onClick={() => handleReset(entry.agentName)}
                          className="flex items-center gap-1 px-2.5 py-1 border border-border rounded text-xs text-text-muted hover:text-red-400 hover:border-red-400/50 transition-colors"
                        >
                          <RotateCcw size={12} /> Reset
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-text-muted">
        Provider availability:{" "}
        <strong className="text-text-secondary">ollama</strong> — always active (local) ·{" "}
        <strong className="text-text-secondary">claude</strong> — requires{" "}
        <code className="bg-surface px-1 rounded">ANTHROPIC_API_KEY</code> ·{" "}
        <strong className="text-text-secondary">gemini</strong> — requires{" "}
        <code className="bg-surface px-1 rounded">GEMINI_API_KEY</code>
      </p>
    </div>
  );
}
