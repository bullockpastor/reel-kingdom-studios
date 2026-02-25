import { Link } from "react-router-dom";
import type { Project } from "@/api/types";
import { StatusBadge } from "./StatusBadge";
import { FORMAT_LABELS } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      to={`/projects/${project.id}`}
      className="block bg-surface-elevated border border-border rounded-lg p-4 hover:border-accent/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-text-primary truncate">
          {project.title}
        </h3>
        <StatusBadge status={project.status} />
      </div>
      <p className="text-xs text-text-muted mt-1 line-clamp-2">{project.idea}</p>
      <div className="flex items-center gap-3 mt-3 text-xs text-text-muted">
        <span>{FORMAT_LABELS[project.format] || project.format}</span>
        <span>{project._count?.shots ?? project.shotCount ?? 0} shots</span>
        <span>{timeAgo(project.createdAt)}</span>
      </div>
    </Link>
  );
}
