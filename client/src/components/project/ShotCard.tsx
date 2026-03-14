import { useState, useEffect } from "react";
import type { Shot } from "@/api/types";
import { StatusBadge } from "./StatusBadge";
import { VideoPlayer } from "./VideoPlayer";
import { useRenderShot, useUpdateShot, useQueueStatus, useRestoreRender } from "@/api/hooks";
import { Loader2, Play, RotateCcw, GripVertical, History, RotateCw } from "lucide-react";

const PREMIUM_PROVIDERS = [
  { value: "runway_gen4", label: "Runway Gen4" },
  { value: "openai_sora", label: "OpenAI Sora" },
  { value: "google_veo", label: "Google Veo" },
  { value: "kling_video", label: "Kling Video" },
] as const;

const ENGINE_ESTIMATED_MS: Record<string, number> = {
  comfyui: 1_800_000,
  runpod_wan: 120_000,
  runway_gen4: 120_000,
  openai_sora: 180_000,
  fal_wan21: 60_000,
  kling_video: 90_000,
  google_veo: 120_000,
};

function formatTime(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}:${sec.toString().padStart(2, "0")}` : `${sec}s`;
}

export function ShotCard({
  shot,
  projectId,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  shot: Shot;
  projectId?: string;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}) {
  const renderShot = useRenderShot();
  const updateShot = useUpdateShot();
  const restoreRender = useRestoreRender();
  const { data: queueData } = useQueueStatus();

  const [engine, setEngine] = useState<"local" | "premium">(
    shot.status === "failed" && (shot.qcFailCount ?? 0) >= 2 ? "premium" : "local"
  );
  const [provider, setProvider] = useState<string>("runway_gen4");
  const [showHistory, setShowHistory] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const canRender = shot.status === "pending" || shot.status === "failed";
  const isRendering = shot.status === "rendering" || shot.status === "queued";
  const suggestPremium = shot.status === "failed" && (shot.qcFailCount ?? 0) >= 2;

  // Find the active queue job for this shot
  const activeJob = isRendering
    ? queueData?.render.recent.find(
        (j) => j.shotId === shot.id && (j.status === "processing" || j.status === "queued")
      )
    : null;

  const progress = activeJob?.progress ?? 0;
  const engineKey = activeJob?.engine ?? shot.renderEngine ?? "runway_gen4";
  const estimatedMs = ENGINE_ESTIMATED_MS[engineKey] ?? 120_000;

  // Elapsed timer while rendering
  useEffect(() => {
    if (!isRendering) {
      setElapsedMs(0);
      return;
    }
    const startedAt = activeJob?.startedAt
      ? new Date(activeJob.startedAt).getTime()
      : Date.now();
    const tick = () => setElapsedMs(Date.now() - startedAt);
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isRendering, activeJob?.startedAt]);

  function handleRender() {
    const opts: Record<string, unknown> = { engine };
    if (engine === "premium") opts.provider = provider;
    renderShot.mutate({ id: shot.id, opts });
  }

  const handleTrimBlur = (field: "trimStart" | "trimEnd") => (e: React.FocusEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    if (!Number.isNaN(v) && v >= 0) {
      const cur = field === "trimStart" ? (shot.trimStart ?? 0) : (shot.trimEnd ?? 0);
      if (Math.abs(v - cur) > 0.01) updateShot.mutate({ shotId: shot.id, data: { [field]: v } });
    }
  };

  // Determine which render jobs to show in history (all completed with a file)
  const historyJobs = (shot.renderJobs ?? []).filter((rj) => rj.status === "completed");
  const currentRenderPath = shot.renderPath;

  return (
    <div
      className={`relative bg-surface-elevated border border-border rounded-lg overflow-hidden ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {draggable && (
        <div className="absolute left-1 top-1 z-10 text-text-muted opacity-60 hover:opacity-100">
          <GripVertical size={14} />
        </div>
      )}
      {/* Video preview or placeholder */}
      <div className="aspect-video bg-black relative">
        {shot.renderUrl && shot.status === "rendered" ? (
          <VideoPlayer src={shot.renderUrl} className="w-full h-full object-contain" />
        ) : isRendering ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4">
            <Loader2 size={24} className="animate-spin text-warning" />
            {/* Progress bar */}
            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-warning rounded-full transition-all duration-1000"
                style={{ width: `${Math.max(progress, 2)}%` }}
              />
            </div>
            <div className="flex gap-2 text-[10px] text-text-muted">
              <span>{Math.round(progress)}%</span>
              <span>·</span>
              <span>{formatTime(elapsedMs)} elapsed</span>
              {elapsedMs < estimatedMs && (
                <>
                  <span>·</span>
                  <span>~{formatTime(Math.max(estimatedMs - elapsedMs, 0))} left</span>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-text-muted">
            <Play size={24} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-text-primary">
            Shot {shot.shotIndex + 1}
          </span>
          <StatusBadge status={shot.status} />
        </div>

        {/* Trim overrides — shown when shot is rendered */}
        {shot.status === "rendered" && (
          <div className="flex gap-2 text-[10px]">
            <label className="flex items-center gap-1 text-text-muted">
              trim↑
              <input
                type="number"
                min={0}
                step={0.1}
                defaultValue={shot.trimStart ?? 0}
                onBlur={handleTrimBlur("trimStart")}
                className="w-12 bg-surface border border-border rounded px-1 py-0.5 text-text-primary"
              />
            </label>
            <label className="flex items-center gap-1 text-text-muted">
              trim↓
              <input
                type="number"
                min={0}
                step={0.1}
                defaultValue={shot.trimEnd ?? 0}
                onBlur={handleTrimBlur("trimEnd")}
                className="w-12 bg-surface border border-border rounded px-1 py-0.5 text-text-primary"
              />
            </label>
          </div>
        )}

        <p className="text-xs text-text-secondary line-clamp-3">{shot.prompt}</p>

        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span>{shot.durationSeconds}s</span>
          {shot.cameraMotion && <span>{shot.cameraMotion}</span>}
          {shot.mood && <span>{shot.mood}</span>}
        </div>

        {shot.qcScore != null && (
          <div className="text-xs text-text-muted">
            QC: {(shot.qcScore * 100).toFixed(0)}%
          </div>
        )}

        {shot.errorMessage && (
          <p className="text-xs text-danger truncate">{shot.errorMessage}</p>
        )}

        {/* Actions */}
        {canRender && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <select
                value={engine}
                onChange={(e) => setEngine(e.target.value as "local" | "premium")}
                className="flex-1 bg-surface border border-border rounded-md px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="local">Local (ComfyUI)</option>
                <option value="premium">Premium</option>
              </select>
              {engine === "premium" && (
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="flex-1 bg-surface border border-border rounded-md px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
                >
                  {PREMIUM_PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <button
              onClick={handleRender}
              disabled={renderShot.isPending}
              className="w-full flex items-center justify-center gap-2 bg-accent/10 hover:bg-accent/20 text-accent rounded-md py-1.5 text-xs font-medium transition-colors"
            >
              {shot.status === "failed" ? (
                <>
                  <RotateCcw size={12} />
                  {suggestPremium ? "Retry with Premium" : "Re-render"}
                </>
              ) : (
                <>
                  <Play size={12} /> Render Draft
                </>
              )}
            </button>
          </div>
        )}

        {/* Render History */}
        {historyJobs.length > 1 && (
          <div>
            <button
              onClick={() => setShowHistory((h) => !h)}
              className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              <History size={11} />
              History ({historyJobs.length})
            </button>

            {showHistory && (
              <div className="mt-2 space-y-2">
                {historyJobs.map((rj) => {
                  const isCurrent = rj.renderPath != null && rj.renderPath === currentRenderPath;
                  return (
                    <div
                      key={rj.id}
                      className={`rounded p-2 text-xs space-y-1 ${isCurrent ? "bg-accent/5 border border-accent/20" : "bg-surface border border-border"}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-text-muted truncate">{rj.engine}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {isCurrent ? (
                            <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded">
                              Current
                            </span>
                          ) : (
                            <button
                              onClick={() =>
                                restoreRender.mutate({ shotId: shot.id, renderJobId: rj.id })
                              }
                              disabled={restoreRender.isPending}
                              className="flex items-center gap-0.5 text-[10px] bg-surface-elevated border border-border px-1.5 py-0.5 rounded hover:bg-accent/10 hover:text-accent hover:border-accent/30 transition-colors disabled:opacity-50"
                            >
                              <RotateCw size={9} />
                              Restore
                            </button>
                          )}
                        </div>
                      </div>

                      {rj.renderUrl && (
                        <video
                          src={rj.renderUrl}
                          className="w-full rounded"
                          controls
                          muted
                          preload="none"
                        />
                      )}

                      <div className="flex gap-2 text-[10px] text-text-muted">
                        {rj.durationMs != null && (
                          <span>{(rj.durationMs / 1000).toFixed(0)}s render</span>
                        )}
                        {rj.completedAt && (
                          <span>{new Date(rj.completedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
