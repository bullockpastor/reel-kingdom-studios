import { useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { usePresenters, usePresenterTemplates, useCreatePresenter, useCreatePresenterProject, useUpdatePresenter, useUploadPresenterImage } from "@/api/hooks";
import { StatusBadge } from "@/components/project/StatusBadge";
import { timeAgo } from "@/lib/utils";
import { Plus, Loader2, Video, User, ChevronDown, ChevronUp, Pencil, Check, X, ImagePlus, CheckCircle2 } from "lucide-react";
import type { Presenter, PresenterTemplate } from "@/api/types";

const CATEGORY_LABELS: Record<string, string> = {
  church: "Church",
  studio: "Studio",
  office: "Office",
  outdoor: "Outdoor",
};

function TemplateSelector({
  templates,
  value,
  onChange,
}: {
  templates: PresenterTemplate[];
  value: string;
  onChange: (id: string) => void;
}) {
  const categories = ["church", "studio", "office", "outdoor"] as const;

  return (
    <div className="space-y-3">
      {categories.map((cat) => {
        const group = templates.filter((t) => t.category === cat);
        if (group.length === 0) return null;
        return (
          <div key={cat}>
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
              {CATEGORY_LABELS[cat]}
            </p>
            <div className="flex flex-wrap gap-2">
              {group.map((t) => {
                const selected = value === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onChange(selected ? "" : t.id)}
                    title={t.description}
                    className={`relative flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs transition-colors ${
                      selected
                        ? "border-accent bg-accent/10 text-text-primary"
                        : "border-border bg-surface hover:border-accent/50 text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${t.accentColor}`} />
                    <span className="font-medium">{t.label}</span>
                    {selected && <CheckCircle2 size={12} className="text-accent ml-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const PROVIDERS = ["runway_gen4", "openai_sora", "google_veo", "kling_video"];
const VIDEO_TYPES = ["sermon", "devotional", "announcement", "social"];

export function Presenters() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: presenters, isLoading } = usePresenters();
  const { data: templates = [] } = usePresenterTemplates();
  const createPresenter = useCreatePresenter();
  const createProject = useCreatePresenterProject();
  const uploadImage = useUploadPresenterImage();

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
  const [presenterImageFile, setPresenterImageFile] = useState<File | null>(null);
  const [presenterImagePreview, setPresenterImagePreview] = useState<string | null>(null);
  const createImageInputRef = useRef<HTMLInputElement>(null);

  // New project form state
  const [projectForm, setProjectForm] = useState({
    rawScript: "",
    presenterId: "",
    title: "",
    videoType: "sermon",
    targetDurationSeconds: "",
    provider: "runway_gen4",
    templatePreference: "",
  });

  const [projectError, setProjectError] = useState<string | null>(null);

  async function handleCreatePresenter(e: React.FormEvent) {
    e.preventDefault();
    if (!presenterForm.name.trim() || !presenterForm.description.trim()) return;
    const created = await createPresenter.mutateAsync({
      name: presenterForm.name.trim(),
      description: presenterForm.description.trim(),
      defaultProvider: presenterForm.defaultProvider,
      defaultTemplateId: presenterForm.defaultTemplateId.trim() || undefined,
      voiceId: presenterForm.voiceId.trim() || undefined,
    });
    if (presenterImageFile) {
      await uploadImage.mutateAsync({ id: created.id, file: presenterImageFile });
    }
    setPresenterForm({ name: "", description: "", defaultProvider: "runway_gen4", defaultTemplateId: "", voiceId: "" });
    setPresenterImageFile(null);
    setPresenterImagePreview(null);
    setShowNewPresenter(false);
  }

  function handleCreateImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPresenterImageFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setPresenterImagePreview(url);
    } else {
      setPresenterImagePreview(null);
    }
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
        templatePreference: projectForm.templatePreference || undefined,
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
            {/* Reference image */}
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Reference Image (optional)</label>
              <div className="flex items-center gap-3">
                {presenterImagePreview ? (
                  <img src={presenterImagePreview} alt="preview" className="w-16 h-16 rounded-lg object-cover border border-border flex-shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-lg border border-dashed border-border flex items-center justify-center flex-shrink-0">
                    <ImagePlus size={20} className="text-text-muted" />
                  </div>
                )}
                <div className="flex-1">
                  <button
                    type="button"
                    onClick={() => createImageInputRef.current?.click()}
                    className="px-3 py-1.5 text-xs border border-border rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
                  >
                    {presenterImageFile ? presenterImageFile.name : "Choose image…"}
                  </button>
                  {presenterImageFile && (
                    <button
                      type="button"
                      onClick={() => { setPresenterImageFile(null); setPresenterImagePreview(null); if (createImageInputRef.current) createImageInputRef.current.value = ""; }}
                      className="ml-2 text-xs text-text-muted hover:text-text-primary"
                    >
                      Remove
                    </button>
                  )}
                  <p className="text-[11px] text-text-muted mt-1">Used by Runway for identity anchoring. JPEG, PNG, or WebP, max 20 MB.</p>
                </div>
              </div>
              <input
                ref={createImageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleCreateImageChange}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Default Template (optional)</label>
              <TemplateSelector
                templates={templates}
                value={presenterForm.defaultTemplateId}
                onChange={(id) => setPresenterForm((f) => ({ ...f, defaultTemplateId: id }))}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                disabled={createPresenter.isPending || uploadImage.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {(createPresenter.isPending || uploadImage.isPending) ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {uploadImage.isPending ? "Uploading…" : "Create Presenter"}
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
            {templates.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  Template Override
                  <span className="ml-1 text-text-muted font-normal">(optional — defaults to presenter's template)</span>
                </label>
                <TemplateSelector
                  templates={templates}
                  value={projectForm.templatePreference}
                  onChange={(id) => setProjectForm((f) => ({ ...f, templatePreference: id }))}
                />
              </div>
            )}
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
              <PresenterCard key={p.id} presenter={p} templates={templates} onNewProject={() => {
                setProjectForm((f) => ({ ...f, presenterId: p.id, provider: p.defaultProvider, templatePreference: p.defaultTemplateId ?? "" }));
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

function PresenterCard({ presenter, templates, onNewProject }: { presenter: Presenter; templates: PresenterTemplate[]; onNewProject: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const updatePresenter = useUpdatePresenter();
  const uploadImage = useUploadPresenterImage();
  const editImageInputRef = useRef<HTMLInputElement>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);

  const [editForm, setEditForm] = useState({
    name: presenter.name,
    description: presenter.description,
    voiceId: presenter.voiceId ?? "",
    defaultProvider: presenter.defaultProvider,
    defaultTemplateId: presenter.defaultTemplateId ?? "",
  });

  function handleEditImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setEditImageFile(file);
    setEditImagePreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSave() {
    await updatePresenter.mutateAsync({
      id: presenter.id,
      data: {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        voiceId: editForm.voiceId.trim() || undefined,
        defaultProvider: editForm.defaultProvider,
        defaultTemplateId: editForm.defaultTemplateId.trim() || undefined,
      },
    });
    if (editImageFile) {
      await uploadImage.mutateAsync({ id: presenter.id, file: editImageFile });
    }
    setEditing(false);
    setEditImageFile(null);
    setEditImagePreview(null);
  }

  if (editing) {
    return (
      <div className="bg-surface-elevated border border-accent/40 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-text-primary">Edit Presenter</span>
          <button onClick={() => setEditing(false)} className="text-text-muted hover:text-text-primary">
            <X size={14} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">Name</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-2 py-1.5 bg-surface border border-border rounded text-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Default Provider</label>
            <select
              value={editForm.defaultProvider}
              onChange={(e) => setEditForm((f) => ({ ...f, defaultProvider: e.target.value }))}
              className="w-full px-2 py-1.5 bg-surface border border-border rounded text-sm text-text-primary focus:outline-none focus:border-accent"
            >
              {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Voice ID (ElevenLabs)</label>
          <input
            type="text"
            placeholder="e.g. 21m00Tcm4TlvDq8ikWAM"
            value={editForm.voiceId}
            onChange={(e) => setEditForm((f) => ({ ...f, voiceId: e.target.value }))}
            className="w-full px-2 py-1.5 bg-surface border border-border rounded text-sm text-text-primary font-mono focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Reference Image</label>
          <div className="flex items-center gap-2">
            {(editImagePreview ?? presenter.referenceImageUrl) ? (
              <img
                src={editImagePreview ?? presenter.referenceImageUrl!}
                alt="reference"
                className="w-12 h-12 rounded object-cover border border-border flex-shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded border border-dashed border-border flex items-center justify-center flex-shrink-0">
                <ImagePlus size={16} className="text-text-muted" />
              </div>
            )}
            <button
              type="button"
              onClick={() => editImageInputRef.current?.click()}
              className="px-2 py-1 text-xs border border-border rounded text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
            >
              {editImageFile ? editImageFile.name : presenter.referenceImageUrl ? "Replace" : "Choose…"}
            </button>
            {editImageFile && (
              <button
                type="button"
                onClick={() => { setEditImageFile(null); setEditImagePreview(null); if (editImageInputRef.current) editImageInputRef.current.value = ""; }}
                className="text-xs text-text-muted hover:text-text-primary"
              >
                <X size={12} />
              </button>
            )}
            <input
              ref={editImageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleEditImageChange}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Description</label>
          <textarea
            rows={3}
            value={editForm.description}
            onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
            className="w-full px-2 py-1.5 bg-surface border border-border rounded text-sm text-text-primary focus:outline-none focus:border-accent resize-none"
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Default Template</label>
          <TemplateSelector
            templates={templates}
            value={editForm.defaultTemplateId}
            onChange={(id) => setEditForm((f) => ({ ...f, defaultTemplateId: id }))}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={updatePresenter.isPending || uploadImage.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded text-xs font-medium transition-colors"
          >
            {(updatePresenter.isPending || uploadImage.isPending) ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            {uploadImage.isPending ? "Uploading…" : "Save"}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-elevated border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        {/* Reference image thumbnail */}
        {presenter.referenceImageUrl ? (
          <img
            src={presenter.referenceImageUrl}
            alt={presenter.name}
            className="w-12 h-12 rounded-lg object-cover border border-border flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg border border-dashed border-border flex items-center justify-center flex-shrink-0">
            <User size={18} className="text-text-muted" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-text-primary truncate">{presenter.name}</h3>
            <StatusBadge status={presenter.defaultProvider} className="text-[10px] px-2 py-0.5" />
          </div>
          <p className="text-xs text-text-muted mt-1">{timeAgo(presenter.createdAt)}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded transition-colors"
            title="Edit presenter"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={onNewProject}
            className="flex items-center gap-1 px-2 py-1 bg-accent/10 hover:bg-accent/20 text-accent rounded text-xs font-medium transition-colors whitespace-nowrap"
          >
            <Video size={10} /> New Project
          </button>
        </div>
      </div>
      {presenter.voiceId && (
        <p className="text-xs text-text-muted">
          Voice: <span className="text-text-secondary font-mono">{presenter.voiceId}</span>
        </p>
      )}
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
      {presenter.defaultTemplateId && (() => {
        const tpl = templates.find((t) => t.id === presenter.defaultTemplateId);
        return (
          <div className="flex items-center gap-1.5">
            {tpl && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${tpl.accentColor}`} />}
            <p className="text-xs text-text-muted">
              Template: <span className="text-text-secondary">{tpl?.label ?? presenter.defaultTemplateId}</span>
            </p>
          </div>
        );
      })()}
    </div>
  );
}
