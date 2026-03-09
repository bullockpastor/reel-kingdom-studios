import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { usePresenterProject, useDirectPresenterProject, useProducePresenterProject, useAssemble } from "@/api/hooks";
import { StatusBadge } from "@/components/project/StatusBadge";
import { ShotGrid } from "@/components/project/ShotGrid";
import { VideoPlayer } from "@/components/project/VideoPlayer";
import { timeAgo } from "@/lib/utils";
import { ArrowLeft, Loader2, RefreshCw, Play, Film } from "lucide-react";

const PROVIDERS = ["runway_gen4", "openai_sora", "google_veo", "kling_video"];

type Tab = "overview" | "script" | "shots";

interface ScriptSegment {
  index: number;
  text: string;
  pauseBefore: number;
  pauseAfter: number;
  emphasis: string[];
  beatTimingSeconds: number;
  captionChunk: string;
  deliveryNote: string;
}

interface PerformanceShot {
  segmentIndex: number;
  cameraFraming: string;
  pacingProfile: string;
  emotionalTone: string;
  gestureIntensity: string;
  templateId: string;
  lowerThirdTiming?: { in: number; out: number; text: string };
  scriptureOverlay?: string;
  safeZone: string;
  verticalCropSafe: boolean;
  visualPrompt: string;
}

function highlightEmphasis(text: string, emphasis: string[]): string {
  return text; // Return plain text; emphasis is shown via badges below
}

