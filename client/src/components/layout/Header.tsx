import { useHealth } from "@/api/hooks";
import { useQueueStatus } from "@/api/hooks";

export function Header() {
  const { data: health } = useHealth();
  const { data: queue } = useQueueStatus();

  const activeJobs =
    (queue?.render.counts.active ?? 0) + (queue?.assembly.counts.active ?? 0);

  return (
    <header className="h-12 border-b border-border bg-surface-elevated flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-4 text-sm">
        {activeJobs > 0 && (
          <span className="text-warning text-xs font-medium">
            {activeJobs} job{activeJobs > 1 ? "s" : ""} running
          </span>
        )}
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              health?.healthy ? "bg-success animate-pulse" : "bg-danger"
            }`}
          />
          <span className="text-text-muted text-xs">
            {health?.healthy ? "All systems go" : "Issues detected"}
          </span>
        </div>
      </div>
    </header>
  );
}
