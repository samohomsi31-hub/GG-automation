import { PrismaClient, Role, JobStatus, JobType } from "@prisma/client";

const prisma = new PrismaClient();

const DEV_USERS: { displayName: string; email: string; role: Role; assignedFloor?: number }[] = [
  { displayName: "Nabil Haddad", email: "nabil.haddad@impex-garage.local", role: Role.SERVICE_ADVISOR },
  { displayName: "Fadi Achkar", email: "fadi.achkar@impex-garage.local", role: Role.FLOOR_TECH, assignedFloor: 1 },
  { displayName: "Elie Bou Rjeily", email: "elie.bourjeily@impex-garage.local", role: Role.FLOOR_TECH, assignedFloor: 2 },
  { displayName: "Rami Chidiac", email: "rami.chidiac@impex-garage.local", role: Role.FLOOR_TECH, assignedFloor: 3 },
  { displayName: "Georges Abou Khalil", email: "georges.aboukhalil@impex-garage.local", role: Role.FLOOR_TECH, assignedFloor: 4 },
  { displayName: "Maya Saade", email: "maya.saade@impex-garage.local", role: Role.PARTS_OFFICE },
  { displayName: "Karim Nassar", email: "karim.nassar@impex-garage.local", role: Role.AFTER_SALES },
  { displayName: "Layal Frem", email: "layal.frem@impex-garage.local", role: Role.ACCOUNTING },
  { displayName: "Antoine Khoury", email: "antoine.khoury@impex-garage.local", role: Role.SENIOR_MANAGEMENT },
  { displayName: "Sami Rahme", email: "sami.rahme@impex-garage.local", role: Role.IT_ADMIN },
];

async function main() {
  const users = new Map<string, { id: string }>();
  for (const u of DEV_USERS) {
    const created = await prisma.user.upsert({
      where: { email: u.email },
      update: { displayName: u.displayName, role: u.role, assignedFloor: u.assignedFloor ?? null, active: true },
      create: { displayName: u.displayName, email: u.email, role: u.role, assignedFloor: u.assignedFloor ?? null },
    });
    users.set(u.email, created);
  }
  console.log(`Seeded ${users.size} dev users.`);

  // Placeholder shop-wide labor rate — Accounting/IT can change this
  // anytime from the Accounting screen, no redeploy needed.
  await prisma.shopSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", laborRatePerHourUsd: 20 },
  });
  console.log("Ensured default shop settings (labor rate placeholder: $20/hr).");

  const advisor = users.get("nabil.haddad@impex-garage.local")!;
  const floor1Tech = users.get("fadi.achkar@impex-garage.local")!;
  const floor2Tech = users.get("elie.bourjeily@impex-garage.local")!;

  const existingJobs = await prisma.job.count();
  if (existingJobs === 0) {
    // Sample job 1: on Floor 1, in progress.
    const job1 = await prisma.job.create({
      data: {
        jobNumber: "IMX-20260909-0001",
        plate: "123456",
        vin: "1HGCM82633A004352",
        customerName: "Walid Fares",
        customerPhone: "+961 3 123 456",
        intakeComplaint: "Engine oil change + brake pads squeaking",
        intakeCategory: "Quick mechanic",
        jobType: JobType.PAID,
        currentFloor: 1,
        status: JobStatus.IN_PROGRESS,
        createdById: advisor.id,
      },
    });
    await prisma.floorTaskLog.create({
      data: { jobId: job1.id, floor: 1, status: JobStatus.IN_PROGRESS, openedById: advisor.id },
    });
    await prisma.jobEvent.createMany({
      data: [
        { jobId: job1.id, eventType: "CREATED", toValue: "floor 1", actorId: advisor.id },
        { jobId: job1.id, eventType: "STATUS_CHANGED", toValue: "IN_PROGRESS", actorId: floor1Tech.id },
      ],
    });

    // Sample job 2: on Floor 2, blocked waiting on a part.
    const job2 = await prisma.job.create({
      data: {
        jobNumber: "IMX-20260909-0002",
        plate: "789012",
        customerName: "Rana Saliba",
        customerPhone: "+961 71 987 654",
        intakeComplaint: "Transmission slipping, needs diagnostics",
        intakeCategory: "Hard mechanic",
        jobType: JobType.WARRANTY,
        currentFloor: 2,
        status: JobStatus.BLOCKED,
        blockerReasonCode: "PART",
        blockerNote: "Waiting on transmission solenoid, not in stock",
        createdById: advisor.id,
      },
    });
    await prisma.floorTaskLog.create({
      data: { jobId: job2.id, floor: 2, status: JobStatus.BLOCKED, openedById: floor2Tech.id },
    });
    await prisma.jobEvent.createMany({
      data: [
        { jobId: job2.id, eventType: "CREATED", toValue: "floor 2", actorId: advisor.id },
        { jobId: job2.id, eventType: "BLOCKER_FLAGGED", toValue: "PART", note: "Waiting on transmission solenoid", actorId: floor2Tech.id },
      ],
    });

    console.log("Seeded 2 sample jobs.");
  } else {
    console.log(`Skipped sample jobs (already ${existingJobs} in DB).`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
