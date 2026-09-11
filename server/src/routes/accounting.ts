import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../auth";
import { CAN_CLOSE_BILLING, CAN_UPDATE_SHOP_SETTINGS, CAN_VIEW_COST_DATA } from "../lib/permissions";

const router = Router();
router.use(requireAuth, requireRole(...CAN_VIEW_COST_DATA));

const SETTINGS_ID = "default";

async function getLaborRate(): Promise<number> {
  const settings = await prisma.shopSettings.findUnique({ where: { id: SETTINGS_ID } });
  return settings ? Number(settings.laborRatePerHourUsd) : 0;
}

export async function getShopLaborRate(): Promise<number> {
  return getLaborRate();
}

export function jobWithCostInclude(laborRate: number) {
  return {
    createdBy: { select: { id: true, displayName: true } },
    floorTaskLogs: {
      select: {
        id: true,
        floor: true,
        enteredAt: true,
        exitedAt: true,
        technicians: {
          select: { hoursLogged: true, user: { select: { id: true, displayName: true } } },
        },
      },
    },
    partsRequisitions: {
      select: { id: true, partDescription: true, quantity: true, unitCostUsd: true, status: true },
    },
  } satisfies Prisma.JobInclude;
}

export function computeCost(job: {
  floorTaskLogs: { technicians: { hoursLogged: Prisma.Decimal | null }[] }[];
  partsRequisitions: { quantity: number; unitCostUsd: Prisma.Decimal | null }[];
}, laborRate: number) {
  const laborHours = job.floorTaskLogs.reduce(
    (sum, log) => sum + log.technicians.reduce((s, t) => s + (t.hoursLogged ? Number(t.hoursLogged) : 0), 0),
    0,
  );
  const partsCost = job.partsRequisitions.reduce(
    (sum, p) => sum + (p.unitCostUsd ? Number(p.unitCostUsd) * p.quantity : 0),
    0,
  );
  const partsCostKnown = job.partsRequisitions.every((p) => p.unitCostUsd !== null);
  const laborCost = laborHours * laborRate;
  return {
    laborHours: Math.round(laborHours * 100) / 100,
    laborCost: Math.round(laborCost * 100) / 100,
    partsCost: Math.round(partsCost * 100) / 100,
    partsCostKnown,
    totalCost: Math.round((laborCost + partsCost) * 100) / 100,
  };
}

// ---- Shop settings (labor rate) ----
router.get("/settings", async (_req, res) => {
  const settings = await prisma.shopSettings.findUnique({ where: { id: SETTINGS_ID } });
  res.json({ laborRatePerHourUsd: settings ? Number(settings.laborRatePerHourUsd) : 0 });
});

const settingsSchema = z.object({ laborRatePerHourUsd: z.number().nonnegative() });

router.patch("/settings", requireRole(...CAN_UPDATE_SHOP_SETTINGS), async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const updated = await prisma.shopSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, laborRatePerHourUsd: parsed.data.laborRatePerHourUsd, updatedById: req.user!.id },
    update: { laborRatePerHourUsd: parsed.data.laborRatePerHourUsd, updatedById: req.user!.id },
  });
  res.json({ laborRatePerHourUsd: Number(updated.laborRatePerHourUsd) });
});

// ---- Cost roll-up list ----
router.get("/jobs", async (req, res) => {
  const { jobType, billingStatus } = req.query as Record<string, string | undefined>;
  const laborRate = await getLaborRate();

  const where: Prisma.JobWhereInput = {};
  if (jobType) where.jobType = jobType as Prisma.JobWhereInput["jobType"];
  if (billingStatus === "closed") where.billingClosedAt = { not: null };
  if (billingStatus === "open") where.billingClosedAt = null;

  const jobs = await prisma.job.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      jobNumber: true,
      plate: true,
      customerName: true,
      jobType: true,
      status: true,
      qcStatus: true,
      billingClosedAt: true,
      createdAt: true,
      ...jobWithCostInclude(laborRate),
    },
  });

  const withCost = jobs.map((job) => ({ ...job, cost: computeCost(job, laborRate) }));
  res.json({ laborRatePerHourUsd: laborRate, jobs: withCost });
});

router.get("/jobs/:id", async (req, res) => {
  const laborRate = await getLaborRate();
  const job = await prisma.job.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      jobNumber: true,
      plate: true,
      customerName: true,
      jobType: true,
      status: true,
      qcStatus: true,
      billingClosedAt: true,
      createdAt: true,
      ...jobWithCostInclude(laborRate),
    },
  });
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json({ laborRatePerHourUsd: laborRate, job: { ...job, cost: computeCost(job, laborRate) } });
});

router.post("/jobs/:id/close-billing", requireRole(...CAN_CLOSE_BILLING), async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (job.status !== "DONE" && job.status !== "CLOSED") {
    return res.status(409).json({ error: "Job isn't finished yet (must be DONE or CLOSED)" });
  }
  if (job.billingClosedAt) return res.status(409).json({ error: "Billing already closed for this job" });

  const updated = await prisma.job.update({
    where: { id: job.id },
    data: { billingClosedAt: new Date(), billingClosedById: req.user!.id },
  });
  await prisma.jobEvent.create({
    data: { jobId: job.id, eventType: "BILLING_CLOSED", actorId: req.user!.id },
  });
  res.json(updated);
});

export default router;
