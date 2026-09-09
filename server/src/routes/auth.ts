import { Router } from "express";
import { prisma } from "../db";
import { clearSessionCookie, issueSessionCookie } from "../auth";

const router = Router();

// DEV-ONLY: lists seeded users so the local "login as" picker can offer
// them. This route (and /dev-login below) must never exist once Entra ID
// SSO is wired up — replace this whole file with a real Entra token
// exchange at that point; nothing else in the app needs to change since
// routes only ever read req.user.
router.get("/dev-users", async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { active: true },
    orderBy: [{ role: "asc" }, { displayName: "asc" }],
    select: { id: true, displayName: true, email: true, role: true, assignedFloor: true },
  });
  res.json(users);
});

router.post("/dev-login", async (req, res) => {
  const { userId } = req.body as { userId?: string };
  if (!userId) return res.status(400).json({ error: "userId required" });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.active) return res.status(404).json({ error: "User not found" });

  issueSessionCookie(res, {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    role: user.role,
    assignedFloor: user.assignedFloor,
  });
  res.json({ ok: true });
});

router.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get("/me", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  res.json(req.user);
});

export default router;
