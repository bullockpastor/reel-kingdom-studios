import { useState } from "react";
import { Link } from "react-router-dom";
import { useEngines, useCompareEngines, useComparison } from "@/api/hooks";
import type { Engine, CompareShot } from "@/api/types";
import {
  Zap, Sparkles, Globe, FlaskConical, Cpu,
  ArrowLeft, Play, Loader2, AlertCircle, CheckCircle2, RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Engine display config (shared with Engines.tsx) ────────────────────────

const ENGINE_CFG: Record<string, { icon: React.ElementType; iconColor: string; bg: string; border: string }> = {
  runway_gen4: { icon: Zap,          iconColor: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/25"   },
  openai_sora: { icon: Sparkles,     iconColor: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25"},
  google_veo:  { icon: Globe,        iconColor: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/25"  },
  kling_video: { icon: FlaskConical, iconColor: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-violet-500/25" },
  local_wan:   { icon: Cpu,          iconColor: "text-zinc-400",    bg: "bg-zinc-500/10",    border: "border-zinc-500/25"   },
};

function ecfg(key: string) {
  return ENGINE_CFG[key] ?? { icon: Cpu, iconColor: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/25" };
}

// ─── Engine selector card ─────────────────────────────────────────────────────

function EngineSelectCard({
  engine,
  selected,
  disabled,
  onToggle,
}: {
  engine: Engine;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const cfg = ecfg(engine.key);
  const Icon = cfg.icon;
  const isFree = engine.status === "local";
  const notConfigured = engine.status === "not_configured";

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled || notConfigured}
      className={cn(
        "relative text-left rounded-xl border p-4 transition-all duration-150 focus:outline-none",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        selected && !disabled
          ? cn("border-2", cfg.border.replace("border-", "border-").replace("/25", "/70"), cfg.bg)
          : "border-border bg-surface hover:border-border hover:bg-surface-hover"
      )}
    >
      {/* Checkbox indicator */}
      <div className={cn(
        "absolute top-3 right-3 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
        selected ? "bg-accent border-accent" : "border-zinc-600"
      )}>
        {selected && <div className="w-2 h-2 rounded-sm bg-white" />}
      </div>

      {/* Icon + name */}
      <div className="flex items-center gap-2 mb-2 pr-6">
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center border flex-shrink-0", cfg.bg, cfg.border)}>
          <Icon size={13} className={cfg.iconColor} />
        </div>
        <span className="text-xs font-semibold text-text-primary truncate">{engine.label}</span>
      </div>

      {/* Cost / status badge */}
      <div className="flex flex-wrap gap-1">
        {isFree ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-950/60 text-green-400 border border-green-900/60 font-medium">
            Free
          </span>
        ) : notConfigured ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-500 border border-zinc-800">
            Not Configured
          </span>
        ) : (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/40 text-amber-400 border border-amber-900/50">
            Credits
          </span>
        )}
        {engine.supportsReferenceImage && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted">
            Ref Img
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Result card ──────────────────────────────────────────────────────────────

function ResultCard({ shot, engine }: { shot: CompareShot | undefined; engineKey: string; engine: Engine | undefined }) {
  const cfg = ecfg(engine?.key ?? "");
  const Icon = cfg.icon;

  const isQueued    = !shot || shot.status === "queued" || shot.status === "pending";
  const isRendering = shot?.status === "rendering";
  const isRendered  = shot?.status === "rendered";
  const isFailed    = shot?.status === "failed";

  return (
    <div className={cn("bg-surface-elevated border rounded-xl overflow-hidden flex flex-col", cfg.border)}>
      {/* Card header */}
      <div className={cn("flex items-center gap-2 px-4 py-3 border-b border-border", cfg.bg)}>
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center border flex-shrink-0", cfg.bg, cfg.border)}>
          <Icon size={13} className={cfg.iconColor} />
        </div>
        <span className="text-xs font-semibold text-text-primary flex-1 truncate">{engine?.label ?? shot?.engine ?? "Unknown"}</span>
        {/* Status pill */}
        {isQueued    && <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">Queued</span>}
        {isRendering && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/50 text-amber-400 border border-amber-900/60">Rendering</span>}
        {isRendered  && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-950/50 text-green-400 border border-green-900/60">Done</span>}
        {isFailed    && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-950/50 text-red-400 border border-red-900/60">Failed</span>}
      </div>

      {/* Content area — fixed height so cards stay aligned */}
      <div className="flex-1 flex items-center justify-center min-h-[220px] bg-black/30">
        {isRendered && shot?.renderUrl ? (
          <video
            src={shot.renderUrl}
            controls
            loop
            className="w-full h-full object-contain max-h-[220px]"
          />
        ) : isFailed ? (
          <div className="flex flex-col items-center gap-2 text-center p-4">
            <AlertCircle size={24} className="text-red-400 opacity-70" />
            <p className="text-xs text-red-400/80">{shot?.errorMessage ?? "Render failed"}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={24} className="animate-spin text-text-muted" />
            <p className="text-xs text-text-muted">{isRendering ? "Rendering…" : "Queued…"}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function EngineCompare() {
  const { data: engines } = useEngines();

  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState<5 | 10>(5);
  const [selectedEngines, setSelectedEngines] = useState<Set<string>>(new Set(["local_wan"]));
  const [comparisonId, setComparisonId] = useState<string | null>(null);
  const [submittedEngines, setSubmittedEngines] = useState<string[]>([]);

  const compare = useCompareEngines();
  const { data: comparison, isLoading: comparisonLoading } = useComparison(comparisonId);

  const hasPremium = [...selectedEngines].some((k) => k !== "local_wan");
  const canCompare = prompt.trim().length > 10 && selectedEngines.size > 0;

  const allDone = comparison
    ? comparison.shots.every((s) => s.status === "rendered" || s.status === "failed")
    : false;

  function toggleEngine(key: string) {
    setSelectedEngines((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleCompare() {
    if (!canCompare) return;
    const engineList = [...selectedEngines];
    setSubmittedEngines(engineList);
    const result = await compare.mutateAsync({
      prompt: prompt.trim(),
      engines: engineList,
      durationSeconds: duration,
    });
    setComparisonId(result.comparisonId);
  }

  function handleReset() {
    setComparisonId(null);
    setSubmittedEngines([]);
    compare.reset();
  }

  // Build result cards: use submittedEngines so we show placeholders immediately
  const resultEngineKeys = comparison ? comparison.shots.map((s) => s.engine) : submittedEngines;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <Link to="/engines" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary mb-4">
          <ArrowLeft size={14} /> Engine Lab
        </Link>
        <h1 className="text-xl font-bold text-text-primary">Compare Engines</h1>
        <p className="text-sm text-text-muted mt-1">
          Run the same prompt through multiple engines and compare outputs side by side.
          Local rendering is <span className="text-green-400 font-medium">free</span>. Premium engines consume API credits.
        </p>
      </div>

      {/* Setup form — shown when no active comparison */}
      {!comparisonId && (
        <div className="bg-surface-elevated border border-border rounded-xl p-6 space-y-6">

          {/* Prompt */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">Prompt</label>
            <textarea
              rows={4}
              placeholder="Describe a visual scene to render across all selected engines. Keep it short and specific — e.g. 'Distinguished pastor speaking directly to camera, warm studio lighting, medium close-up, dark wood background.'"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent resize-none font-mono leading-relaxed"
            />
            <p className="text-[11px] text-text-muted mt-1">{prompt.length} chars — keep under 500 for best results</p>
          </div>

          {/* Engine selection */}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-2">Select Engines</label>
            {engines ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {engines.map((engine) => (
                  <EngineSelectCard
                    key={engine.key}
                    engine={engine}
                    selected={selectedEngines.has(engine.key)}
                    disabled={compare.isPending}
                    onToggle={() => toggleEngine(engine.key)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-text-muted text-sm py-4">
                <Loader2 size={14} className="animate-spin" /> Loading engines…
              </div>
            )}
          </div>

          {/* Options row */}
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Clip Duration</label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value) as 5 | 10)}
                className="px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                <option value={5}>5 seconds</option>
                <option value={10}>10 seconds</option>
              </select>
            </div>

            <div className="flex-1" />

            {/* Premium warning */}
            {hasPremium && (
              <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-950/30 border border-amber-900/50 rounded-lg px-3 py-2">
                <AlertCircle size={13} />
                Premium engines selected — this will consume API credits.
              </div>
            )}

            <button
              onClick={handleCompare}
              disabled={!canCompare || compare.isPending}
              className="flex items-center gap-2 px-5 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {compare.isPending ? (
                <><Loader2 size={14} className="animate-spin" /> Queuing…</>
              ) : (
                <><Play size={14} /> Run Comparison</>
              )}
            </button>
          </div>

          {compare.error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
              {compare.error instanceof Error ? compare.error.message : "Comparison failed"}
            </p>
          )}
        </div>
      )}

      {/* Results section */}
      {comparisonId && (
        <div className="space-y-4">
          {/* Results header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-text-primary">
                Comparison Results
                {comparisonLoading && !comparison && (
                  <Loader2 size={13} className="inline ml-2 animate-spin text-text-muted" />
                )}
              </h2>
              {allDone && (
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <CheckCircle2 size={13} /> All done
                </span>
              )}
              {!allDone && comparison && (
                <span className="text-xs text-amber-400 animate-pulse">
                  Rendering…
                </span>
              )}
            </div>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border hover:border-accent/50 text-text-muted hover:text-text-primary rounded-lg transition-colors"
            >
              <RotateCcw size={12} /> New Comparison
            </button>
          </div>

          {/* Prompt echo */}
          <div className="bg-surface border border-border rounded-lg px-4 py-2">
            <p className="text-[11px] text-text-muted mb-0.5">Prompt</p>
            <p className="text-xs text-text-secondary font-mono leading-relaxed">{prompt || comparison?.shots[0]?.engine}</p>
          </div>

          {/* Result cards grid */}
          <div className={cn(
            "grid gap-4",
            resultEngineKeys.length === 1 && "grid-cols-1 max-w-sm",
            resultEngineKeys.length === 2 && "grid-cols-1 sm:grid-cols-2",
            resultEngineKeys.length === 3 && "grid-cols-1 sm:grid-cols-3",
            resultEngineKeys.length >= 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
          )}>
            {resultEngineKeys.map((engineKey) => {
              const shot = comparison?.shots.find((s) => s.engine === engineKey);
              const engine = engines?.find((e) => e.key === engineKey);
              return (
                <ResultCard
                  key={engineKey}
                  shot={shot}
                  engineKey={engineKey}
                  engine={engine}
                />
              );
            })}
          </div>

          {/* Comparison ID for reference */}
          <p className="text-[10px] text-text-muted font-mono opacity-50">
            comparison/{comparisonId}
          </p>
        </div>
      )}
    </div>
  );
}
