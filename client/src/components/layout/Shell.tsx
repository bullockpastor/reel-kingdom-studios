import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { StudioStatusBar } from "./StudioStatusBar";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-surface">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <StudioStatusBar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
