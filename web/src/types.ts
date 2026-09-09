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
}
