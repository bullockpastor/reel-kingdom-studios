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
    mutationFn: (id: string) => api.renderAll(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project"] });
      qc.invalidateQueries({ queryKey: ["queue"] });
    },
  });
}

export function useAssemble() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.assemble(id),
    onSuccess: (_data, id) => qc.invalidateQueries({ queryKey: ["project", id] }),
  });
}

// ─── Presenter hooks ──────────────────────────────────────────────────────

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
