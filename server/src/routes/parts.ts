import { Router } from "express";
import { z } from "zod";
import { PartsRequisitionStatus } from "@prisma/client";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../auth";
import {
  CAN_CREATE_PARTS_REQUISITION,
  CAN_SET_PARTS_COST,
  CAN_UPDATE_PARTS_REQUISITION,
  CAN_VIEW_PARTS_QUEUE,
} from "../lib/permissions";

const router = Router();
router.use(requireAuth);

// Full cross-job queue, including unit cost — narrower audience than the
// per-job "requested a part" flow below (see CAN_VIEW_PARTS_QUEUE).
router.get("/", requireRole(...CAN_VIEW_PARTS_QUEUE), async (req, res) => {
  const { status } = req.query as Record<string, string | undefined>;
  const reqs = await prisma.partsRequisition.findMany({
    where: status ? { status: status as PartsRequisitionStatus } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      job: { select: { id: true, jobNumber: true, plate: true, customerName: true } },
      requestedBy: { select: { id: true, displayName: true } },
    },
  });
  res.json(reqs);
});

const createSchema = z.object({
  jobId: z.string().uuid(),
  partDescription: z.string().trim().min(1),
  quantity: z.number().int().positive().default(1),
});

router.post("/", requireRole(...CAN_CREATE_PARTS_REQUISITION), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const job = await prisma.job.findUnique({ where: { id: parsed.data.jobId }, include: { floorTaskLogs: true } });
  if (!job) return res.status(404).json({ error: "Job not found" });
  const openLog = job.floorTaskLogs.find((l) => l.exitedAt === null) ?? null;

  const created = await prisma.partsRequisition.create({
    data: {
      jobId: job.id,
      floorTaskLogId: openLog?.id,
      floorRequested: job.currentFloor ?? 0,
      partDescription: parsed.data.partDescription,
      quantity: parsed.data.quantity,
      requestedById: req.user!.id,
    },
  });
  await prisma.jobEvent.create({
    data: {
      jobId: job.id,
      eventType: "PARTS_REQUESTED",
      toValue: parsed.data.partDescription,
      actorId: req.user!.id,
    },
  });
  res.status(201).json(created);
});

// status and unitCostUsd are gated separately (different roles can set
// each — see CAN_UPDATE_PARTS_REQUISITION vs CAN_SET_PARTS_COST), so this
// checks per-field rather than gating the whole route with one role list.
const updateSchema = z.object({
  status: z.nativeEnum(PartsRequisitionStatus).optional(),
  unitCostUsd: z.number().nonnegative().nullable().optional(),
});

router.patch("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { status, unitCostUsd } = parsed.data;
  if (status === undefined && unitCostUsd === undefined) {
    return res.status(400).json({ error: "Nothing to update" });
  }

  const role = req.user!.role;
  if (status !== undefined && !CAN_UPDATE_PARTS_REQUISITION.includes(role)) {
    return res.status(403).json({ error: "Not permitted to update requisition status" });
  }
  if (unitCostUsd !== undefined && !CAN_SET_PARTS_COST.includes(role)) {
    return res.status(403).json({ error: "Not permitted to set parts cost" });
  }

  const updated = await prisma.partsRequisition.update({
    where: { id: req.params.id },
    data: {
      ...(status !== undefined ? { status } : {}),
      ...(unitCostUsd !== undefined ? { unitCostUsd } : {}),
    },
  });

  const events = [];
  if (status !== undefined) {
    events.push({ jobId: updated.jobId, eventType: "PARTS_STATUS_CHANGED" as const, toValue: status, actorId: req.user!.id });
  }
  if (unitCostUsd !== undefined) {
    events.push({
      jobId: updated.jobId,
      eventType: "PARTS_COST_UPDATED" as const,
      toValue: unitCostUsd === null ? null : `$${unitCostUsd.toFixed(2)}`,
      actorId: req.user!.id,
    });
  }
  if (events.length) await prisma.jobEvent.createMany({ data: events });

  res.json(updated);
});

export default router;
