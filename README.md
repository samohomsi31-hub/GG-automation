# IMPEX Garage — Job Card (Phase 1)

Digital Job Card system for IMPEX (Sin El Fil): intake, floor routing,
status tracking, blocker flagging, and floor task logs. Implements
Phase 1 of the build spec — see `impex-garage-system-spec.md`.

## Stack

- **Backend**: Node.js + TypeScript, Express, Prisma, PostgreSQL (`/server`)
- **Frontend**: React + TypeScript + Vite, touch-friendly UI for floor tablets (`/web`)
- **Auth**: dev-only login-as-user stub now; designed to be replaced by
  Microsoft Entra ID SSO later without touching any route logic (see
  `server/src/auth.ts` and `server/src/routes/auth.ts`)

Both are plain Node apps with no Azure-specific code, so they run
locally as-is; `server/prisma/schema.prisma` targets Postgres, which
maps directly onto Azure Database for PostgreSQL when you're ready to
deploy.

## Local setup

### 1. Database

Either run Postgres via Docker:

```bash
docker compose up -d
```

...or point `server/.env`'s `DATABASE_URL` at any Postgres 14+ instance
you already have running locally.

### 2. Backend

```bash
cd server
cp .env.example .env   # adjust DATABASE_URL if not using docker compose
npm install
npm run prisma:migrate   # creates tables
npm run seed              # seeds 10 dev users (one per role) + 2 sample jobs
npm run dev                # http://localhost:4000
```

### 3. Frontend

```bash
cd web
npm install
npm run dev   # http://localhost:5173
```

Open http://localhost:5173 — you'll land on a "dev login" screen listing
the seeded staff members. Pick one to sign in as that role; no password
needed locally. Real deployments would replace `/api/auth/dev-*` with an
Entra ID token exchange feeding the same `req.user` shape.

## Deploying a test instance (Render)

`render.yaml` at the repo root is a Render "Blueprint" that provisions
the database, API, and frontend together in one step. This is a
throwaway test deployment (still the dev-login stub, free-tier
Postgres) so IMPEX staff can click a real link — not the eventual Azure
production home from spec Section 7.

1. Sign up / log in at [render.com](https://render.com) (GitHub login
   is fastest — it needs read access to this repo to deploy from it).
2. **New** → **Blueprint** → pick this repository → select the branch
   you want live (e.g. `claude/impex-job-card-phase-1-c0avtj`, or
   `main` once the PR is merged).
3. Render reads `render.yaml` and shows three resources — the Postgres
   database, `impex-garage-api`, `impex-garage-web` — click **Apply**.
4. Wait for all three to finish deploying (a few minutes; the API step
   runs migrations + seeds the dev users on boot). Open the
   `impex-garage-web` service's URL — that's the link to send IMPEX.

Notes:
- Free-tier web services spin down after inactivity, so the first
  request after a quiet period can take ~30-50s to wake up.
- Free-tier Postgres on Render expires after 90 days — fine for a test
  round, not for anything long-lived.
- Pushing to the deployed branch auto-redeploys.

## Seeded dev users

| Name | Role | Floor |
|---|---|---|
| Nabil Haddad | Service Advisor | — |
| Fadi Achkar | Floor Technician/Lead | 1 |
| Elie Bou Rjeily | Floor Technician/Lead | 2 |
| Rami Chidiac | Floor Technician/Lead | 3 (Paint) |
| Georges Abou Khalil | Floor Technician/Lead | 4 (Body) |
| Maya Saade | Parts Office | — |
| Karim Nassar | After-Sales | — |
| Layal Frem | Accounting | — |
| Antoine Khoury | Senior Management | — |
| Sami Rahme | IT/Admin | — |

## What's implemented (Phase 1)

- **Job Card / Repair Order**: one persistent record per car visit
  (Section 4), created at intake, carrying job type (warranty/paid/
  insurance), current floor + status, blocker fields, QC status, and
  after-sales handoff status.
- **Floor Task Log**: one row per floor visit, merging the "floor
  history" and "floor task log" from the spec into a single append-only
  table — entered/exited timestamps, assigned technician(s) with hours,
  notes, and completion timestamp per visit.
- **Floor routing**: sequential, one floor at a time. The technician/
  lead completing a floor picks the next floor (or finishes the job)
  on the spot — Floors 3 (paint) and 4 (body) are presented as
  alternate branches after Floor 2, never a fixed pipeline, and a
  Service Advisor can also route/override from their screen.
- **Blocker flagging**: reason code (part / customer approval /
  insurance-warranty approval / other floor / other) plus free-form
  note; shows up immediately in the job's status and floor queue.
- **Roles/permissions** (Section 5): enforced both in the UI (nav links
  hidden) and in the API (`requireRole` middleware on every write
  route) — see `server/src/lib/permissions.ts`.
- **Parts requisition**: manual status entry only (Section 6 — no IMAD
  integration yet), linked to the job and current floor visit.
- **Audit trail**: an append-only `JobEvent` log records every status/
  floor/blocker/QC/after-sales change for traceability across teams.

Three screens: Service Advisor intake, Floor Technician queue (per
floor, touch-friendly), and a status lookup any role can use to check
a car's current status, floor history, and event log.

## Not built yet (later phases)

Parts Office queue dashboard, After-Sales live view, Accounting cost
roll-up (Phase 2); Senior Management aggregate dashboard (Phase 3);
IMAD integration + forecasting (Phase 4).
