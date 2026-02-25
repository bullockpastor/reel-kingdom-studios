import { useQueueStatus } from "@/api/hooks";

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-surface-elevated border border-border rounded-lg p-4">
      <p className="text-xs text-text-muted uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

export function QueueOverview() {
  const { data: queue } = useQueueStatus();

  const active = (queue?.render.counts.active ?? 0) + (queue?.assembly.counts.active ?? 0);
  const pending = (queue?.render.counts.waiting ?? 0) + (queue?.assembly.counts.waiting ?? 0);
  const failed = (queue?.render.counts.failed ?? 0) + (queue?.assembly.counts.failed ?? 0);

  return (
    <div>
      <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
        Queue
      </h2>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Active" value={active} color={active > 0 ? "text-warning" : "text-text-primary"} />
        <StatCard label="Pending" value={pending} color="text-text-primary" />
        <StatCard label="Failed" value={failed} color={failed > 0 ? "text-danger" : "text-text-primary"} />
      </div>
    </div>
  );
}
