import { cn } from "@/lib/utils";

export function VideoPlayer({ src, className }: { src: string; className?: string }) {
  return (
    <video
      src={src}
      controls
      playsInline
      className={cn("w-full rounded-lg bg-black", className)}
    />
  );
}
