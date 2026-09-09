import { Role } from "@prisma/client";

// Section 5 permission matrix, translated into route-level gates.
// "Read-mostly"/"Read-only" roles still hit the same GET routes as
// everyone else — the gate is only ever on the write routes below.

export const CAN_CREATE_JOB: Role[] = [Role.SERVICE_ADVISOR, Role.IT_ADMIN];
export const CAN_EDIT_INTAKE: Role[] = [Role.SERVICE_ADVISOR, Role.IT_ADMIN];

// Floor Lead updates their own floor's task; Service Advisor can also
// step in (matches the "Floor Lead decides, Advisor can override" call).
export const CAN_UPDATE_FLOOR_TASK: Role[] = [
  Role.FLOOR_TECH,
  Role.SERVICE_ADVISOR,
  Role.IT_ADMIN,
];

export const CAN_ROUTE_FLOOR: Role[] = [
  Role.FLOOR_TECH,
  Role.SERVICE_ADVISOR,
  Role.IT_ADMIN,
];

export const CAN_FLAG_BLOCKER: Role[] = [
  Role.FLOOR_TECH,
  Role.SERVICE_ADVISOR,
  Role.IT_ADMIN,
];

export const CAN_UPDATE_QC: Role[] = [Role.SERVICE_ADVISOR, Role.IT_ADMIN];

export const CAN_UPDATE_AFTER_SALES: Role[] = [
  Role.AFTER_SALES,
  Role.SERVICE_ADVISOR,
  Role.IT_ADMIN,
];

export const CAN_UPDATE_PARTS_REQUISITION: Role[] = [
  Role.PARTS_OFFICE,
  Role.IT_ADMIN,
];

export const CAN_CREATE_PARTS_REQUISITION: Role[] = [
  Role.FLOOR_TECH,
  Role.SERVICE_ADVISOR,
  Role.IT_ADMIN,
];

// Everyone authenticated can read job status/search — that's the
// "basic status view any role can check" requirement. No role list
// needed for those routes.
