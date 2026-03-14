import type { FastifyInstance } from "fastify";
import { getRunPodStatus, startRunPod, stopRunPod } from "../services/runpod.service.js";
import { config } from "../config.js";

export async function runpodRoutes(app: FastifyInstance) {
  // GET /runpod/status — live pod state
  app.get("/status", async (_req, reply) => {
    if (!config.RUNPOD_API_KEY) {
      return {
        state: "not_configured",
        podId: null,
        proxyUrl: null,
        costPerHr: null,
        uptimeSeconds: null,
        hasNetworkVolume: false,
        gpuTypeId: config.RUNPOD_GPU_TYPE_ID,
        templateId: config.RUNPOD_TEMPLATE_ID,
      };
    }

    try {
      const status = await getRunPodStatus();
      return {
        ...status,
        hasNetworkVolume: !!config.RUNPOD_NETWORK_VOLUME_ID,
        gpuTypeId: config.RUNPOD_GPU_TYPE_ID,
        templateId: config.RUNPOD_TEMPLATE_ID,
      };
    } catch (err) {
      return reply.status(502).send({
        error: err instanceof Error ? err.message : "RunPod API error",
      });
    }
  });

  // POST /runpod/start — deploy a new pod
  app.post("/start", async (_req, reply) => {
    if (!config.RUNPOD_API_KEY) {
      return reply.status(400).send({ error: "RUNPOD_API_KEY not configured" });
    }

    try {
      const status = await startRunPod();
      return status;
    } catch (err) {
      return reply.status(502).send({
        error: err instanceof Error ? err.message : "Failed to start RunPod pod",
      });
    }
  });

  // POST /runpod/stop — terminate the running pod
  app.post("/stop", async (request, reply) => {
    if (!config.RUNPOD_API_KEY) {
      return reply.status(400).send({ error: "RUNPOD_API_KEY not configured" });
    }

    // Accept podId from body, or discover it automatically
    const body = (request.body ?? {}) as { podId?: string };
    let podId = body.podId;

    if (!podId) {
      const status = await getRunPodStatus();
      if (status.state !== "running" || !status.podId) {
        return reply.status(400).send({ error: "No running RunPod pod found" });
      }
      podId = status.podId;
    }

    try {
      await stopRunPod(podId);
      return { ok: true, podId, state: "stopped" };
    } catch (err) {
      return reply.status(502).send({
        error: err instanceof Error ? err.message : "Failed to stop RunPod pod",
      });
    }
  });
}
