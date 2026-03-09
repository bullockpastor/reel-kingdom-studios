import {
  Palette,
  Play,
  Film,
  Crown,
  ListOrdered,
  HardDrive,
  AlertCircle,
} from "lucide-react";
import { useHealth, useQueueStatus } from "@/api/hooks";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type PillStatus = "ok" | "warn" | "down" | "muted";

// ─── Provider label prettifier ───────────────────────────────────────────────

const PROVIDER_LABELS: Record<string, string> = {
  runway_gen4: "Runway",
  openai_sora: "Sora",
  kling_video: "Kling",
  google_veo: "Veo",
};

function prettyProvider(raw: string): string {
  return PROVIDER_LABELS[raw] ?? raw;
}

// ─── Pill primitives ─────────────────────────────────────────────────────────

function dot(status: PillStatus): string {
  return cn("w-1.5 h-1.5 rounded-full flex-shrink-0", {
    "bg-green-400": status === "ok",
    "bg-amber-400": status === "warn",
    "bg-red-500":   status === "down",
    "bg-zinc-600":  status === "muted",
  });
}

function pillCls(status: PillStatus): string {
  return cn(
    "flex items-center gap-1 px-2 py-0.5 rounded border text-[10.5px] font-medium whitespace-nowrap flex-shrink-0",
    {
      "bg-green-950/50 text-green-400 border-green-900/60": status === "ok",
      "bg-amber-950/50 text-amber-400 border-amber-900/60": status === "warn",
      "bg-red-950/50  text-red-400   border-red-900/60":   status === "down",
      "bg-zinc-900    text-zinc-500   border-zinc-800":     status === "muted",
    }
  );
}

function Pill({
  icon: Icon,
  label,
  status,
}: {
  icon: React.ElementType;
  label: string;
  status: PillStatus;
}) {
  return (
    <span className={pillCls(status)}>
      <span className={dot(status)} />
      <Icon size={10} className="flex-shrink-0 opacity-80" />
      <span>{label}</span>
    </span>
  );
}

function Divider() {
  return <span className="w-px h-3.5 bg-border flex-shrink-0 mx-0.5" />;
}

// ─── StudioStatusBar ─────────────────────────────────────────────────────────

export function StudioStatusBar() {
  const { data: health } = useHealth();
  const { data: queue } = useQueueStatus();

  function svc(name: string) {
    return health?.services.find((s) => s.name === name);
  }

  // ── ComfyUI ──
  const comfyui = svc("ComfyUI");
  const comfyuiStatus: PillStatus = !health
    ? "muted"
    : comfyui?.status === "ok"
    ? "ok"
    : "down";
  const comfyuiLabel = comfyuiStatus === "ok" ? "ComfyUI Online" : "ComfyUI Offline";

  // ── Redis → worker proxy ──
  const redis = svc("Redis");
  const redisOk = redis?.status === "ok";

  // ── Render Worker ──
  const renderActive = queue?.render.counts.active ?? 0;
  const renderWorkerStatus: PillStatus = !health
    ? "muted"
    : !redisOk
    ? "down"
    : renderActive > 0
    ? "warn"
    : "ok";
  const renderLabel =
    !health       ? "Render: —"          :
    !redisOk      ? "Render: Down"       :
    renderActive  ? `Render: ${renderActive} active` :
                    "Render: Ready";

  // ── Assembly Worker ──
  const assemblyActive = queue?.assembly.counts.active ?? 0;
  const assemblyWorkerStatus: PillStatus = !health
    ? "muted"
    : !redisOk
    ? "down"
    : assemblyActive > 0
    ? "warn"
    : "ok";
  const assemblyLabel =
    !health         ? "Assembly: —"            :
    !redisOk        ? "Assembly: Down"         :
    assemblyActive  ? `Assembly: ${assemblyActive} active` :
                      "Assembly: Ready";

  // ── Premium Provider ──
  const premium = svc("Premium Video");
  const premiumStatus: PillStatus =
    !health                             ? "muted" :
    premium?.status === "ok"            ? "ok"    :
    premium?.status === "not_configured"? "muted" :
                                          "down";
  const premiumLabel =
    premium?.status === "ok"
      ? `Premium: ${prettyProvider(premium.message ?? "")}`
      : premium?.status === "not_configured"
      ? "Premium: None"
      : "Premium: Error";

  // ── Queue totals ──
  const totalActive  = renderActive + assemblyActive;
  const totalWaiting = (queue?.render.counts.waiting  ?? 0) + (queue?.assembly.counts.waiting  ?? 0);
  const totalFailed  = (queue?.render.counts.failed   ?? 0) + (queue?.assembly.counts.failed   ?? 0);
  const queueStatus: PillStatus = !queue
    ? "muted"
    : totalFailed > 0
    ? "warn"
    : totalActive > 0
    ? "warn"
    : "ok";
  const queueLabel = !queue
    ? "Queue: —"
    : `Queue: ${totalActive} active / ${totalWaiting} waiting`;

  // ── Storage ──
  const studioRoot = svc("STUDIO_ROOT");
  const storageStatus: PillStatus = !health
    ? "muted"
    : studioRoot?.status === "ok"
    ? "ok"
    : "down";
  const storageLabel =
    !health                       ? "Storage: —"       :
    studioRoot?.status === "ok"   ? "Storage: Mounted" :
                                    "Storage: Missing";

  return (
    <div className="h-8 border-b border-border bg-surface flex items-center px-6 gap-1.5 overflow-x-auto flex-shrink-0">
      {/* Workers */}
      <Pill icon={Palette} label={comfyuiLabel}    status={comfyuiStatus}        />
      <Pill icon={Play}    label={renderLabel}     status={renderWorkerStatus}   />
      <Pill icon={Film}    label={assemblyLabel}   status={assemblyWorkerStatus} />

      <Divider />

      {/* Premium */}
      <Pill icon={Crown} label={premiumLabel} status={premiumStatus} />

      <Divider />

      {/* Queue */}
      <Pill icon={ListOrdered} label={queueLabel} status={queueStatus} />

      {/* Failed alert — only shown when there are failures */}
      {totalFailed > 0 && (
        <Pill
          icon={AlertCircle}
          label={`${totalFailed} failed`}
          status="down"
        />
      )}

      <Divider />

      {/* Storage */}
      <Pill icon={HardDrive} label={storageLabel} status={storageStatus} />
    </div>
  );
}
