import { Prisma } from "@prisma/client";

// Single source of truth for the Job shape sent to the frontend —
// used by every route that returns a Job so the client never has to
// guess which fields are present depending on which endpoint it hit.
export const jobInclude = {
  createdBy: { select: { id: true, displayName: true } },
  qcBy: { select: { id: true, displayName: true } },
  floorTaskLogs: {
    orderBy: { enteredAt: Prisma.SortOrder.asc },
    include: {
      openedBy: { select: { id: true, displayName: true } },
      technicians: { include: { user: { select: { id: true, displayName: true } } } },
    },
  },
  events: { orderBy: { createdAt: Prisma.SortOrder.desc }, include: { actor: { select: { id: true, displayName: true } } } },
  // Explicit select (no unitCostUsd) — this is the shape every non-cost
  // route returns, so cost data simply never reaches a role that
  // shouldn't see it (Section 5: only Accounting/Senior Management do).
  // The dedicated accounting routes query PartsRequisition separately
  // with unitCostUsd included.
  partsRequisitions: {
    orderBy: { createdAt: Prisma.SortOrder.desc },
    select: {
      id: true,
      jobId: true,
      floorTaskLogId: true,
      floorRequested: true,
      partDescription: true,
      quantity: true,
      status: true,
      requestedById: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  contactLogs: {
    orderBy: { createdAt: Prisma.SortOrder.desc },
    include: { contactedBy: { select: { id: true, displayName: true } } },
  },
} satisfies Prisma.JobInclude;
