import { prisma } from "../db";

// Format: IMX-YYYYMMDD-NNNN, sequence resets daily.
export async function nextJobNumber(): Promise<string> {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `IMX-${datePart}-`;

  const last = await prisma.job.findFirst({
    where: { jobNumber: { startsWith: prefix } },
    orderBy: { jobNumber: "desc" },
    select: { jobNumber: true },
  });

  const lastSeq = last ? parseInt(last.jobNumber.slice(prefix.length), 10) : 0;
  const nextSeq = (Number.isNaN(lastSeq) ? 0 : lastSeq) + 1;
  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}
