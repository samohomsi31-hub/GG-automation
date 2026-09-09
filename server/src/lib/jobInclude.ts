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
  partsRequisitions: { orderBy: { createdAt: Prisma.SortOrder.desc } },
} satisfies Prisma.JobInclude;
