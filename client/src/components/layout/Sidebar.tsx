import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Film, ListOrdered, Video, Cpu, GitBranch } from "lucide-react";

const links = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/library", icon: Film, label: "Library" },
  { to: "/queue", icon: ListOrdered, label: "Queue" },
  { to: "/presenter", icon: Video, label: "Presenter" },
  { to: "/engines", icon: Cpu, label: "Engines" },
  { to: "/model-router", icon: GitBranch, label: "Model Router" },
];

export function Sidebar() {
  return (
    <aside className="w-56 bg-surface-elevated border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-bold text-text-primary tracking-tight">
          Reel Kingdom
        </h1>
        <p className="text-xs text-text-muted">Studios</p>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-accent/15 text-accent"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
              )
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
