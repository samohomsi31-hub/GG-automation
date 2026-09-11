import { Router } from "express";
import { z } from "zod";
import { JobStatus, BlockerReason, QcStatus, AfterSalesStatus, ContactMethod, Prisma } from "@prisma/client";
import { prisma } from "../db";
import { requireAuth, requireQcSigner, requireRole } from "../auth";
import {
  CAN_CREATE_JOB,
  CAN_EDIT_INTAKE,
  CAN_FLAG_BLOCKER,
  CAN_LOG_CONTACT,
  CAN_ROUTE_FLOOR,
  CAN_UPDATE_AFTER_SALES,
  CAN_UPDATE_FLOOR_TASK,
} from "../lib/permissions";
import { nextJobNumber } from "../lib/jobNumber";
import { jobInclude } from "../lib/jobInclude";

const router = Router();
router.use(requireAuth);

const FLOORS = [1, 2, 3, 4];

function currentFloorLog<L extends { exitedAt: Date | null }>(job: { floorTaskLogs: L[] }): L | null {
  return job.floorTaskLogs.find((l) => l.exitedAt === null) ?? null;
}

// ---- Create (intake) ----
const intakeSchema = z.object({
  vin: z.string().trim().optional().nullable(),
  plate: z.string().trim().min(1),
  customerName: z.string().trim().min(1),
  customerPhone: z.string().trim().optional().nullable(),
  intakeComplaint: z.string().trim().min(1),
  intakeCategory: z.string().trim().min(1),
  jobType: z.enum(["WARRANTY", "PAID", "INSURANCE"]),
  initialFloor: z.number().int().refine((f) => FLOORS.includes(f), "invalid floor"),
});

router.post("/", requireRole(...CAN_CREATE_JOB), async (req, res) => {
  const parsed = intakeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;

  // jobNumber is unique; retry once on the rare same-second collision.
  for (let attempt = 0; attempt < 3; attempt++) {
    const jobNumber = await nextJobNumber();
    try {
      const job = await prisma.$transaction(async (tx) => {
        const created = await tx.job.create({
          data: {
            jobNumber,
            vin: data.vin || null,
            plate: data.plate,
            customerName: data.customerName,
            customerPhone: data.customerPhone || null,
            intakeComplaint: data.intakeComplaint,
            intakeCategory: data.intakeCategory,
            jobType: data.jobType,
            currentFloor: data.initialFloor,
            status: JobStatus.QUEUED,
            createdById: req.user!.id,
          },
        });
        await tx.floorTaskLog.create({
          data: {
            jobId: created.id,
            floor: data.initialFloor,
            status: JobStatus.QUEUED,
            openedById: req.user!.id,
          },
        });
        await tx.jobEvent.create({
          data: {
            jobId: created.id,
            eventType: "CREATED",
            toValue: `floor ${data.initialFloor}`,
            actorId: req.user!.id,
          },
        });
        return created;
      });
      const full = await prisma.job.findUnique({ where: { id: job.id }, include: jobInclude });
      return res.status(201).json(full);
    } catch (err: any) {
      if (err?.code === "P2002") continue; // jobNumber collision, retry
      throw err;
    }
  }
  res.status(500).json({ error: "Could not allocate job number, try again" });
});

// ---- List / search ----
router.get("/", async (req, res) => {
  const { q, status, floor, mine } = req.query as Record<string, string | undefined>;
  const where: Prisma.JobWhereInput = {};

  if (status) where.status = status as JobStatus;
  if (floor) where.currentFloor = parseInt(floor, 10);
  if (mine === "true" && req.user!.assignedFloor) where.currentFloor = req.user!.assignedFloor;
  if (q) {
    where.OR = [
      { plate: { contains: q, mode: "insensitive" } },
      { vin: { contains: q, mode: "insensitive" } },
      { jobNumber: { contains: q, mode: "insensitive" } },
      { customerName: { contains: q, mode: "insensitive" } },
    ];
  }

  const jobs = await prisma.job.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: jobInclude,
  });
  res.json(jobs);
});

router.get("/:id", async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: req.params.id }, include: jobInclude });
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

// ---- Edit intake ----
const intakeEditSchema = intakeSchema.omit({ initialFloor: true }).partial();

router.patch("/:id/intake", requireRole(...CAN_EDIT_INTAKE), async (req, res) => {
  const parsed = intakeEditSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const job = await prisma.job.update({
    where: { id: req.params.id },
    data: { ...parsed.data, vin: parsed.data.vin ?? undefined },
    include: jobInclude,
  });
  await prisma.jobEvent.create({
    data: { jobId: job.id, eventType: "INTAKE_EDITED", actorId: req.user!.id },
  });
  res.json(job);
});

