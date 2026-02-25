import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateProject, useGenerateStoryboard } from "@/api/hooks";
import { X, Loader2 } from "lucide-react";

type Format = "horizontal" | "vertical" | "square";

const FORMATS: { value: Format; label: string; desc: string }[] = [
  { value: "horizontal", label: "16:9", desc: "Horizontal" },
  { value: "vertical", label: "9:16", desc: "Vertical" },
  { value: "square", label: "1:1", desc: "Square" },
];

export function CreateWizard({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const generateStoryboard = useGenerateStoryboard();

  const [step, setStep] = useState<"idea" | "generating" | "done">("idea");
  const [idea, setIdea] = useState("");
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<Format>("horizontal");
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!idea.trim()) return;
    setError("");

    try {
      const project = await createProject.mutateAsync({
        idea: idea.trim(),
        title: title.trim() || undefined,
        format,
      });

      setStep("generating");

      await generateStoryboard.mutateAsync(project.id);

      setStep("done");
      onClose();
      navigate(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("idea");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-elevated border border-border rounded-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">New Project</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {step === "generating" && (
            <div className="flex flex-col items-center py-12 gap-4">
              <Loader2 size={32} className="animate-spin text-accent" />
              <p className="text-text-secondary text-sm">
                Generating storyboard with AI agents...
              </p>
              <p className="text-text-muted text-xs">This may take 30-60 seconds</p>
            </div>
          )}

          {step === "idea" && (
            <>
              <div>
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">
                  Idea
                </label>
                <textarea
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder="Describe your video concept..."
                  rows={4}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-1">
                  Title (optional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Auto-generated if blank"
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-2">
                  Format
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {FORMATS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setFormat(f.value)}
                      className={`border rounded-lg p-3 text-center transition-colors ${
                        format === f.value
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border text-text-secondary hover:border-text-muted"
                      }`}
                    >
                      <p className="text-lg font-bold">{f.label}</p>
                      <p className="text-xs">{f.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-sm text-danger">{error}</p>
              )}

              <button
                onClick={handleCreate}
                disabled={!idea.trim() || createProject.isPending}
                className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium transition-colors"
              >
                {createProject.isPending ? "Creating..." : "Create & Generate Storyboard"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
