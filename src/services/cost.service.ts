/**
 * Cost tracking and budget enforcement for premium video rendering.
 * Uses PremiumAudit records; actualCost preferred, estimatedCost as fallback.
 */
import { db } from "../db.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

/** Start of current month (UTC) for monthly cap */
function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Total spend this month (from completed premium audits).
 */
export async function getMonthlySpend(): Promise<number> {
  const since = startOfCurrentMonth();
  const rows = await db.premiumAudit.findMany({
    where: {
      createdAt: { gte: since },
      status: { in: ["completed", "processing"] },
    },
    select: { actualCost: true, estimatedCost: true },
  });
  return rows.reduce((sum, r) => {
    const c = r.actualCost ?? r.estimatedCost ?? 0;
    return sum + c;
  }, 0);
}

/**
 * Total spend for a project (from premium audits on its shots).
 */
export async function getProjectSpend(projectId: string): Promise<number> {
  const shots = await db.shot.findMany({
    where: { projectId },
    select: { id: true },
  });
  const shotIds = shots.map((s) => s.id);
  if (shotIds.length === 0) return 0;

  const rows = await db.premiumAudit.findMany({
    where: {
      shotId: { in: shotIds },
      status: { in: ["completed", "processing", "requested"] },
    },
    select: { actualCost: true, estimatedCost: true },
  });
  return rows.reduce((sum, r) => {
    const c = r.actualCost ?? r.estimatedCost ?? 0;
    return sum + c;
  }, 0);
}

/**
 * Check if queueing a premium render would exceed caps.
 * @throws Error if over cap
 */
export async function checkBudgetBeforePremium(projectId?: string): Promise<void> {
  const monthlyCap = config.PREMIUM_MONTHLY_CAP;
  const projectCap = config.PREMIUM_PROJECT_CAP;

  if (!monthlyCap && !projectCap) return;

  if (monthlyCap != null) {
    const monthly = await getMonthlySpend();
    if (monthly >= monthlyCap) {
      throw new Error(
        `Premium monthly cap reached ($${monthly.toFixed(2)} >= $${monthlyCap.toFixed(2)}). ` +
          "Increase PREMIUM_MONTHLY_CAP or wait until next month."
      );
    }
  }

  if (projectCap != null && projectId) {
    const project = await getProjectSpend(projectId);
    if (project >= projectCap) {
      throw new Error(
        `Project premium cap reached ($${project.toFixed(2)} >= $${projectCap.toFixed(2)}). ` +
          "Increase PREMIUM_PROJECT_CAP for this project."
      );
    }
  }
}

/**
 * Cost summary for dashboard/API.
 */
export async function getCostSummary(): Promise<{
  monthlySpend: number;
  monthlyCap: number | null;
  byProvider: Record<string, number>;
  byProject: Array<{ projectId: string; spend: number }>;
}> {
  const since = startOfCurrentMonth();
  const audits = await db.premiumAudit.findMany({
    where: { createdAt: { gte: since } },
    include: { shot: { select: { projectId: true } } },
  });

  let monthlySpend = 0;
  const byProvider: Record<string, number> = {};
  const byProjectMap = new Map<string, number>();

  for (const a of audits) {
    const cost = a.actualCost ?? a.estimatedCost ?? 0;
    monthlySpend += cost;
    byProvider[a.provider] = (byProvider[a.provider] ?? 0) + cost;
    const pid = a.shot.projectId;
    byProjectMap.set(pid, (byProjectMap.get(pid) ?? 0) + cost);
  }

  const byProject = Array.from(byProjectMap.entries()).map(([projectId, spend]) => ({
    projectId,
    spend,
  }));

  return {
    monthlySpend,
    monthlyCap: config.PREMIUM_MONTHLY_CAP ?? null,
    byProvider,
    byProject,
  };
}
