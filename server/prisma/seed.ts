import { PrismaClient, Role, JobStatus, JobType } from "@prisma/client";

const prisma = new PrismaClient();

// Real IMPEX staff (from Impex_Employee_List.xlsx), scoped to the people
// who actually touch the garage repair workflow this app covers — sales,
// marketing, HR, admin, PDI, drivers, and most of Spare Parts/warehouse
// are left out since they have no functional role in a repair Job Card.
const DEV_USERS: {
  displayName: string;
  email: string;
  role: Role;
  assignedFloor?: number;
  canSignQc?: boolean;
}[] = [
  // Service Advisors (+ Reception Managers, who take the customer's
  // complaint at intake the same way) — across every brand IMPEX carries.
  { displayName: "Serge Khatchik Bedrossian", email: "serge.bedrossian@impex-garage.local", role: Role.SERVICE_ADVISOR },
  { displayName: "Nadim Maroun Hourany", email: "nadim.hourany@impex-garage.local", role: Role.SERVICE_ADVISOR },
  { displayName: "Hamed Abdel Fatah Boutary", email: "hamed.boutary@impex-garage.local", role: Role.SERVICE_ADVISOR },
  { displayName: "Krikor Puzant Topalian", email: "krikor.topalian@impex-garage.local", role: Role.SERVICE_ADVISOR },
  { displayName: "Paul Khalil Abi Aad", email: "paul.aad@impex-garage.local", role: Role.SERVICE_ADVISOR },
  { displayName: "Simon Youssef Zgheib", email: "simon.zgheib@impex-garage.local", role: Role.SERVICE_ADVISOR },
  { displayName: "Jean Tony Al Hajj Moussa", email: "jean.moussa@impex-garage.local", role: Role.SERVICE_ADVISOR },
  { displayName: "Marwan Jamal Eless", email: "marwan.eless@impex-garage.local", role: Role.SERVICE_ADVISOR },
  { displayName: "Elie Ernest Ghorayeb", email: "elie.ghorayeb@impex-garage.local", role: Role.SERVICE_ADVISOR },

  // Floor Technicians/Leads — one per floor, matching the Floor Managers.
  { displayName: "Daoud Simon Gerges", email: "daoud.gerges@impex-garage.local", role: Role.FLOOR_TECH, assignedFloor: 1 },
  { displayName: "Mounir Georges Boulos", email: "mounir.boulos@impex-garage.local", role: Role.FLOOR_TECH, assignedFloor: 2 },
  { displayName: "Tarek Mekhayel Abdelnour", email: "tarek.abdelnour@impex-garage.local", role: Role.FLOOR_TECH, assignedFloor: 3 },
  { displayName: "Francois Robert Ghanem", email: "francois.ghanem@impex-garage.local", role: Role.FLOOR_TECH, assignedFloor: 4 },
  { displayName: "Fadi Antoine Maroun", email: "fadi.maroun@impex-garage.local", role: Role.FLOOR_TECH, assignedFloor: 4 },

  // Parts Office — counter-facing Spare Parts staff only.
  { displayName: "Joe Antoine Maroun", email: "joe.maroun@impex-garage.local", role: Role.PARTS_OFFICE },
  { displayName: "Ali Khodor Ghaddar", email: "ali.ghaddar@impex-garage.local", role: Role.PARTS_OFFICE },
  { displayName: "Maroun Abdo Rizk", email: "maroun.rizk@impex-garage.local", role: Role.PARTS_OFFICE },

  // After-Sales. Francois Joseph Abdel Nour is the Service Manager — head
  // of garage — the one who does final QC sign-off and closes job cards.
  { displayName: "Francois Joseph Abdel Nour", email: "francois.nour@impex-garage.local", role: Role.AFTER_SALES, canSignQc: true },
  { displayName: "Sanad Gerges El Rami", email: "sanad.rami@impex-garage.local", role: Role.AFTER_SALES },
  { displayName: "Lara Ibrahim Charbel", email: "lara.charbel@impex-garage.local", role: Role.AFTER_SALES },
  { displayName: "Dany Youeel Warde", email: "dany.warde@impex-garage.local", role: Role.AFTER_SALES },
  { displayName: "Antoine Edouard Bassil", email: "antoine.bassil@impex-garage.local", role: Role.AFTER_SALES },
  { displayName: "Vivian Ohanness Jean Babahekian", email: "vivian.babahekian@impex-garage.local", role: Role.AFTER_SALES },

  // Accounting / Finance.
  { displayName: "Rami Raymond Abi Rached", email: "rami.rached@impex-garage.local", role: Role.ACCOUNTING },
  { displayName: "Mireille Gergi El Ghaou", email: "mireille.ghaou@impex-garage.local", role: Role.ACCOUNTING },
  { displayName: "Raymond Antoine El Daccache", email: "raymond.daccache@impex-garage.local", role: Role.ACCOUNTING },
  { displayName: "Amanda Nabil Estephan", email: "amanda.estephan@impex-garage.local", role: Role.ACCOUNTING },

  // Senior Management.
  { displayName: "Farid Samir Homsi", email: "farid.homsi@impex-garage.local", role: Role.SENIOR_MANAGEMENT },
  { displayName: "Tanios Habib Atallah", email: "tanios.atallah@impex-garage.local", role: Role.SENIOR_MANAGEMENT },

  // IT/Admin. Sami Youssef Akiki holds both CFO and IT Manager hats —
  // seeded as IT_ADMIN, the broader of the two, since that role already
  // has full system access spec Section 5 gives IT/Admin.
  { displayName: "Sami Youssef Akiki", email: "sami.akiki@impex-garage.local", role: Role.IT_ADMIN },
  { displayName: "Nehmeh Bahij Elsaoub", email: "nehmeh.elsaoub@impex-garage.local", role: Role.IT_ADMIN },
  { displayName: "Ramy Romeo Karam", email: "ramy.karam@impex-garage.local", role: Role.IT_ADMIN },
];

