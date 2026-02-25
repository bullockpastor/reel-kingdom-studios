import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useProject, useGenerateStoryboard, useRenderAll, useAssemble } from "@/api/hooks";
import { StatusBadge } from "@/components/project/StatusBadge";
import { ShotGrid } from "@/components/project/ShotGrid";
import { VideoPlayer } from "@/components/project/VideoPlayer";
import { FORMAT_LABELS } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";
import { ArrowLeft, Loader2, Wand2, Play, Film } from "lucide-react";

type Tab = "overview" | "storyboard" | "assembly";

export function ProjectWorkspace() {
  const { id } = useParams<{ id: string }>();
  const { data: project, isLoading } = useProject(id!);
  const generateStoryboard = useGenerateStoryboard();
  const renderAll = useRenderAll();
  const assemble = useAssemble();
  const [tab, setTab] = useState<Tab>("overview");

  if (isLoading || !project) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  const shots = project.shots ?? [];
  const allRendered = shots.length > 0 && shots.every((s) => s.status === "rendered");
  const anyRendering = shots.some((s) => s.status === "rendering" || s.status === "queued");

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: "overview", label: "Overview", show: true },
    { key: "storyboard", label: `Storyboard (${shots.length})`, show: shots.length > 0 },
    { key: "assembly", label: "Assembly", show: allRendered || project.status === "assembled" || project.status === "assembling" },
  ];

  return (
    <div className="max-w-5xl space-y-6">
      {/* Back link */}
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary">
        <ArrowLeft size={14} /> Dashboard
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text-primary">{project.title}</h1>
          <p className="text-sm text-text-secondary mt-1">{project.idea}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
            <span>{FORMAT_LABELS[project.format] || project.format}</span>
            <span>{project.targetWidth}x{project.targetHeight}</span>
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

      {/* Tab content */}
      {tab === "overview" && (
        <div className="space-y-4">
          {/* Contextual actions */}
          {project.status === "created" && (
            <button
              onClick={() => generateStoryboard.mutate(id!)}
              disabled={generateStoryboard.isPending}
              className="flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              {generateStoryboard.isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Generating...</>
              ) : (
                <><Wand2 size={16} /> Generate Storyboard</>
              )}
            </button>
          )}

          {project.status === "storyboarded" && shots.length > 0 && (
            <button
              onClick={() => renderAll.mutate(id!)}
              disabled={renderAll.isPending}
              className="flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              {renderAll.isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Queuing...</>
              ) : (
                <><Play size={16} /> Render All Shots</>
              )}
            </button>
          )}

          {anyRendering && (
            <div className="flex items-center gap-2 text-warning text-sm">
              <Loader2 size={16} className="animate-spin" />
              Rendering in progress...
            </div>
          )}

          {allRendered && project.status !== "assembled" && project.status !== "assembling" && (
            <button
              onClick={() => assemble.mutate(id!)}
              disabled={assemble.isPending}
              className="flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              {assemble.isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Assembling...</>
              ) : (
                <><Film size={16} /> Assemble Video</>
              )}
            </button>
          )}

          {project.status === "assembled" && project.outputUrl && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-text-primary">Final Video</h3>
              <VideoPlayer src={project.outputUrl} />
            </div>
          )}

          {/* Shot summary */}
          {shots.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
                Shots Summary
              </h3>
              <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                {shots.map((s) => (
                  <div
                    key={s.id}
                    className="bg-surface-elevated border border-border rounded-md p-2 text-center cursor-pointer hover:border-accent/50"
                    onClick={() => setTab("storyboard")}
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

      {tab === "storyboard" && <ShotGrid shots={shots} />}

      {tab === "assembly" && (
        <div className="space-y-4">
          {project.status === "assembled" && project.outputUrl ? (
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-3">Final Video</h3>
              <VideoPlayer src={project.outputUrl} />
            </div>
          ) : project.status === "assembling" ? (
            <div className="flex items-center gap-2 text-warning text-sm py-8 justify-center">
              <Loader2 size={16} className="animate-spin" />
              Assembling video...
            </div>
          ) : allRendered ? (
            <div className="text-center py-8">
              <p className="text-text-secondary mb-4">All shots rendered. Ready to assemble.</p>
              <button
                onClick={() => assemble.mutate(id!)}
                disabled={assemble.isPending}
                className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg px-6 py-2 text-sm font-medium transition-colors"
              >
                <Film size={16} /> Assemble Video
              </button>
            </div>
          ) : (
            <p className="text-text-muted text-sm">Render all shots first before assembling.</p>
          )}
        </div>
      )}
    </div>
  );
}
