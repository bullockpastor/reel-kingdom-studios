import { useProjects } from "@/api/hooks";
import { ProjectCard } from "@/components/project/ProjectCard";
import { Loader2 } from "lucide-react";

export function Library() {
  const { data: projects, isLoading } = useProjects();

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">
          Library
          {projects && (
            <span className="ml-2 text-sm font-normal text-text-muted">
              {projects.length} project{projects.length !== 1 ? "s" : ""}
            </span>
          )}
        </h1>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={24} className="animate-spin text-text-muted" />
        </div>
      ) : !projects || projects.length === 0 ? (
        <p className="text-sm text-text-muted">No projects yet. Create one from the Dashboard.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
