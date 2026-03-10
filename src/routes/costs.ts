import type { FastifyInstance } from "fastify";
import { getCostSummary } from "../services/cost.service.js";

export async function costRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    return getCostSummary();
  });
}
