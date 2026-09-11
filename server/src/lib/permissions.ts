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

// QC sign-off and job-card close: see requireQcSigner in auth.ts — gated
// by User.canSignQc (a specific person, the head of garage) rather than
// a Role, since that doesn't map cleanly onto Section 5's 7 categories.

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

// Full requisition queue (across all jobs, including cost) — narrower
// than "can create one for my own job" above.
export const CAN_VIEW_PARTS_QUEUE: Role[] = [
  Role.PARTS_OFFICE,
  Role.ACCOUNTING,
  Role.SENIOR_MANAGEMENT,
  Role.IT_ADMIN,
];

export const CAN_SET_PARTS_COST: Role[] = [
  Role.PARTS_OFFICE,
  Role.ACCOUNTING,
  Role.IT_ADMIN,
];

export const CAN_LOG_CONTACT: Role[] = [
  Role.AFTER_SALES,
  Role.SERVICE_ADVISOR,
  Role.IT_ADMIN,
];

// Section 5: Accounting has "full cost data", Senior Management sees
// "all data, aggregate views" — everyone else gets no cost data at all
// (enforced by simply never including cost fields in the general
// jobInclude used by other routes, not just by gating these routes).
export const CAN_VIEW_COST_DATA: Role[] = [
  Role.ACCOUNTING,
  Role.SENIOR_MANAGEMENT,
  Role.IT_ADMIN,
];

export const CAN_CLOSE_BILLING: Role[] = [Role.ACCOUNTING, Role.IT_ADMIN];
export const CAN_UPDATE_SHOP_SETTINGS: Role[] = [Role.ACCOUNTING, Role.IT_ADMIN];

// Everyone authenticated can read job status/search — that's the
// "basic status view any role can check" requirement. No role list
// needed for those routes.
