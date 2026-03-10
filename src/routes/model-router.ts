import type { FastifyInstance } from "fastify";
import {
  getAllRoutes,
  resolveAgentRoute,
  setAgentRouteOverride,
  deleteAgentRouteOverride,
} from "../services/model-router.service.js";

export async function modelRouterRoutes(app: FastifyInstance) {
  // GET /model-router/routes — full routing table
  app.get("/routes", async () => {
    return { routes: getAllRoutes() };
  });

  // POST /model-router/routes — set override for one agent
  app.post("/routes", async (request, reply) => {
    const body = (request.body || {}) as {
      agentName?: string;
      provider?: string;
      model?: string;
    };

    if (!body.agentName || typeof body.agentName !== "string") {
      return reply.status(400).send({ error: "agentName is required" });
    }
    if (!body.provider || !["ollama", "claude", "gemini"].includes(body.provider)) {
      return reply.status(400).send({ error: "provider must be ollama, claude, or gemini" });
    }

    setAgentRouteOverride(body.agentName, {
      provider: body.provider as "ollama" | "claude" | "gemini",
      model: body.model || undefined,
    });

    return { routes: getAllRoutes() };
  });

  // DELETE /model-router/routes/:agentName — remove override (revert to default)
  app.delete("/routes/:agentName", async (request, reply) => {
    const { agentName } = request.params as { agentName: string };
    deleteAgentRouteOverride(agentName);
    return { routes: getAllRoutes() };
  });

  // GET /model-router/resolve/:agentName — debug: what provider would be used?
  app.get("/resolve/:agentName", async (request, reply) => {
    const { agentName } = request.params as { agentName: string };
    if (!agentName) return reply.status(400).send({ error: "agentName required" });
    return resolveAgentRoute(agentName);
  });
}
