import { useNavigate } from "react-router-dom";
import { X, Film, Mic } from "lucide-react";

interface Props {
  onClose: () => void;
  onSelectCinematic: () => void;
}

export function CreateProjectLauncher({ onClose, onSelectCinematic }: Props) {
  const navigate = useNavigate();

  function handleCinematic() {
    onClose();
    onSelectCinematic();
  }

  function handlePresenter() {
    onClose();
    navigate("/presenter", { state: { openNewProject: true } });
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-elevated border border-border rounded-2xl w-full max-w-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-5">
          <div>
            <h2 className="text-xl font-bold text-text-primary tracking-tight">
              Create Project
            </h2>
            <p className="text-sm text-text-muted mt-0.5">
              Choose a creation mode to begin.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors p-1 rounded-lg hover:bg-surface-hover"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mode cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-6 pb-6">
          {/* ── Cinematic ── */}
          <button
            onClick={handleCinematic}
            className="group text-left bg-surface border border-border hover:border-accent/60 rounded-xl p-5 transition-all duration-150 hover:bg-accent/5 focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-accent/10 group-hover:bg-accent/20 transition-colors mb-4">
              <Film size={22} className="text-accent" />
            </div>
            <h3 className="text-base font-semibold text-text-primary mb-2 leading-tight">
              Cinematic Video
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed mb-5">
              Storyboard-driven AI video for scenes, b-roll, and visual
              storytelling.
            </p>
            <span className="text-sm font-medium text-accent group-hover:translate-x-0.5 transition-transform inline-block">
              Start Cinematic Project →
            </span>
          </button>

          {/* ── Presenter ── */}
          <button
            onClick={handlePresenter}
            className="group text-left bg-surface border border-border hover:border-violet-500/60 rounded-xl p-5 transition-all duration-150 hover:bg-violet-500/5 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
          >
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-violet-500/10 group-hover:bg-violet-500/20 transition-colors mb-4">
              <Mic size={22} className="text-violet-400" />
            </div>
            <h3 className="text-base font-semibold text-text-primary mb-2 leading-tight">
              Presenter Video
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed mb-5">
              AI presenter delivers your script for sermons, devotionals,
              announcements, and social clips.
            </p>
            <span className="text-sm font-medium text-violet-400 group-hover:translate-x-0.5 transition-transform inline-block">
              Start Presenter Project →
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