async function main() {
  const users = new Map<string, { id: string }>();
  for (const u of DEV_USERS) {
    const created = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        displayName: u.displayName,
        role: u.role,
        assignedFloor: u.assignedFloor ?? null,
        canSignQc: u.canSignQc ?? false,
        active: true,
      },
      create: {
        displayName: u.displayName,
        email: u.email,
        role: u.role,
        assignedFloor: u.assignedFloor ?? null,
        canSignQc: u.canSignQc ?? false,
      },
    });
    users.set(u.email, created);
  }
  console.log(`Seeded ${users.size} dev users.`);

  // Deactivate the earlier placeholder names now that real staff are
  // seeded — deactivated (not deleted) so any jobs/history they created
  // during testing stay intact and attributable.
  const oldPlaceholderEmails = [
    "nabil.haddad@impex-garage.local",
    "fadi.achkar@impex-garage.local",
    "elie.bourjeily@impex-garage.local",
    "rami.chidiac@impex-garage.local",
    "georges.aboukhalil@impex-garage.local",
    "maya.saade@impex-garage.local",
    "karim.nassar@impex-garage.local",
    "layal.frem@impex-garage.local",
    "antoine.khoury@impex-garage.local",
    "sami.rahme@impex-garage.local",
  ];
  const deactivated = await prisma.user.updateMany({
    where: { email: { in: oldPlaceholderEmails } },
    data: { active: false },
  });
  if (deactivated.count) console.log(`Deactivated ${deactivated.count} placeholder dev users.`);

  // Placeholder shop-wide labor rate — Accounting/IT can change this
  // anytime from the Accounting screen, no redeploy needed.
  await prisma.shopSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", laborRatePerHourUsd: 20 },
  });
  console.log("Ensured default shop settings (labor rate placeholder: $20/hr).");

  const advisor = users.get("serge.bedrossian@impex-garage.local")!;
  const floor1Tech = users.get("daoud.gerges@impex-garage.local")!;
  const floor2Tech = users.get("mounir.boulos@impex-garage.local")!;

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
