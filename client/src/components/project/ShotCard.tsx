import type { Shot } from "@/api/types";
import { StatusBadge } from "./StatusBadge";
import { VideoPlayer } from "./VideoPlayer";
import { useRenderShot } from "@/api/hooks";
import { Loader2, Play, RotateCcw } from "lucide-react";

export function ShotCard({ shot }: { shot: Shot }) {
  const renderShot = useRenderShot();

  const canRender = shot.status === "pending" || shot.status === "failed";
  const isRendering = shot.status === "rendering" || shot.status === "queued";

  function handleRender() {
    renderShot.mutate({ id: shot.id });
  }

  return (
    <div className="bg-surface-elevated border border-border rounded-lg overflow-hidden">
      {/* Video preview or placeholder */}
      <div className="aspect-video bg-black relative">
        {shot.renderUrl && shot.status === "rendered" ? (
          <VideoPlayer src={shot.renderUrl} className="w-full h-full object-contain" />
        ) : isRendering ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-warning" />
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
          <button
            onClick={handleRender}
            disabled={renderShot.isPending}
            className="w-full flex items-center justify-center gap-2 bg-accent/10 hover:bg-accent/20 text-accent rounded-md py-1.5 text-xs font-medium transition-colors"
          >
            {shot.status === "failed" ? (
              <>
                <RotateCcw size={12} /> Re-render
              </>
            ) : (
              <>
                <Play size={12} /> Render Draft
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
