import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { usePresenters, useCreatePresenter, useCreatePresenterProject } from "@/api/hooks";
import { StatusBadge } from "@/components/project/StatusBadge";
import { timeAgo } from "@/lib/utils";
import { Plus, Loader2, Video, User, ChevronDown, ChevronUp } from "lucide-react";
import type { Presenter } from "@/api/types";

const PROVIDERS = ["runway_gen4", "openai_sora", "google_veo", "kling_video"];
const VIDEO_TYPES = ["sermon", "devotional", "announcement", "social"];

export function Presenters() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: presenters, isLoading } = usePresenters();
  const createPresenter = useCreatePresenter();
  const createProject = useCreatePresenterProject();

  // Auto-open the new project panel when arriving from the Create Project launcher
  const locationState = location.state as { openNewProject?: boolean } | null;
  const [showNewPresenter, setShowNewPresenter] = useState(false);
  const [showNewProject, setShowNewProject] = useState(
    locationState?.openNewProject === true
  );

  // New presenter form state
  const [presenterForm, setPresenterForm] = useState({
    name: "",
    description: "",
    defaultProvider: "runway_gen4",
    defaultTemplateId: "",
    voiceId: "",
  });

  // New project form state
  const [projectForm, setProjectForm] = useState({
    rawScript: "",
    presenterId: "",
    title: "",
    videoType: "sermon",
    targetDurationSeconds: "",
    provider: "runway_gen4",
  });

  const [projectError, setProjectError] = useState<string | null>(null);

  async function handleCreatePresenter(e: React.FormEvent) {
    e.preventDefault();
    if (!presenterForm.name.trim() || !presenterForm.description.trim()) return;
    await createPresenter.mutateAsync({
      name: presenterForm.name.trim(),
      description: presenterForm.description.trim(),
      defaultProvider: presenterForm.defaultProvider,
      defaultTemplateId: presenterForm.defaultTemplateId.trim() || undefined,
      voiceId: presenterForm.voiceId.trim() || undefined,
    });
    setPresenterForm({ name: "", description: "", defaultProvider: "runway_gen4", defaultTemplateId: "", voiceId: "" });
    setShowNewPresenter(false);
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    setProjectError(null);
    if (!projectForm.rawScript.trim()) return;
    if (!projectForm.presenterId) return;

    try {
      const result = await createProject.mutateAsync({
        rawScript: projectForm.rawScript.trim(),
        presenterId: projectForm.presenterId,
        title: projectForm.title.trim() || undefined,
        videoType: projectForm.videoType,
        targetDurationSeconds: projectForm.targetDurationSeconds
          ? Number(projectForm.targetDurationSeconds)
          : undefined,
        provider: projectForm.provider,
      });
      navigate(`/presenter/projects/${result.project.id}`);
    } catch (err) {
      setProjectError(err instanceof Error ? err.message : "Failed to create presenter project");
    }
  }

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">Presenter</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowNewPresenter((v) => !v); setShowNewProject(false); }}
            className="flex items-center gap-2 px-4 py-2 border border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-lg text-sm font-medium transition-colors"
          >
            <User size={16} />
            New Presenter
          </button>
          <button
            onClick={() => { setShowNewProject((v) => !v); setShowNewPresenter(false); }}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            New Project
          </button>
        </div>
      </div>

      {/* New Presenter Panel */}
      {showNewPresenter && (
        <div className="bg-surface-elevated border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <User size={14} /> New Presenter Profile
          </h2>
          <form onSubmit={handleCreatePresenter} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Name</label>
                <input
                  type="text"
                  required
                  placeholder="Pastor Timothy H. Bullock"
                  value={presenterForm.name}
                  onChange={(e) => setPresenterForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Default Provider</label>
                <select
                  value={presenterForm.defaultProvider}
                  onChange={(e) => setPresenterForm((f) => ({ ...f, defaultProvider: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent"
                >
                  {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Description (used in visual prompts)</label>
              <textarea
                required
                rows={3}
                placeholder="Distinguished African American pastor in his 60s, silver hair, warm authoritative presence, dark suit with pocket square..."
                value={presenterForm.description}
                onChange={(e) => setPresenterForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent resize-none"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Default Template ID (optional)</label>
                <input
                  type="text"
                  placeholder="dark_wood_pulpit"
                  value={presenterForm.defaultTemplateId}
                  onChange={(e) => setPresenterForm((f) => ({ ...f, defaultTemplateId: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Voice ID (Phase 2 TTS)</label>
                <input
                  type="text"
                  placeholder="elevenlabs:xxx"
                  value={presenterForm.voiceId}
                  onChange={(e) => setPresenterForm((f) => ({ ...f, voiceId: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={createPresenter.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {createPresenter.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Create Presenter
              </button>
              <button
                type="button"
                onClick={() => setShowNewPresenter(false)}
                className="px-4 py-2 text-sm text-text-muted hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New Project Panel */}
      {showNewProject && (
        <div className="bg-surface-elevated border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Video size={14} /> New Presenter Project
          </h2>
          {projectError && (
            <div className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
              {projectError}
            </div>
          )}
          <form onSubmit={handleCreateProject} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Presenter</label>
                <select
                  required
                  value={projectForm.presenterId}
                  onChange={(e) => {
                    const selected = presenters?.find((p) => p.id === e.target.value);
                    setProjectForm((f) => ({
                      ...f,
                      presenterId: e.target.value,
                      provider: selected?.defaultProvider ?? f.provider,
                    }));
                  }}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="">Select presenter…</option>
                  {presenters?.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Video Type</label>
                <select
                  value={projectForm.videoType}
                  onChange={(e) => setProjectForm((f) => ({ ...f, videoType: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent"
                >
                  {VIDEO_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Target Duration (seconds, optional)</label>
                <input
                  type="number"
                  min={10}
                  max={300}
                  placeholder="60"
                  value={projectForm.targetDurationSeconds}
                  onChange={(e) => setProjectForm((f) => ({ ...f, targetDurationSeconds: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Premium Provider</label>
                <select
                  value={projectForm.provider}
                  onChange={(e) => setProjectForm((f) => ({ ...f, provider: e.target.value }))}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent"
                >
                  {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Title (optional)</label>
              <input
                type="text"
                placeholder="Automatically generated if blank"
                value={projectForm.title}
                onChange={(e) => setProjectForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Script</label>
              <textarea
                required
                rows={8}
                placeholder="Paste the full script here. The Script Director will break it into segments, assign delivery notes, and pace each phrase for camera…"
                value={projectForm.rawScript}
                onChange={(e) => setProjectForm((f) => ({ ...f, rawScript: e.target.value }))}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent resize-none font-mono"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={createProject.isPending || !projectForm.presenterId}
                className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {createProject.isPending ? (
                  <><Loader2 size={14} className="animate-spin" /> Directing…</>
                ) : (
                  <><Video size={14} /> Create & Direct</>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setShowNewProject(false); setProjectError(null); }}
                className="px-4 py-2 text-sm text-text-muted hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Presenter Profiles */}
      <div>
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          Presenter Profiles
        </h2>
        {isLoading ? (
          <div className="flex items-center gap-2 text-text-muted text-sm py-4">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        ) : !presenters || presenters.length === 0 ? (
          <p className="text-sm text-text-muted">No presenter profiles yet. Create one to get started.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {presenters.map((p) => (
              <PresenterCard key={p.id} presenter={p} onNewProject={() => {
                setProjectForm((f) => ({ ...f, presenterId: p.id, provider: p.defaultProvider }));
                setShowNewProject(true);
                setShowNewPresenter(false);
              }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PresenterCard({ presenter, onNewProject }: { presenter: Presenter; onNewProject: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-surface-elevated border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-text-primary truncate">{presenter.name}</h3>
            <StatusBadge status={presenter.defaultProvider} className="text-[10px] px-2 py-0.5" />
          </div>
          <p className="text-xs text-text-muted mt-1">{timeAgo(presenter.createdAt)}</p>
        </div>
        <button
          onClick={onNewProject}
          className="flex items-center gap-1 px-2 py-1 bg-accent/10 hover:bg-accent/20 text-accent rounded text-xs font-medium transition-colors whitespace-nowrap"
        >
          <Video size={10} /> New Project
        </button>
      </div>
      <div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          Description
        </button>
        {expanded && (
          <p className="text-xs text-text-secondary mt-2 leading-relaxed">{presenter.description}</p>
        )}
      </div>
      {presenter.defaultTemplateId && (
        <p className="text-xs text-text-muted">Template: <span className="text-text-secondary font-mono">{presenter.defaultTemplateId}</span></p>
      )}
    </div>
  );
}
