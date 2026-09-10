export type Role =
  | "SERVICE_ADVISOR"
  | "FLOOR_TECH"
  | "PARTS_OFFICE"
  | "AFTER_SALES"
  | "ACCOUNTING"
  | "SENIOR_MANAGEMENT"
  | "IT_ADMIN";

export type JobStatus = "QUEUED" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CLOSED";
export type JobType = "WARRANTY" | "PAID" | "INSURANCE";
export type BlockerReason = "PART" | "CUSTOMER_APPROVAL" | "INSURANCE_WARRANTY_APPROVAL" | "OTHER_FLOOR" | "OTHER";
export type QcStatus = "PENDING" | "PASSED" | "FAILED";
export type AfterSalesStatus = "NOT_READY" | "READY" | "HANDED_OFF";
export type PartsRequisitionStatus = "REQUESTED" | "CONFIRMED_IN_STOCK" | "BACKORDERED" | "FULFILLED";
export type ContactMethod = "CALL" | "SMS" | "EMAIL" | "IN_PERSON" | "OTHER";

export interface SessionUser {
  id: string;
  displayName: string;
  email: string;
  role: Role;
  assignedFloor: number | null;
}

export interface FloorTaskLogTechnician {
  id: string;
  userId: string;
  hoursLogged: string | null;
  user: { id: string; displayName: string };
}

export interface FloorTaskLog {
  id: string;
  jobId: string;
  floor: number;
  status: JobStatus;
  enteredAt: string;
  exitedAt: string | null;
  completionTimestamp: string | null;
  notes: string | null;
  openedBy: { id: string; displayName: string };
  technicians: FloorTaskLogTechnician[];
}

export interface JobEvent {
  id: string;
  eventType: string;
  fromValue: string | null;
  toValue: string | null;
  note: string | null;
  createdAt: string;
  actor: { id: string; displayName: string };
}

export interface PartsRequisition {
  id: string;
  jobId: string;
  floorRequested: number;
  partDescription: string;
  quantity: number;
  status: PartsRequisitionStatus;
  createdAt: string;
  // Only present when returned by /api/accounting or /api/parts-requisitions
  // (the roles allowed to see cost) — absent on the general job endpoints.
  unitCostUsd?: string | null;
}

export interface CustomerContactLog {
  id: string;
  jobId: string;
  method: ContactMethod;
  note: string;
  createdAt: string;
  contactedBy: { id: string; displayName: string };
}

export interface JobCost {
  laborHours: number;
  laborCost: number;
  partsCost: number;
  partsCostKnown: boolean;
  totalCost: number;
}

export interface AccountingJob {
  id: string;
  jobNumber: string;
  plate: string;
  customerName: string;
  jobType: JobType;
  status: JobStatus;
  qcStatus: QcStatus;
  billingClosedAt: string | null;
  createdAt: string;
  cost: JobCost;
}

export interface AccountingJobDetail extends AccountingJob {
  createdBy: { id: string; displayName: string };
  floorTaskLogs: {
    id: string;
    floor: number;
    enteredAt: string;
    exitedAt: string | null;
    technicians: { hoursLogged: string | null; user: { id: string; displayName: string } }[];
  }[];
  partsRequisitions: { id: string; partDescription: string; quantity: number; unitCostUsd: string | null; status: PartsRequisitionStatus }[];
}

export interface PartsQueueItem {
  id: string;
  jobId: string;
  floorRequested: number;
  partDescription: string;
  quantity: number;
  status: PartsRequisitionStatus;
  unitCostUsd: string | null;
  createdAt: string;
  job: { id: string; jobNumber: string; plate: string; customerName: string };
  requestedBy: { id: string; displayName: string };
}

export interface ManagementDashboard {
  generatedAt: string;
  jobsByStatus: { status: JobStatus; count: number }[];
  jobsByFloor: { floor: number; count: number }[];
  jobsToday: number;
  jobsLast7d: number;
  liveBlockersByReason: { reason: BlockerReason | null; count: number }[];
  historicalBlockersByReason: { reason: string | null; count: number }[];
  avgHoursPerFloor: { floor: number; avgHours: number | null; completedVisits: number }[];
  laborRatePerHourUsd: number;
  costLast7dUsd: number;
  costLast30dUsd: number;
}

export interface Job {
  id: string;
  jobNumber: string;
  vin: string | null;
  plate: string;
  customerName: string;
  customerPhone: string | null;
  intakeComplaint: string;
  intakeCategory: string;
  jobType: JobType;
  currentFloor: number | null;
  status: JobStatus;
  blockerReasonCode: BlockerReason | null;
  blockerNote: string | null;
  qcStatus: QcStatus;
  qcAt: string | null;
  afterSalesStatus: AfterSalesStatus;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  createdBy: { id: string; displayName: string };
  qcBy: { id: string; displayName: string } | null;
  floorTaskLogs: FloorTaskLog[];
  events: JobEvent[];
  partsRequisitions: PartsRequisition[];
  contactLogs: CustomerContactLog[];
}
