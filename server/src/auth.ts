import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { prisma } from "./db";

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret-change-me";
const COOKIE_NAME = "impex_session";

export interface SessionUser {
  id: string;
  displayName: string;
  email: string;
  role: Role;
  assignedFloor: number | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export function issueSessionCookie(res: Response, user: SessionUser) {
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: "12h" });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    // In production behind HTTPS on Azure this should be `secure: true`;
    // left false here so local http:// dev keeps working.
    secure: false,
    maxAge: 12 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME);
}

// Reads the session cookie set by the dev-login route (or, once Entra ID
// SSO is wired up, by a real Entra token exchange) and attaches the user
// to the request. Everything downstream — routes, permission checks —
// only ever looks at req.user, so swapping the login mechanism later
// doesn't touch the rest of the app.
export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as SessionUser;
    // Re-check against the DB so a deactivated user is rejected immediately
    // rather than riding out their token's remaining lifetime.
    const dbUser = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (dbUser && dbUser.active) {
      req.user = {
        id: dbUser.id,
        displayName: dbUser.displayName,
        email: dbUser.email,
        role: dbUser.role,
        assignedFloor: dbUser.assignedFloor,
      };
    }
  } catch {
    // invalid/expired token: leave req.user unset
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Not permitted for this role" });
    }
    next();
  };
}
