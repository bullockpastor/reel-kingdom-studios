import { useState } from "react";
import type { Shot } from "@/api/types";
import { ShotCard } from "./ShotCard";
import { useReorderShots } from "@/api/hooks";

export function ShotGrid({ shots, projectId }: { shots: Shot[]; projectId?: string }) {
  const reorderShots = useReorderShots();
  const [dragId, setDragId] = useState<string | null>(null);

  if (shots.length === 0) {
    return <p className="text-sm text-text-muted">No shots yet.</p>;
  }

  const handleDragStart = (e: React.DragEvent, shotId: string) => {
    setDragId(shotId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", shotId);
    (e.target as HTMLElement).style.opacity = "0.5";
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = "1";
    setDragId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, dropShotId: string) => {
    e.preventDefault();
    const dragShotId = e.dataTransfer.getData("text/plain");
    if (!dragShotId || dragShotId === dropShotId || !projectId) return;

    const currentOrder = shots.map((s) => s.id);
    const dragIdx = currentOrder.indexOf(dragShotId);
    const dropIdx = currentOrder.indexOf(dropShotId);
    if (dragIdx === -1 || dropIdx === -1) return;

    const reordered = [...currentOrder];
    reordered.splice(dragIdx, 1);
    reordered.splice(dropIdx, 0, dragShotId);
    reorderShots.mutate({ projectId, shotIds: reordered });
  };

  const draggable = !!projectId && shots.length > 1;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {shots.map((shot) => (
        <ShotCard
          key={shot.id}
          shot={shot}
          projectId={projectId}
          draggable={draggable}
          onDragStart={draggable ? (e) => handleDragStart(e, shot.id) : undefined}
          onDragOver={draggable ? handleDragOver : undefined}
          onDrop={draggable ? (e) => handleDrop(e, shot.id) : undefined}
          onDragEnd={draggable ? handleDragEnd : undefined}
        />
      ))}
    </div>
  );
}
