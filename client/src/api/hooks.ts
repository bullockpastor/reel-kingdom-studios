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
