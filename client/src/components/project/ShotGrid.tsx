import type { Shot } from "@/api/types";
import { ShotCard } from "./ShotCard";

export function ShotGrid({ shots }: { shots: Shot[] }) {
  if (shots.length === 0) {
    return <p className="text-sm text-text-muted">No shots yet.</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {shots.map((shot) => (
        <ShotCard key={shot.id} shot={shot} />
      ))}
    </div>
  );
}
