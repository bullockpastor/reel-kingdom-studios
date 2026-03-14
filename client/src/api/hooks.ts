import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";

export function useHealth() {
  return useQuery({ queryKey: ["health"], queryFn: api.health, refetchInterval: 10000 });
}

export function useProjects(status?: string) {
  return useQuery({ queryKey: ["projects", status], queryFn: () => api.listProjects(status) });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: () => api.getProject(id),
    refetchInterval: 4000,
  });
}

export function useQueueStatus() {
  return useQuery({ queryKey: ["queue"], queryFn: api.queueStatus, refetchInterval: 3000 });
}

export function useCostSummary() {
  return useQuery({ queryKey: ["costs"], queryFn: api.getCostSummary, refetchInterval: 30000 });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useGenerateStoryboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.generateStoryboard(id),
    onSuccess: (_data, id) => qc.invalidateQueries({ queryKey: ["project", id] }),
  });
}

export function useRenderShot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, opts }: { id: string; opts?: Record<string, unknown> }) =>
      api.renderShot(id, opts),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project"] });
      qc.invalidateQueries({ queryKey: ["queue"] });
    },
  });
}

export function useRenderAll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (arg: string | { id: string; engine?: "local" | "premium" }) => {
      const id = typeof arg === "string" ? arg : arg.id;
      const engine = typeof arg === "string" ? undefined : arg.engine;
      return api.renderAll(id, engine);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project"] });
      qc.invalidateQueries({ queryKey: ["queue"] });
    },
  });
}

export function useAssemble() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (arg: string | { id: string; backgroundMusicFile?: string }) => {
      const id = typeof arg === "string" ? arg : arg.id;
      const opts = typeof arg === "string" ? undefined : { backgroundMusicFile: arg.backgroundMusicFile };
      return api.assemble(id, opts);
    },
    onSuccess: (_data, arg) => {
      const id = typeof arg === "string" ? arg : arg.id;
      qc.invalidateQueries({ queryKey: ["project", id] });
    },
  });
}

export function useAudioLibrary() {
  return useQuery({ queryKey: ["audioLibrary"], queryFn: api.listAudioLibrary });
}

export function useReorderShots() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, shotIds }: { projectId: string; shotIds: string[] }) =>
      api.reorderShots(projectId, shotIds),
    onSuccess: (_data, { projectId }) => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["presenterProject", projectId] });
    },
  });
}

export function useUpdateShot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shotId, data }: { shotId: string; data: { trimStart?: number; trimEnd?: number; lowerThirdEnabled?: boolean } }) =>
      api.updateShot(shotId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project"] });
      qc.invalidateQueries({ queryKey: ["presenterProject"] });
    },
  });
}

export function useRestoreRender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shotId, renderJobId }: { shotId: string; renderJobId: string }) =>
      api.restoreRender(shotId, renderJobId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project"] });
      qc.invalidateQueries({ queryKey: ["presenterProject"] });
    },
  });
}

// ─── Presenter hooks ──────────────────────────────────────────────────────

export function usePresenterTemplates() {
  return useQuery({ queryKey: ["presenterTemplates"], queryFn: api.listPresenterTemplates, staleTime: Infinity });
}

export function useElevenLabsVoices() {
  return useQuery({
    queryKey: ["voices"],
    queryFn: api.listVoices,
    staleTime: 5 * 60 * 1000, // cache for 5 min — voice list rarely changes
  });
}

export function usePresenters() {
  return useQuery({ queryKey: ["presenters"], queryFn: api.listPresenters });
}

export function useCreatePresenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createPresenter,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["presenters"] }),
  });
}

export function usePresenterProject(id: string) {
  return useQuery({
    queryKey: ["presenterProject", id],
    queryFn: () => api.getPresenterProject(id),
    refetchInterval: 4000,
  });
}

export function useUpdatePresenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.updatePresenter>[1] }) =>
      api.updatePresenter(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["presenters"] }),
  });
}

export function useUpdatePresenterOverlays() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { showLowerThirds?: boolean; showScriptureOverlays?: boolean } }) =>
      api.updatePresenterOverlays(id, data),
    onSuccess: (_data, { id }) => qc.invalidateQueries({ queryKey: ["presenterProject", id] }),
  });
}

export function useUploadPresenterImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      api.uploadPresenterImage(id, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["presenters"] }),
  });
}

export function useCreatePresenterProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createPresenterProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["presenters"] }),
  });
}

export function useDirectPresenterProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: { rawScript?: string } }) =>
      api.directPresenterProject(id, data),
    onSuccess: (_data, { id }) => qc.invalidateQueries({ queryKey: ["presenterProject", id] }),
  });
}

export function useProducePresenterProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, provider }: { id: string; provider?: string }) =>
      api.producePresenterProject(id, provider),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["presenterProject", id] });
      qc.invalidateQueries({ queryKey: ["queue"] });
    },
  });
}

// ─── RunPod hooks ─────────────────────────────────────────────────────────────

export function useRunPodStatus() {
  return useQuery({
    queryKey: ["runpod"],
    queryFn: api.runpodStatus,
    refetchInterval: 10000,
  });
}

export function useRunPodStart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.runpodStart,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["runpod"] }),
  });
}

export function useRunPodStop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (podId?: string) => api.runpodStop(podId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["runpod"] }),
  });
}

// ─── Engine hooks ─────────────────────────────────────────────────────────────

export function useEngines() {
  return useQuery({ queryKey: ["engines"], queryFn: api.listEngines, refetchInterval: 15000 });
}

export function useSetEngineDefault() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.setEngineDefault,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["engines"] }),
  });
}

export function useCompareEngines() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.compareEngines,
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ["comparison", data.comparisonId] }),
  });
}

export function useComparison(id: string | null) {
  return useQuery({
    queryKey: ["comparison", id],
    queryFn: () => api.getComparison(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 3000;
      const allDone = data.shots.every((s) => s.status === "rendered" || s.status === "failed");
      return allDone ? false : 3000;
    },
  });
}
