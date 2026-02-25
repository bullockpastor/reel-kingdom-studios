import { cn } from "@/lib/utils";

type Format = "horizontal" | "vertical" | "square";

const FORMATS: { value: Format; label: string; desc: string; aspect: string }[] = [
  { value: "horizontal", label: "16:9", desc: "Horizontal", aspect: "aspect-video" },
  { value: "vertical", label: "9:16", desc: "Vertical", aspect: "aspect-[9/16]" },
  { value: "square", label: "1:1", desc: "Square", aspect: "aspect-square" },
];

export function FormatSelector({
  value,
  onChange,
}: {
  value: Format;
  onChange: (f: Format) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {FORMATS.map((f) => (
        <button
          key={f.value}
          onClick={() => onChange(f.value)}
          className={cn(
            "border rounded-lg p-3 text-center transition-colors",
            value === f.value
              ? "border-accent bg-accent/10 text-accent"
              : "border-border text-text-secondary hover:border-text-muted"
          )}
        >
          <p className="text-lg font-bold">{f.label}</p>
          <p className="text-xs">{f.desc}</p>
        </button>
      ))}
    </div>
  );
}
