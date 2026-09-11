-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SERVICE_ADVISOR', 'FLOOR_TECH', 'PARTS_OFFICE', 'AFTER_SALES', 'ACCOUNTING', 'SENIOR_MANAGEMENT', 'IT_ADMIN');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('WARRANTY', 'PAID', 'INSURANCE');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CLOSED');

-- CreateEnum
CREATE TYPE "BlockerReason" AS ENUM ('PART', 'CUSTOMER_APPROVAL', 'INSURANCE_WARRANTY_APPROVAL', 'OTHER_FLOOR', 'OTHER');

-- CreateEnum
CREATE TYPE "QcStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "AfterSalesStatus" AS ENUM ('NOT_READY', 'READY', 'HANDED_OFF');

-- CreateEnum
CREATE TYPE "PartsRequisitionStatus" AS ENUM ('REQUESTED', 'CONFIRMED_IN_STOCK', 'BACKORDERED', 'FULFILLED');

-- CreateEnum
CREATE TYPE "JobEventType" AS ENUM ('CREATED', 'INTAKE_EDITED', 'FLOOR_ENTERED', 'FLOOR_EXITED', 'STATUS_CHANGED', 'BLOCKER_FLAGGED', 'BLOCKER_CLEARED', 'QC_UPDATED', 'AFTER_SALES_UPDATED', 'CLOSED', 'PARTS_REQUESTED', 'PARTS_STATUS_CHANGED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "entraObjectId" TEXT,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "assignedFloor" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "jobNumber" TEXT NOT NULL,
    "vin" TEXT,
    "plate" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "intakeComplaint" TEXT NOT NULL,
    "intakeCategory" TEXT NOT NULL,
    "jobType" "JobType" NOT NULL,
    "currentFloor" INTEGER,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "blockerReasonCode" "BlockerReason",
    "blockerNote" TEXT,
    "qcStatus" "QcStatus" NOT NULL DEFAULT 'PENDING',
    "qcById" TEXT,
    "qcAt" TIMESTAMP(3),
    "afterSalesStatus" "AfterSalesStatus" NOT NULL DEFAULT 'NOT_READY',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floor_task_logs" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitedAt" TIMESTAMP(3),
    "completionTimestamp" TIMESTAMP(3),
    "notes" TEXT,
    "openedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "floor_task_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floor_task_log_technicians" (
    "id" TEXT NOT NULL,
    "floorTaskLogId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hoursLogged" DECIMAL(5,2),

    CONSTRAINT "floor_task_log_technicians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_events" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "eventType" "JobEventType" NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "note" TEXT,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parts_requisitions" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "floorTaskLogId" TEXT,
    "floorRequested" INTEGER NOT NULL,
    "partDescription" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "PartsRequisitionStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parts_requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_entraObjectId_key" ON "users"("entraObjectId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_jobNumber_key" ON "jobs"("jobNumber");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_currentFloor_idx" ON "jobs"("currentFloor");

-- CreateIndex
CREATE INDEX "jobs_plate_idx" ON "jobs"("plate");

-- CreateIndex
CREATE INDEX "jobs_vin_idx" ON "jobs"("vin");

-- CreateIndex
CREATE INDEX "floor_task_logs_jobId_idx" ON "floor_task_logs"("jobId");

-- CreateIndex
CREATE INDEX "floor_task_logs_floor_status_idx" ON "floor_task_logs"("floor", "status");

-- CreateIndex
CREATE UNIQUE INDEX "floor_task_log_technicians_floorTaskLogId_userId_key" ON "floor_task_log_technicians"("floorTaskLogId", "userId");

-- CreateIndex
CREATE INDEX "job_events_jobId_createdAt_idx" ON "job_events"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "parts_requisitions_status_idx" ON "parts_requisitions"("status");

-- CreateIndex
CREATE INDEX "parts_requisitions_jobId_idx" ON "parts_requisitions"("jobId");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_qcById_fkey" FOREIGN KEY ("qcById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floor_task_logs" ADD CONSTRAINT "floor_task_logs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floor_task_logs" ADD CONSTRAINT "floor_task_logs_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floor_task_log_technicians" ADD CONSTRAINT "floor_task_log_technicians_floorTaskLogId_fkey" FOREIGN KEY ("floorTaskLogId") REFERENCES "floor_task_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floor_task_log_technicians" ADD CONSTRAINT "floor_task_log_technicians_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_events" ADD CONSTRAINT "job_events_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_events" ADD CONSTRAINT "job_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts_requisitions" ADD CONSTRAINT "parts_requisitions_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts_requisitions" ADD CONSTRAINT "parts_requisitions_floorTaskLogId_fkey" FOREIGN KEY ("floorTaskLogId") REFERENCES "floor_task_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts_requisitions" ADD CONSTRAINT "parts_requisitions_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