// ---- Start work on current floor ----
router.post("/:id/start", requireRole(...CAN_UPDATE_FLOOR_TASK), async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: req.params.id }, include: { floorTaskLogs: true } });
  if (!job) return res.status(404).json({ error: "Job not found" });
  const openLog = currentFloorLog(job);
  if (!openLog) return res.status(409).json({ error: "No open floor visit on this job" });

  await prisma.$transaction([
    prisma.floorTaskLog.update({ where: { id: openLog.id }, data: { status: JobStatus.IN_PROGRESS } }),
    prisma.job.update({ where: { id: job.id }, data: { status: JobStatus.IN_PROGRESS } }),
    prisma.jobEvent.create({
      data: { jobId: job.id, eventType: "STATUS_CHANGED", fromValue: job.status, toValue: "IN_PROGRESS", actorId: req.user!.id },
    }),
  ]);
  const full = await prisma.job.findUnique({ where: { id: job.id }, include: jobInclude });
  res.json(full);
});

// ---- Route to next floor, or finish (nextFloor null) ----
const routeSchema = z.object({
  nextFloor: z.number().int().refine((f) => FLOORS.includes(f), "invalid floor").nullable(),
});

router.post("/:id/route", requireRole(...CAN_ROUTE_FLOOR), async (req, res) => {
  const parsed = routeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { nextFloor } = parsed.data;

  const job = await prisma.job.findUnique({ where: { id: req.params.id }, include: { floorTaskLogs: true } });
  if (!job) return res.status(404).json({ error: "Job not found" });
  const openLog = currentFloorLog(job);
  if (!openLog) return res.status(409).json({ error: "No open floor visit on this job" });
  if (job.status === JobStatus.BLOCKED) {
    return res.status(409).json({ error: "Clear the blocker before routing this job" });
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.floorTaskLog.update({
      where: { id: openLog.id },
      data: { exitedAt: now, completionTimestamp: now, status: JobStatus.DONE },
    });
    await tx.jobEvent.create({
      data: { jobId: job.id, eventType: "FLOOR_EXITED", fromValue: String(openLog.floor), actorId: req.user!.id },
    });

    if (nextFloor) {
      await tx.floorTaskLog.create({
        data: { jobId: job.id, floor: nextFloor, status: JobStatus.QUEUED, openedById: req.user!.id },
      });
      await tx.job.update({
        where: { id: job.id },
        data: { currentFloor: nextFloor, status: JobStatus.QUEUED },
      });
      await tx.jobEvent.create({
        data: { jobId: job.id, eventType: "FLOOR_ENTERED", toValue: String(nextFloor), actorId: req.user!.id },
      });
    } else {
      await tx.job.update({
        where: { id: job.id },
        data: { currentFloor: null, status: JobStatus.DONE },
      });
      await tx.jobEvent.create({
        data: { jobId: job.id, eventType: "STATUS_CHANGED", toValue: "DONE", actorId: req.user!.id },
      });
    }
  });

  const full = await prisma.job.findUnique({ where: { id: job.id }, include: jobInclude });
  res.json(full);
});

// ---- Blocker flag / clear ----
const blockerSchema = z.object({
  reasonCode: z.nativeEnum(BlockerReason),
  note: z.string().trim().optional().nullable(),
});

router.post("/:id/blocker", requireRole(...CAN_FLAG_BLOCKER), async (req, res) => {
  const parsed = blockerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { reasonCode, note } = parsed.data;

  const job = await prisma.job.findUnique({ where: { id: req.params.id }, include: { floorTaskLogs: true } });
  if (!job) return res.status(404).json({ error: "Job not found" });
  const openLog = currentFloorLog(job);
  if (!openLog) return res.status(409).json({ error: "No open floor visit on this job" });

  await prisma.$transaction([
    prisma.job.update({
      where: { id: job.id },
      data: { status: JobStatus.BLOCKED, blockerReasonCode: reasonCode, blockerNote: note || null },
    }),
    prisma.floorTaskLog.update({ where: { id: openLog.id }, data: { status: JobStatus.BLOCKED } }),
    prisma.jobEvent.create({
      data: { jobId: job.id, eventType: "BLOCKER_FLAGGED", toValue: reasonCode, note: note || undefined, actorId: req.user!.id },
    }),
  ]);
  const full = await prisma.job.findUnique({ where: { id: job.id }, include: jobInclude });
  res.json(full);
});

router.post("/:id/blocker/clear", requireRole(...CAN_FLAG_BLOCKER), async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: req.params.id }, include: { floorTaskLogs: true } });
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (job.status !== JobStatus.BLOCKED) return res.status(409).json({ error: "Job is not blocked" });
  const openLog = currentFloorLog(job);

  await prisma.$transaction([
    prisma.job.update({
      where: { id: job.id },
      data: { status: JobStatus.IN_PROGRESS, blockerReasonCode: null, blockerNote: null },
    }),
    ...(openLog
      ? [prisma.floorTaskLog.update({ where: { id: openLog.id }, data: { status: JobStatus.IN_PROGRESS } })]
      : []),
    prisma.jobEvent.create({
      data: { jobId: job.id, eventType: "BLOCKER_CLEARED", actorId: req.user!.id },
    }),
  ]);
  const full = await prisma.job.findUnique({ where: { id: job.id }, include: jobInclude });
  res.json(full);
});