export function PresenterWorkspace() {
  const { id } = useParams<{ id: string }>();
  const { data: project, isLoading } = usePresenterProject(id!);
  const direct = useDirectPresenterProject();
  const produce = useProducePresenterProject();
  const assemble = useAssemble();

  const [tab, setTab] = useState<Tab>("overview");
  const [showProviderPicker, setShowProviderPicker] = useState(false);
  const [expandedVisuals, setExpandedVisuals] = useState<Set<number>>(new Set());

  if (isLoading || !project) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  const ps = project.presenterScript;
  const shots = project.shots ?? [];
  const [selectedProvider, setSelectedProvider] = useState(
    ps?.selectedProvider ?? ps?.presenter?.defaultProvider ?? "runway_gen4"
  );
  const allRendered = shots.length > 0 && shots.every((s) => s.status === "rendered");
  const anyRendering = shots.some((s) => s.status === "rendering" || s.status === "queued");

  // Parse directed script and performance spec
  let segments: ScriptSegment[] = [];
  let globalDeliveryNotes = "";
  let perfShots: PerformanceShot[] = [];
  let globalStyle = "";

  if (ps) {
    try {
      const ds = JSON.parse(ps.directedScript);
      segments = ds.segments ?? [];
      globalDeliveryNotes = ds.globalDeliveryNotes ?? "";
    } catch { /* ignore */ }
    try {
      const perf = JSON.parse(ps.performanceSpec);
      perfShots = perf.shots ?? [];
      globalStyle = perf.globalStyle ?? "";
    } catch { /* ignore */ }
  }

  const perfByIndex = new Map<number, PerformanceShot>();
  for (const s of perfShots) perfByIndex.set(s.segmentIndex, s);

  function toggleVisual(idx: number) {
    setExpandedVisuals((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: "overview", label: "Overview", show: true },
    { key: "script", label: `Script (${segments.length} segments)`, show: segments.length > 0 },
    { key: "shots", label: `Shots (${shots.length})`, show: shots.length > 0 },
  ];

  return (
    <div className="max-w-5xl space-y-6">
      {/* Back link */}
      <Link to="/presenter" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary">
        <ArrowLeft size={14} /> Presenter
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-text-primary">{project.title}</h1>
            <span className="text-xs px-2 py-0.5 rounded bg-violet-900/50 text-violet-300 font-medium">presenter</span>
          </div>
          {ps?.presenter && (
            <p className="text-sm text-text-secondary mt-1">{ps.presenter.name}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
            {ps && <span className="capitalize">{ps.deliveryMode}</span>}
            <span>{timeAgo(project.createdAt)}</span>
          </div>
        </div>
        <StatusBadge status={project.status} className="text-sm px-3 py-1" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.filter((t) => t.show).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-accent text-accent"
                : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {tab === "overview" && (
        <div className="space-y-5">
          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            {/* Re-direct */}
            <button
              onClick={() => direct.mutate({ id: id! })}
              disabled={direct.isPending || anyRendering}
              className="flex items-center gap-2 border border-border hover:border-accent/50 disabled:opacity-50 text-text-secondary hover:text-text-primary rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              {direct.isPending ? (
                <><Loader2 size={14} className="animate-spin" /> Re-directing…</>
              ) : (
                <><RefreshCw size={14} /> Re-direct</>
              )}
            </button>

            {/* Produce */}
            {project.status === "storyboarded" && shots.length > 0 && (
              <>
                {showProviderPicker ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedProvider}
                      onChange={(e) => setSelectedProvider(e.target.value)}
                      className="px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent"
                    >
                      {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <button
                      onClick={() => {
                        produce.mutate({ id: id!, provider: selectedProvider });
                        setShowProviderPicker(false);
                      }}
                      disabled={produce.isPending}
                      className="flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                    >
                      {produce.isPending ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                      Confirm
                    </button>
                    <button
                      onClick={() => setShowProviderPicker(false)}
                      className="text-sm text-text-muted hover:text-text-primary transition-colors px-2 py-2"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowProviderPicker(true)}
                    disabled={produce.isPending}
                    className="flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                  >
                    <Play size={14} /> Produce All
                  </button>
                )}
              </>
            )}

            {/* Rendering indicator */}
            {anyRendering && (
              <div className="flex items-center gap-2 text-warning text-sm py-2">
                <Loader2 size={14} className="animate-spin" /> Rendering in progress…
              </div>
            )}

            {/* Assemble */}
            {allRendered && project.status !== "assembled" && project.status !== "assembling" && (
              <button
                onClick={() => assemble.mutate(id!)}
                disabled={assemble.isPending}
                className="flex items-center gap-2 border border-border hover:border-accent/50 disabled:opacity-50 text-text-secondary hover:text-text-primary rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                {assemble.isPending ? (
                  <><Loader2 size={14} className="animate-spin" /> Assembling…</>
                ) : (
                  <><Film size={14} /> Assemble</>
                )}
              </button>
            )}
          </div>

          {/* Final video */}
          {project.status === "assembled" && project.outputUrl && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-text-primary">Final Video</h3>
              <VideoPlayer src={project.outputUrl} />
            </div>
          )}

          {/* Presenter profile summary */}
          {ps?.presenter && (
            <div className="bg-surface-elevated border border-border rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Presenter</h3>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{ps.presenter.name}</p>
                  <div className="flex gap-2 mt-1">
                    {ps.selectedProvider && ps.selectedProvider !== ps.presenter.defaultProvider ? (
                      <>
                        <StatusBadge status={ps.selectedProvider} className="text-[10px]" />
                        <span className="text-[10px] text-text-muted">(project)</span>
                        <StatusBadge status={ps.presenter.defaultProvider} className="text-[10px] opacity-50" />
                        <span className="text-[10px] text-text-muted opacity-50">(default)</span>
                      </>
                    ) : (
                      <StatusBadge status={ps.selectedProvider ?? ps.presenter.defaultProvider} className="text-[10px]" />
                    )}
                    {ps.presenter.defaultTemplateId && (
                      <span className="text-[10px] text-text-muted font-mono">{ps.presenter.defaultTemplateId}</span>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">{ps.presenter.description}</p>
            </div>
          )}

          {/* PresenterScript status */}
          {ps && (
            <div className="bg-surface-elevated border border-border rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Direction Status</h3>
              <div className="flex items-center gap-3">
                <StatusBadge status={ps.status} />
                <span className="text-xs text-text-muted capitalize">{ps.deliveryMode}</span>
                {globalDeliveryNotes && (
                  <p className="text-xs text-text-secondary italic">"{globalDeliveryNotes}"</p>
                )}
              </div>
              {globalStyle && (
                <p className="text-xs text-text-muted">Style: <span className="text-text-secondary">{globalStyle}</span></p>
              )}
            </div>
          )}

          {/* Shot summary pills */}
          {shots.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Shots</h3>
              <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                {shots.map((s) => (
                  <div
                    key={s.id}
                    className="bg-surface-elevated border border-border rounded-md p-2 text-center cursor-pointer hover:border-accent/50"
                    onClick={() => setTab("shots")}
                  >
                    <p className="text-xs font-medium text-text-primary">#{s.shotIndex + 1}</p>
                    <StatusBadge status={s.status} className="mt-1 text-[10px]" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Script Tab ── */}
      {tab === "script" && (
        <div className="space-y-4">
          {segments.length === 0 ? (
            <p className="text-sm text-text-muted">No script segments yet.</p>
          ) : (
            segments.map((seg) => {
              const perf = perfByIndex.get(seg.index);
              return (
                <div
                  key={seg.index}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-border pb-4 last:border-0 last:pb-0"
                >
                  {/* Left: Script Segment */}
                  <div className="bg-surface-elevated border border-border rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-text-muted bg-surface px-2 py-0.5 rounded">
                        seg {seg.index}
                      </span>
                      <span className="text-xs text-text-muted">{seg.beatTimingSeconds.toFixed(1)}s</span>
                      {seg.pauseBefore > 0 && (
                        <span className="text-xs text-blue-400">pause {seg.pauseBefore}s before</span>
                      )}
                    </div>
                    <p className="text-sm text-text-primary leading-relaxed">{seg.text}</p>
                    {seg.emphasis.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {seg.emphasis.map((w) => (
                          <span key={w} className="text-[10px] px-2 py-0.5 bg-accent/15 text-accent rounded font-medium">
                            {w}
                          </span>
                        ))}
                      </div>
                    )}
                    {seg.deliveryNote && (
                      <p className="text-xs text-text-muted italic border-l-2 border-accent/30 pl-2">
                        {seg.deliveryNote}
                      </p>
                    )}
                    {seg.pauseAfter > 0 && (
                      <p className="text-xs text-blue-400">pause {seg.pauseAfter}s after</p>
                    )}
                  </div>

                  {/* Right: Performance Shot */}
                  {perf ? (
                    <div className="bg-surface-elevated border border-border rounded-xl p-4 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={perf.cameraFraming} className="text-[10px]" />
                        <StatusBadge status={perf.emotionalTone} className="text-[10px]" />
                        <StatusBadge status={perf.gestureIntensity} className="text-[10px]" />
                      </div>
                      {perf.templateId && (
                        <p className="text-xs text-text-muted font-mono">template: {perf.templateId}</p>
                      )}
                      {perf.lowerThirdTiming?.text && (
                        <p className="text-xs text-yellow-400">
                          Lower third: "{perf.lowerThirdTiming.text}" ({perf.lowerThirdTiming.in}s–{perf.lowerThirdTiming.out}s)
                        </p>
                      )}
                      {perf.scriptureOverlay && (
                        <p className="text-xs text-green-400 italic">Scripture: {perf.scriptureOverlay}</p>
                      )}
                      <div>
                        <button
                          onClick={() => toggleVisual(seg.index)}
                          className="text-xs text-text-muted hover:text-text-secondary transition-colors"
                        >
                          {expandedVisuals.has(seg.index) ? "Hide" : "Show"} visual prompt
                        </button>
                        {expandedVisuals.has(seg.index) && (
                          <p className="text-xs text-text-secondary mt-2 leading-relaxed font-mono bg-surface rounded p-2">
                            {perf.visualPrompt}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-surface-elevated border border-border rounded-xl p-4 flex items-center justify-center">
                      <p className="text-xs text-text-muted">No performance spec for this segment</p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Shots Tab ── */}
      {tab === "shots" && <ShotGrid shots={shots} />}
    </div>
  );
}
