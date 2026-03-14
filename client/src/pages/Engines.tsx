import { useState } from "react";
import { Link } from "react-router-dom";
import { useEngines, useSetEngineDefault, useRunPodStatus, useRunPodStart, useRunPodStop } from "@/api/hooks";
import type { Engine } from "@/api/types";
import {
  Zap, Sparkles, Globe, FlaskConical, Cpu,
  ChevronDown, ChevronUp, X, CheckCircle2, Loader2,
  GitCompare, Server, Play, Square, AlertTriangle, Wifi,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── RunPod Pod Manager ───────────────────────────────────────────────────────

function RunPodPanel() {
  const { data: status, isLoading } = useRunPodStatus();
  const start = useRunPodStart();
  const stop = useRunPodStop();

  const isRunning = status?.state === "running";
  const isStopped = status?.state === "stopped";
  const isNotConfigured = status?.state === "not_configured";

  function formatUptime(seconds: number | null): string {
    if (seconds === null) return "—";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  if (isNotConfigured) return null;

  return (
    <div className="bg-surface-elevated border border-border rounded-xl p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center border flex-shrink-0",
            isRunning ? "bg-green-500/10 border-green-500/25" : "bg-zinc-500/10 border-zinc-500/25"
          )}>
            <Server size={18} className={isRunning ? "text-green-400" : "text-zinc-400"} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-text-primary">RunPod Cloud GPU</h3>
              {isLoading ? (
                <Loader2 size={12} className="animate-spin text-text-muted" />
              ) : isRunning ? (
                <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border bg-green-950/50 border-green-900/60 text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  Running
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border bg-zinc-900 border-zinc-800 text-zinc-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                  Stopped
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              {status?.gpuTypeId} · {status?.templateId}
            </p>
          </div>
        </div>

        {/* Stats row (when running) */}
        {isRunning && (
          <div className="hidden sm:flex items-center gap-6 text-xs text-text-muted">
            {status?.costPerHr != null && (
              <div className="text-center">
                <p className="text-text-primary font-medium">${status.costPerHr.toFixed(2)}/hr</p>
                <p className="text-[10px]">cost</p>
              </div>
            )}
            <div className="text-center">
              <p className="text-text-primary font-medium">{formatUptime(status?.uptimeSeconds ?? null)}</p>
              <p className="text-[10px]">uptime</p>
            </div>
            {status?.proxyUrl && (
              <a
                href={status.proxyUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-accent hover:underline"
              >
                <Wifi size={12} /> ComfyUI
              </a>
            )}
          </div>
        )}

        {/* Action button */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {!status?.hasNetworkVolume && isStopped && (
            <span className="hidden md:flex items-center gap-1 text-[11px] text-amber-400/80">
              <AlertTriangle size={11} /> Models re-download on start
            </span>
          )}
          {isRunning ? (
            <button
              onClick={() => stop.mutate(status?.podId ?? undefined)}
              disabled={stop.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/30 border border-red-800/50 text-red-400 hover:bg-red-900/50 text-xs font-medium transition-colors disabled:opacity-50"
            >
              {stop.isPending ? <Loader2 size={12} className="animate-spin" /> : <Square size={12} />}
              Stop Pod
            </button>
          ) : (
            <button
              onClick={() => start.mutate()}
              disabled={start.isPending || isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-900/30 border border-green-800/50 text-green-400 hover:bg-green-900/50 text-xs font-medium transition-colors disabled:opacity-50"
            >
              {start.isPending ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              {start.isPending ? "Deploying…" : "Start Pod"}
            </button>
          )}
        </div>
      </div>

      {/* Error display */}
      {(start.isError || stop.isError) && (
        <p className="mt-3 text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
          {start.error?.message || stop.error?.message}
        </p>
      )}

      {/* Startup note */}
      {start.isSuccess && (
        <p className="mt-3 text-xs text-amber-400/80 flex items-center gap-1.5">
          <AlertTriangle size={12} />
          Pod deployed — ComfyUI takes ~2-3 min to initialize. Use the ComfyUI link above to verify it&apos;s ready before rendering.
        </p>
      )}
    </div>
  );
}

// ─── Engine icon + accent config ─────────────────────────────────────────────

const ENGINE_CONFIG: Record<string, {
  icon: React.ElementType;
  bg: string;
  iconColor: string;
  border: string;
}> = {
  runway_gen4: { icon: Zap,          bg: "bg-blue-500/10",    iconColor: "text-blue-400",    border: "border-blue-500/25"   },
  openai_sora: { icon: Sparkles,     bg: "bg-emerald-500/10", iconColor: "text-emerald-400", border: "border-emerald-500/25"},
  google_veo:  { icon: Globe,        bg: "bg-amber-500/10",   iconColor: "text-amber-400",   border: "border-amber-500/25"  },
  kling_video: { icon: FlaskConical, bg: "bg-violet-500/10",  iconColor: "text-violet-400",  border: "border-violet-500/25" },
  fal_wan21:   { icon: Zap,          bg: "bg-orange-500/10",  iconColor: "text-orange-400",  border: "border-orange-500/25" },
  runpod_wan:  { icon: Server,       bg: "bg-green-500/10",   iconColor: "text-green-400",   border: "border-green-500/25"  },
  local_wan:   { icon: Cpu,          bg: "bg-zinc-500/10",    iconColor: "text-zinc-400",    border: "border-zinc-500/25"   },
};

function engineCfg(key: string) {
  return ENGINE_CONFIG[key] ?? { icon: Cpu, bg: "bg-zinc-500/10", iconColor: "text-zinc-400", border: "border-zinc-500/25" };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ status }: { status: Engine["status"] }) {
  const map: Record<Engine["status"], { dot: string; text: string; bg: string; label: string }> = {
    configured:     { dot: "bg-green-400", text: "text-green-400",  bg: "bg-green-950/50 border-green-900/60",  label: "Configured"     },
    not_configured: { dot: "bg-amber-400", text: "text-amber-400",  bg: "bg-amber-950/50 border-amber-900/60",  label: "Not Configured" },
    local:          { dot: "bg-zinc-400",  text: "text-zinc-400",   bg: "bg-zinc-900 border-zinc-800",          label: "Local"          },
    unavailable:    { dot: "bg-red-500",   text: "text-red-400",    bg: "bg-red-950/50 border-red-900/60",      label: "Unavailable"    },
  };
  const s = map[status];
  return (
    <span className={cn("flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border", s.bg, s.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", s.dot)} />
      {s.label}
    </span>
  );
}

function CategoryBadge({ category }: { category: Engine["category"] }) {
  const map: Record<Engine["category"], string> = {
    premium:      "bg-blue-900/40 text-blue-300 border-blue-800/50",
    local:        "bg-zinc-800 text-zinc-400 border-zinc-700",
    experimental: "bg-violet-900/40 text-violet-300 border-violet-800/50",
  };
  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wide", map[category])}>
      {category}
    </span>
  );
}

function RoleChip({ role }: { role: string }) {
  const label = role === "presenter_default" ? "Presenter Default" : "Premium Fallback";
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/15 text-accent border border-accent/20 font-medium">
      {label}
    </span>
  );
}

// ─── Templates modal ──────────────────────────────────────────────────────────

function TemplatesModal({ engine, onClose }: { engine: Engine; onClose: () => void }) {
  const cfg = engineCfg(engine.key);
  const Icon = cfg.icon;
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface-elevated border border-border rounded-2xl w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center border", cfg.bg, cfg.border)}>
              <Icon size={16} className={cfg.iconColor} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">{engine.label}</h2>
              <p className="text-xs text-text-muted">Scene Templates</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors p-1 rounded-lg hover:bg-surface-hover">
            <X size={16} />
          </button>
        </div>
        <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
          {engine.templates.map((t) => (
            <div key={t.id} className="bg-surface border border-border rounded-xl p-4">
              <p className="text-sm font-medium text-text-primary">{t.name}</p>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">{t.description}</p>
              <p className="text-[10px] text-text-muted font-mono mt-2 opacity-50">{t.id}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Engine card ──────────────────────────────────────────────────────────────

function EngineCard({ engine, onViewTemplates }: { engine: Engine; onViewTemplates: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [showDefaultPicker, setShowDefaultPicker] = useState(false);
  const [defaultSuccess, setDefaultSuccess] = useState<string | null>(null);
  const [sampleClicked, setSampleClicked] = useState(false);
  const setDefault = useSetEngineDefault();

  const cfg = engineCfg(engine.key);
  const Icon = cfg.icon;
  const canSetDefault = engine.status === "configured" || engine.status === "local";

  async function handleSetDefault(mode: "presenter" | "premium_fallback") {
    await setDefault.mutateAsync({ mode, provider: engine.key });
    setShowDefaultPicker(false);
    setDefaultSuccess(mode === "presenter" ? "Presenter Default" : "Premium Fallback");
    setTimeout(() => setDefaultSuccess(null), 2500);
  }

  return (
    <div className={cn(
      "bg-surface-elevated border rounded-xl p-5 flex flex-col gap-4 transition-all duration-150",
      cfg.border,
    )}>
      {/* Header: icon + name + badges */}
      <div className="flex items-start gap-3">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border", cfg.bg, cfg.border)}>
          <Icon size={18} className={cfg.iconColor} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-sm font-semibold text-text-primary">{engine.label}</h3>
            <CategoryBadge category={engine.category} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <StatusPill status={engine.status} />
            {engine.defaultRole.map((r) => <RoleChip key={r} role={r} />)}
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-text-secondary leading-relaxed">{engine.description}</p>

      {/* Best-for chips */}
      <div className="flex flex-wrap gap-1">
        {engine.bestFor.map((b) => (
          <span key={b} className="text-[10px] px-2 py-0.5 rounded-full bg-surface border border-border text-text-secondary">
            {b}
          </span>
        ))}
      </div>

      {/* Formats + capabilities */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1">
          {engine.supportedAspectRatios.map((r) => (
            <span key={r} className="text-[10px] px-2 py-0.5 rounded bg-surface border border-border text-text-muted font-mono">{r}</span>
          ))}
          <span className="text-[10px] px-2 py-0.5 rounded bg-surface border border-border text-text-muted">
            max {engine.maxDurationSeconds}s
          </span>
        </div>
        <div className="flex gap-4 text-[11px]">
          <span className={cn(engine.supportsPresenterMode ? "text-green-400" : "text-text-muted opacity-40")}>
            {engine.supportsPresenterMode ? "✓" : "—"} Presenter
          </span>
          <span className={cn(engine.supportsCinematicMode ? "text-green-400" : "text-text-muted opacity-40")}>
            {engine.supportsCinematicMode ? "✓" : "—"} Cinematic
          </span>
          <span className={cn(engine.supportsReferenceImage ? "text-green-400" : "text-text-muted opacity-40")}>
            {engine.supportsReferenceImage ? "✓" : "—"} Ref Image
          </span>
        </div>
      </div>

      {/* Strengths / Weaknesses expandable */}
      <div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          Strengths &amp; weaknesses
        </button>
        {expanded && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="space-y-1">
              {engine.strengths.map((s) => (
                <p key={s} className="text-[11px] text-green-400/90 flex items-start gap-1 leading-snug">
                  <span className="flex-shrink-0 mt-px">+</span>{s}
                </p>
              ))}
            </div>
            <div className="space-y-1">
              {engine.weaknesses.map((w) => (
                <p key={w} className="text-[11px] text-red-400/70 flex items-start gap-1 leading-snug">
                  <span className="flex-shrink-0 mt-px">−</span>{w}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action row */}
      <div className="border-t border-border/40 pt-3 mt-auto flex flex-wrap gap-2 items-center">
        {/* View Templates */}
        <button
          onClick={onViewTemplates}
          className="text-xs px-3 py-1.5 rounded-lg border border-border hover:border-accent/50 text-text-secondary hover:text-text-primary transition-colors"
        >
          View Templates
        </button>

        {/* Set as Default */}
        {canSetDefault && (
          <div className="relative">
            {defaultSuccess ? (
              <span className="flex items-center gap-1 text-xs text-green-400 px-2 py-1.5">
                <CheckCircle2 size={12} /> {defaultSuccess}
              </span>
            ) : showDefaultPicker ? (
              <div className="absolute bottom-full left-0 mb-1 bg-surface-elevated border border-border rounded-xl p-2 shadow-2xl z-20 w-44 space-y-0.5">
                <button
                  onClick={() => handleSetDefault("presenter")}
                  disabled={setDefault.isPending}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
                >
                  Presenter Default
                </button>
                <button
                  onClick={() => handleSetDefault("premium_fallback")}
                  disabled={setDefault.isPending}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
                >
                  Premium Fallback
                </button>
                <div className="border-t border-border my-1" />
                <button
                  onClick={() => setShowDefaultPicker(false)}
                  className="w-full text-left text-xs px-3 py-1.5 rounded-lg text-text-muted hover:text-text-secondary transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDefaultPicker(true)}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-border hover:border-accent/50 text-text-secondary hover:text-text-primary transition-colors"
              >
                Set as Default <ChevronDown size={10} />
              </button>
            )}
          </div>
        )}

        {/* Run Sample */}
        <button
          onClick={() => { setSampleClicked(true); setTimeout(() => setSampleClicked(false), 2000); }}
          className="text-xs px-3 py-1.5 rounded-lg border border-border text-text-muted hover:text-text-secondary transition-colors ml-auto"
        >
          {sampleClicked ? "Coming soon…" : "Run Sample"}
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type FilterTab = "all" | "local" | "premium" | "experimental";

export function Engines() {
  const { data: engines, isLoading } = useEngines();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [templateEngine, setTemplateEngine] = useState<Engine | null>(null);

  const filtered = engines?.filter((e) => filter === "all" || e.category === filter) ?? [];

  const counts = {
    all:          engines?.length ?? 0,
    local:        engines?.filter((e) => e.category === "local").length ?? 0,
    premium:      engines?.filter((e) => e.category === "premium").length ?? 0,
    experimental: engines?.filter((e) => e.category === "experimental").length ?? 0,
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Engine Lab</h1>
          <p className="text-sm text-text-muted mt-1 max-w-xl">
            Choose the right engine for the right job. Compare local and premium generation engines
            for presenter videos, social clips, and cinematic scenes.
          </p>
        </div>
        <Link
          to="/engines/compare"
          className="flex items-center gap-2 px-4 py-2 border border-border hover:border-accent/50 text-text-secondary hover:text-text-primary rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0"
        >
          <GitCompare size={15} /> Compare Engines
        </Link>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Engines",   value: engines?.length ?? 0,                                              color: "text-text-primary"  },
          { label: "Configured",      value: engines?.filter((e) => e.status === "configured").length ?? 0,     color: "text-green-400"     },
          { label: "Not Configured",  value: engines?.filter((e) => e.status === "not_configured").length ?? 0, color: "text-amber-400"     },
          { label: "Local",           value: engines?.filter((e) => e.status === "local").length ?? 0,          color: "text-zinc-400"      },
        ].map((s) => (
          <div key={s.label} className="bg-surface-elevated border border-border rounded-xl p-4">
            <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
            <p className="text-xs text-text-muted mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* RunPod Pod Manager */}
      <RunPodPanel />

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["all", "local", "premium", "experimental"] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize flex items-center gap-1.5",
              filter === tab
                ? "border-accent text-accent"
                : "border-transparent text-text-muted hover:text-text-primary"
            )}
          >
            {tab}
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface border border-border">
              {counts[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* Engine cards */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-text-muted text-sm py-12">
          <Loader2 size={16} className="animate-spin" /> Loading engines…
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-text-muted py-8">No engines in this category.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((engine) => (
            <EngineCard
              key={engine.key}
              engine={engine}
              onViewTemplates={() => setTemplateEngine(engine)}
            />
          ))}
        </div>
      )}

      {/* Templates modal */}
      {templateEngine && (
        <TemplatesModal
          engine={templateEngine}
          onClose={() => setTemplateEngine(null)}
        />
      )}
    </div>
  );
}
