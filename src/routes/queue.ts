import type { FastifyInstance } from "fastify";
import { renderQueue } from "../queue/render.queue.js";
import { assemblyQueue } from "../queue/assembly.queue.js";
import { db } from "../db.js";

async function queueData() {
  const [renderCounts, assemblyCounts] = await Promise.all([
    renderQueue.getJobCounts("active", "waiting", "completed", "failed", "delayed"),
    assemblyQueue.getJobCounts("active", "waiting", "completed", "failed", "delayed"),
  ]);

  const recentRenderJobs = await db.renderJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      shot: {
        select: { shotIndex: true, projectId: true, prompt: true },
      },
    },
  });

  return {
    render: { counts: renderCounts, recent: recentRenderJobs },
    assembly: { counts: assemblyCounts },
  };
}

export async function queueRoutes(app: FastifyInstance) {
  // GET /queue
  app.get("/", async () => queueData());

  // GET /queue/status (kept as alias)
  app.get("/status", async () => {
    const [renderCounts, assemblyCounts] = await Promise.all([
      renderQueue.getJobCounts("active", "waiting", "completed", "failed", "delayed"),
      assemblyQueue.getJobCounts("active", "waiting", "completed", "failed", "delayed"),
    ]);

    const recentRenderJobs = await db.renderJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        shot: {
          select: { shotIndex: true, projectId: true, prompt: true },
        },
      },
    });

    return {
      render: { counts: renderCounts, recent: recentRenderJobs },
      assembly: { counts: assemblyCounts },
    };
  });
}
