import { useHealth } from "@/api/hooks";
import { StatusBadge } from "@/components/project/StatusBadge";
import { Brain, Palette, Database, HardDrive, Film, Crown } from "lucide-react";
import type { ServiceStatus } from "@/api/types";

const ICONS: Record<string, React.ElementType> = {
  Ollama: Brain,
  ComfyUI: Palette,
  Redis: Database,
  STUDIO_ROOT: HardDrive,
  FFmpeg: Film,
  "Premium Renderer": Crown,
};

function ServiceCard({ service }: { service: ServiceStatus }) {
  const Icon = ICONS[service.name] || Database;
  return (
    <div className="bg-surface-elevated border border-border rounded-lg p-4 flex items-center gap-3">
      <Icon size={20} className="text-text-muted flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{service.name}</p>
        {service.message && (
          <p className="text-xs text-text-muted truncate">{service.message}</p>
        )}
      </div>
      <StatusBadge status={service.status} />
    </div>
  );
}

export function HealthPanel() {
  const { data: health, isLoading } = useHealth();

  if (isLoading) {
    return <div className="text-text-muted text-sm">Loading health...</div>;
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
        System Health
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {health?.services.map((s) => <ServiceCard key={s.name} service={s} />)}
      </div>
    </div>
  );
}