// ---- QC ----
const qcSchema = z.object({ status: z.nativeEnum(QcStatus) });

router.post("/:id/qc", requireQcSigner, async (req, res) => {
  const parsed = qcSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const job = await prisma.job.update({
    where: { id: req.params.id },
    data: { qcStatus: parsed.data.status, qcById: req.user!.id, qcAt: new Date() },
    include: jobInclude,
  });
  await prisma.jobEvent.create({
    data: { jobId: job.id, eventType: "QC_UPDATED", toValue: parsed.data.status, actorId: req.user!.id },
  });
  res.json(job);
});

// ---- After-sales handoff status ----
const afterSalesSchema = z.object({ status: z.nativeEnum(AfterSalesStatus) });

router.post("/:id/after-sales", requireRole(...CAN_UPDATE_AFTER_SALES), async (req, res) => {
  const parsed = afterSalesSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const job = await prisma.job.update({
    where: { id: req.params.id },
    data: { afterSalesStatus: parsed.data.status },
    include: jobInclude,
  });
  await prisma.jobEvent.create({
    data: { jobId: job.id, eventType: "AFTER_SALES_UPDATED", toValue: parsed.data.status, actorId: req.user!.id },
  });
  res.json(job);
});

// ---- Customer contact log (After-Sales) ----
const contactLogSchema = z.object({
  method: z.nativeEnum(ContactMethod),
  note: z.string().trim().min(1),
});

router.post("/:id/contact-log", requireRole(...CAN_LOG_CONTACT), async (req, res) => {
  const parsed = contactLogSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const job = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ error: "Job not found" });

  await prisma.customerContactLog.create({
    data: { jobId: job.id, method: parsed.data.method, note: parsed.data.note, contactedById: req.user!.id },
  });
  await prisma.jobEvent.create({
    data: { jobId: job.id, eventType: "CONTACT_LOGGED", toValue: parsed.data.method, actorId: req.user!.id },
  });
  const full = await prisma.job.findUnique({ where: { id: job.id }, include: jobInclude });
  res.json(full);
});

// ---- Close job (final sign-off) ----
router.post("/:id/close", requireQcSigner, async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (job.status !== JobStatus.DONE) {
    return res.status(409).json({ error: "Job must be DONE (all floors complete) before closing" });
  }

  const updated = await prisma.job.update({
    where: { id: job.id },
    data: { status: JobStatus.CLOSED, closedAt: new Date() },
    include: jobInclude,
  });
  await prisma.jobEvent.create({
    data: { jobId: job.id, eventType: "CLOSED", actorId: req.user!.id },
  });
  res.json(updated);
});

// ---- Technician assignment + hours on the currently open floor visit ----
const techSchema = z.object({
  userId: z.string().uuid(),
  hoursLogged: z.number().nonnegative().nullable().optional(),
});

router.post("/:id/floor-log/technicians", requireRole(...CAN_UPDATE_FLOOR_TASK), async (req, res) => {
  const parsed = techSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const job = await prisma.job.findUnique({ where: { id: req.params.id }, include: { floorTaskLogs: true } });
  if (!job) return res.status(404).json({ error: "Job not found" });
  const openLog = currentFloorLog(job);
  if (!openLog) return res.status(409).json({ error: "No open floor visit on this job" });

  await prisma.floorTaskLogTechnician.upsert({
    where: { floorTaskLogId_userId: { floorTaskLogId: openLog.id, userId: parsed.data.userId } },
    create: {
      floorTaskLogId: openLog.id,
      userId: parsed.data.userId,
      hoursLogged: parsed.data.hoursLogged ?? null,
    },
    update: { hoursLogged: parsed.data.hoursLogged ?? null },
  });

  const full = await prisma.job.findUnique({ where: { id: job.id }, include: jobInclude });
  res.json(full);
});

// ---- Notes on the currently open floor visit ----
const notesSchema = z.object({ notes: z.string().trim() });

router.patch("/:id/floor-log/notes", requireRole(...CAN_UPDATE_FLOOR_TASK), async (req, res) => {
  const parsed = notesSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const job = await prisma.job.findUnique({ where: { id: req.params.id }, include: { floorTaskLogs: true } });
  if (!job) return res.status(404).json({ error: "Job not found" });
  const openLog = currentFloorLog(job);
  if (!openLog) return res.status(409).json({ error: "No open floor visit on this job" });

  await prisma.floorTaskLog.update({ where: { id: openLog.id }, data: { notes: parsed.data.notes } });
  const full = await prisma.job.findUnique({ where: { id: job.id }, include: jobInclude });
  res.json(full);
});

export default router;
