import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../auth";
import { Role } from "@prisma/client";
import { computeCost, getShopLaborRate, jobWithCostInclude } from "./accounting";

const router = Router();

// Senior Management's "full dashboard, all data, aggregate views" —
// Accounting/IT_Admin can see it too since they already have full cost
// access; nobody else does (aggregate cost totals are still cost data).
const CAN_VIEW_DASHBOARD = [Role.SENIOR_MANAGEMENT, Role.ACCOUNTING, Role.IT_ADMIN];
router.use(requireAuth, requireRole(...CAN_VIEW_DASHBOARD));

const FLOORS = [1, 2, 3, 4];

router.get("/dashboard", async (_req, res) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [statusCounts, floorCounts, jobsToday, jobsLast7d, laborRate] = await Promise.all([
    prisma.job.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.job.groupBy({ by: ["currentFloor"], where: { currentFloor: { not: null } }, _count: { _all: true } }),
    prisma.job.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.job.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    getShopLaborRate(),
  ]);

  // Blocker frequency: current live blockers by reason, plus how often
  // each reason has been flagged historically (from the event log) — the
  // second number is what surfaces a recurring problem paper never could.
  const [liveBlockers, historicalBlockerEvents] = await Promise.all([
    prisma.job.groupBy({ by: ["blockerReasonCode"], where: { status: "BLOCKED" }, _count: { _all: true } }),
    prisma.jobEvent.groupBy({ by: ["toValue"], where: { eventType: "BLOCKER_FLAGGED" }, _count: { _all: true } }),
  ]);

  // Average time spent per floor (completed visits only) — a simple
  // bottleneck indicator: which floor tends to hold cars longest.
  const completedLogs = await prisma.floorTaskLog.findMany({
    where: { exitedAt: { not: null } },
    select: { floor: true, enteredAt: true, exitedAt: true },
  });
  const floorDurations: Record<number, { totalHours: number; count: number }> = {};
  for (const f of FLOORS) floorDurations[f] = { totalHours: 0, count: 0 };
  for (const log of completedLogs) {
    const hours = (log.exitedAt!.getTime() - log.enteredAt.getTime()) / (1000 * 60 * 60);
    floorDurations[log.floor].totalHours += hours;
    floorDurations[log.floor].count += 1;
  }
  const avgHoursPerFloor = FLOORS.map((floor) => ({
    floor,
    avgHours: floorDurations[floor].count ? Math.round((floorDurations[floor].totalHours / floorDurations[floor].count) * 10) / 10 : null,
    completedVisits: floorDurations[floor].count,
  }));

  // Cost totals for jobs created in the last 7/30 days.
  const recentJobs = await prisma.job.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    select: { createdAt: true, ...jobWithCostInclude(laborRate) },
  });
  let cost7d = 0;
  let cost30d = 0;
  for (const job of recentJobs) {
    const { totalCost } = computeCost(job, laborRate);
    cost30d += totalCost;
    if (job.createdAt >= sevenDaysAgo) cost7d += totalCost;
  }

  res.json({
    generatedAt: now.toISOString(),
    jobsByStatus: statusCounts.map((s) => ({ status: s.status, count: s._count._all })),
    jobsByFloor: floorCounts.map((f) => ({ floor: f.currentFloor, count: f._count._all })),
    jobsToday,
    jobsLast7d,
    liveBlockersByReason: liveBlockers.map((b) => ({ reason: b.blockerReasonCode, count: b._count._all })),
    historicalBlockersByReason: historicalBlockerEvents.map((b) => ({ reason: b.toValue, count: b._count._all })),
    avgHoursPerFloor,
    laborRatePerHourUsd: laborRate,
    costLast7dUsd: Math.round(cost7d * 100) / 100,
    costLast30dUsd: Math.round(cost30d * 100) / 100,
  });
});

export default router;
