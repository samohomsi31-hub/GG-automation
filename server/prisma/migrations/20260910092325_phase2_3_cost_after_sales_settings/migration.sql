-- CreateEnum
CREATE TYPE "ContactMethod" AS ENUM ('CALL', 'SMS', 'EMAIL', 'IN_PERSON', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JobEventType" ADD VALUE 'PARTS_COST_UPDATED';
ALTER TYPE "JobEventType" ADD VALUE 'CONTACT_LOGGED';
ALTER TYPE "JobEventType" ADD VALUE 'BILLING_CLOSED';

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "billingClosedAt" TIMESTAMP(3),
ADD COLUMN     "billingClosedById" TEXT;

-- AlterTable
ALTER TABLE "parts_requisitions" ADD COLUMN     "unitCostUsd" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "customer_contact_logs" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "method" "ContactMethod" NOT NULL,
    "note" TEXT NOT NULL,
    "contactedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_contact_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_settings" (
    "id" TEXT NOT NULL,
    "laborRatePerHourUsd" DECIMAL(8,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "shop_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_contact_logs_jobId_createdAt_idx" ON "customer_contact_logs"("jobId", "createdAt");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_billingClosedById_fkey" FOREIGN KEY ("billingClosedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_contact_logs" ADD CONSTRAINT "customer_contact_logs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_contact_logs" ADD CONSTRAINT "customer_contact_logs_contactedById_fkey" FOREIGN KEY ("contactedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_settings" ADD CONSTRAINT "shop_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
