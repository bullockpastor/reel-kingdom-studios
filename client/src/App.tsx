import { Routes, Route, Navigate } from "react-router-dom";
import { Shell } from "@/components/layout/Shell";
import { Dashboard } from "@/pages/Dashboard";
import { Library } from "@/pages/Library";
import { Queue } from "@/pages/Queue";
import { ProjectWorkspace } from "@/pages/ProjectWorkspace";
import { Presenters } from "@/pages/Presenters";
import { PresenterWorkspace } from "@/pages/PresenterWorkspace";
import { Engines } from "@/pages/Engines";
import { EngineCompare } from "@/pages/EngineCompare";

export function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/projects/:id" element={<ProjectWorkspace />} />
        <Route path="/library" element={<Library />} />
        <Route path="/queue" element={<Queue />} />
        <Route path="/presenter" element={<Presenters />} />
        <Route path="/presenter/projects/:id" element={<PresenterWorkspace />} />
        <Route path="/engines" element={<Engines />} />
        <Route path="/engines/compare" element={<EngineCompare />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
