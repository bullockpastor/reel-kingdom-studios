import { useState } from "react";
import { useProjects } from "@/api/hooks";
import { HealthPanel } from "@/components/health/HealthPanel";
import { QueueOverview } from "@/components/queue/QueueOverview";
import { ProjectCard } from "@/components/project/ProjectCard";
import { CreateWizard } from "@/components/wizard/CreateWizard";
import { CreateProjectLauncher } from "@/components/CreateProjectLauncher";
import { Plus } from "lucide-react";

export function Dashboard() {
  const { data: projects } = useProjects();
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const recent = projects?.slice(0, 5) ?? [];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">Dashboard</h1>
        <button
          onClick={() => setLauncherOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Create Project
        </button>
      </div>

      <HealthPanel />
      <QueueOverview />

      <div>
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          Recent Projects
        </h2>
        {recent.length === 0 ? (
          <p className="text-sm text-text-muted">No projects yet. Create your first one!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recent.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </div>

      {launcherOpen && (
        <CreateProjectLauncher
          onClose={() => setLauncherOpen(false)}
          onSelectCinematic={() => setWizardOpen(true)}
        />
      )}

      {wizardOpen && <CreateWizard onClose={() => setWizardOpen(false)} />}
    </div>
  );
}
