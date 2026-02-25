export const STATUS_COLORS: Record<string, string> = {
  // Project statuses
  created: "bg-zinc-700 text-zinc-300",
  storyboarded: "bg-blue-900 text-blue-300",
  rendering: "bg-amber-900 text-amber-300",
  assembling: "bg-amber-900 text-amber-300",
  assembled: "bg-green-900 text-green-300",
  failed: "bg-red-900 text-red-300",
  // Shot statuses
  pending: "bg-zinc-700 text-zinc-300",
  queued: "bg-violet-900 text-violet-300",
  rendered: "bg-green-900 text-green-300",
  premium_routed: "bg-purple-900 text-purple-300",
  // Service statuses
  ok: "bg-green-900 text-green-300",
  down: "bg-red-900 text-red-300",
  not_configured: "bg-zinc-700 text-zinc-400",
  // Job statuses
  processing: "bg-amber-900 text-amber-300",
  completed: "bg-green-900 text-green-300",
};

export const FORMAT_LABELS: Record<string, string> = {
  horizontal: "16:9 Horizontal",
  vertical: "9:16 Vertical",
  square: "1:1 Square",
};

export const SERVICE_ICONS: Record<string, string> = {
  Ollama: "Brain",
  ComfyUI: "Palette",
  Redis: "Database",
  STUDIO_ROOT: "HardDrive",
  FFmpeg: "Film",
  "Premium Renderer": "Crown",
};
