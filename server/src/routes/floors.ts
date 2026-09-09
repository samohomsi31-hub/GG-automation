import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../auth";
import { jobInclude } from "../lib/jobInclude";

const router = Router();
router.use(requireAuth);

const FLOORS = [1, 2, 3, 4];

// Queue for one floor: jobs currently sitting on it, oldest-arrived first —
// what a Floor Technician/Lead sees when they open their tablet. Uses the
// same jobInclude as every other Job-returning route so the frontend gets
// a consistent shape regardless of which endpoint it called.
router.get("/:floor/queue", async (req, res) => {
  const floor = parseInt(req.params.floor, 10);
  if (!FLOORS.includes(floor)) return res.status(400).json({ error: "invalid floor" });

  const jobs = await prisma.job.findMany({
    where: { currentFloor: floor, status: { not: "CLOSED" } },
    orderBy: { updatedAt: "asc" },
    include: jobInclude,
  });
  res.json(jobs);
});

export default router;
