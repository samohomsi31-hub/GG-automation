# IMPEX Garage Connected System — Build Spec v1

## 1. What this is
A central digital system connecting every team in the Sin El Fil garage around a single shared record per vehicle — replacing today's paper Job Card + verbal/manual handoffs. Every team (floors, parts, after-sales, accounting, management) works off the same live record instead of disconnected processes.

**Scale:** 25–50 cars/day, 100+ staff across 4 floors + after-sales + parts + accounting + management.

## 2. The garage floors (confirmed)
| Floor | Function | Approx. volume |
|---|---|---|
| Floor 1 | Quick mechanic (oil change, filters, brakes) | ~40% of jobs |
| Floor 2 | Hard mechanic | ~20% of jobs |
| Floor 3 | Paint | part of remaining ~40% |
| Floor 4 | Body / exterior shape repair | part of remaining ~40% |

Flow is **sequential per car** — one floor at a time, never simultaneous. Most jobs touch a single floor (Floor 1 dominates on quick recurring work); harder/body jobs may cross multiple floors in sequence. **Confirmed:** Floors 3 (paint) and 4 (body) are alternate paths, not a standard sequential pair — a car usually needs one or the other, not both. The routing logic should treat 3 and 4 as parallel options off the same branch point, not a fixed 1→2→3→4 pipeline.

## 3. Current process (confirmed, to be digitized)
1. Customer arrives / drops off car.
2. **Service Advisor** takes the complaint directly from the customer, writes it on a **Repair Order**.
3. Repair Order is handed to the garage — this becomes the **Job Card**, which follows the car physically.
4. Floor completes its work; car (and Job Card) moves to next floor if needed, or to after-sales/closeout if done.
5. **Confirmed:** One Job Card is opened per car visit and travels with the car across all floors it passes through — not re-opened per floor. This means the digital Job Card is a single persistent record per visit, with a floor-history log appended as it moves, not a new record per floor.

## 4. Core data model

### Job / Repair Order (the central object)
- Job ID, VIN/plate, customer info
- Intake complaint (from advisor, free text + structured category)
- Job type flag: warranty / paid / insurance
- Current floor, current status (queued / in progress / blocked / done)
- Sequential floor history (which floors it passed through, timestamps in/out)
- Blocker field: reason code (part / customer approval / insurance-warranty approval / other floor / other — free-form allowed since real cause "depends")
- Linked parts requisitions
- Linked labor hours per floor
- Linked cost roll-up (labor + parts, split by warranty/paid/insurance)
- Final sign-off / QC status
- After-sales handoff status

### Parts Requisition
- Linked Job ID, floor requesting, part(s) needed, quantity
- Status: requested / confirmed in stock / backordered / fulfilled
- **Note:** parts inventory currently lives in IMAD (closed system, no API). See Section 6.

### Floor Task Log
- Linked Job ID, floor, technician(s) assigned, hours logged, notes, completion timestamp

## 5. Roles & permissions (M365 SSO — Entra ID)
| Role | Sees | Can edit |
|---|---|---|
| Service Advisor | Intake form, customer info, all job statuses | Create job, edit intake |
| Floor Technician/Lead | Own floor's task queue | Update task status, log hours, flag blocker |
| Parts Office | Requisition queue across all jobs | Update requisition status |
| After-Sales | Customer-facing job status, no cost data | Update customer contact log |
| Accounting | Full cost data, no floor task detail needed | Read-mostly; close out billing |
| Senior Management | Full dashboard, all data, aggregate views | Read-only (config/reporting) |
| IT/Admin | Everything | User management, system config |

Auth: Microsoft 365 / Entra ID SSO — no separate passwords, IT manages access via existing groups.

## 6. IMAD (parts software) integration — open item
No public API. Owner-level access may allow installing/exploring IMAD directly.
**Before building an integration, first step is investigative:** open IMAD, check for —
- An admin/reporting export function (CSV/Excel)
- A local database file the app reads from (SQLite/Access/SQL Server) that could be queried directly
- Any scheduled export or reporting tool already built into it

Until resolved, **Phase 1 treats parts status as manually updated** by the parts office inside the new system (still faster than phone/walk-over), with a real IMAD integration planned as Phase 2 once the data access question is answered.

## 7. Infrastructure
- **Confirmed:** IT prefers cloud/Azure hosting — pairs naturally with existing M365/Entra ID usage for both auth and hosting under one Microsoft ecosystem.
- Backend: real database (Postgres, e.g. Azure Database for PostgreSQL, or Azure SQL) + API layer — required at this scale (100+ concurrent users, 25-50 jobs/day with multiple teams reading/writing same records).
- Not a spreadsheet-backed app — genuine multi-user backend needed.
- **Confirmed:** Shared PCs/tablets already exist on the floor — the system can be a real web app technicians use directly on the floor, not a paper-first design with digital entry happening later/elsewhere. This significantly raises the value of real-time status (a blocker flagged on Floor 2 shows up in Parts' queue within seconds, not at next walk-over).

## 8. Build phases
**Phase 1 (MVP):** Digital Job Card — intake, floor routing, status tracking, blocker flagging, floor task logs. Replaces paper Repair Order/Job Card.
**Phase 2:** Parts requisition module (manual entry) + After-Sales live status view + Accounting cost roll-up.
**Phase 3:** Senior Management dashboard (aggregates Phase 1+2 data).
**Phase 4:** IMAD integration (once data access method is confirmed) + parts demand forecasting using accumulated job history.

## 9. Still to verify before/during build
- IMAD's actual export/database access options (Section 6) — this is the one open item left. Recommend doing this investigation in parallel with Phase 1 build, since Phase 1 doesn't depend on it (parts status is manual-entry in Phase 1 regardless).
- Confirm with IT: specific Azure services/budget approved, and who owns provisioning (you, or an IT contact you'll coordinate with) before Claude Code needs to actually deploy anything.
- Nice-to-have, not blocking: rough device count/type on the floor (tablets vs. desktop PCs) — affects whether the UI should be touch-optimized.
