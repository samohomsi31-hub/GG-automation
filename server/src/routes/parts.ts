import { Router } from "express";
import { z } from "zod";
import { PartsRequisitionStatus } from "@prisma/client";
import { prisma } from "../db";
import { requireAuth, requireRole } from "../auth";
import { CAN_CREATE_PARTS_REQUISITION, CAN_UPDATE_PARTS_REQUISITION } from "../lib/permissions";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
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

const updateSchema = z.object({ status: z.nativeEnum(PartsRequisitionStatus) });

router.patch("/:id", requireRole(...CAN_UPDATE_PARTS_REQUISITION), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const updated = await prisma.partsRequisition.update({
    where: { id: req.params.id },
    data: { status: parsed.data.status },
  });
  await prisma.jobEvent.create({
    data: {
      jobId: updated.jobId,
      eventType: "PARTS_STATUS_CHANGED",
      toValue: parsed.data.status,
      actorId: req.user!.id,
    },
  });
  res.json(updated);
});

export default router;
