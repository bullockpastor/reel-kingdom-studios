import { useQueueStatus } from "@/api/hooks";
import { StatusBadge } from "@/components/project/StatusBadge";
import { timeAgo, formatDuration } from "@/lib/utils";
import { Loader2 } from "lucide-react";

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-surface-elevated border border-border rounded-lg p-4">
      <p className="text-xs text-text-muted uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function QueueSection({
  title,
  counts,
}: {
  title: string;
  counts: {
    active: number;
    waiting: number;
    completed: number;
    failed: number;
    delayed: number;
  };
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
        {title}
      </h2>
      <div className="grid grid-cols-5 gap-3">
        <StatCard
          label="Active"
          value={counts.active}
          color={counts.active > 0 ? "text-warning" : "text-text-primary"}
        />
        <StatCard label="Waiting" value={counts.waiting} color="text-text-primary" />
        <StatCard label="Delayed" value={counts.delayed} color="text-text-primary" />
        <StatCard
          label="Completed"
          value={counts.completed}
          color={counts.completed > 0 ? "text-success" : "text-text-primary"}
        />
        <StatCard
          label="Failed"
          value={counts.failed}
          color={counts.failed > 0 ? "text-danger" : "text-text-primary"}
        />
      </div>
    </div>
  );
}

export function Queue() {
  const { data: queue, isLoading } = useQueueStatus();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  const recentJobs = queue?.render.recent ?? [];

  return (
    <div className="space-y-8 max-w-5xl">
      <h1 className="text-xl font-bold text-text-primary">Queue Monitor</h1>

      {queue ? (
        <>
          <QueueSection title="Render Queue" counts={queue.render.counts} />
          <QueueSection title="Assembly Queue" counts={queue.assembly.counts} />

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
              Recent Render Jobs
            </h2>
            {recentJobs.length === 0 ? (
              <p className="text-sm text-text-muted">No recent jobs.</p>
            ) : (
              <div className="bg-surface-elevated border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-text-muted uppercase tracking-wider">
                      <th className="text-left px-4 py-3">Shot</th>
                      <th className="text-left px-4 py-3">Prompt</th>
                      <th className="text-left px-4 py-3">Engine</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-left px-4 py-3">Duration</th>
                      <th className="text-left px-4 py-3">Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentJobs.map((job) => (
                      <tr
                        key={job.id}
                        className="border-b border-border last:border-0 hover:bg-surface-hover transition-colors"
                      >
                        <td className="px-4 py-3 text-text-primary font-medium whitespace-nowrap">
                          #{(job.shot?.shotIndex ?? 0) + 1}
                        </td>
                        <td className="px-4 py-3 text-text-secondary max-w-xs truncate">
                          {job.shot?.prompt ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-text-muted capitalize whitespace-nowrap">
                          {job.engine}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={job.status} />
                        </td>
                        <td className="px-4 py-3 text-text-muted whitespace-nowrap">
                          {job.durationMs != null ? formatDuration(job.durationMs) : "—"}
                        </td>
                        <td className="px-4 py-3 text-text-muted whitespace-nowrap">
                          {timeAgo(job.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-text-muted">Unable to load queue status.</p>
      )}
    </div>
  );
}
