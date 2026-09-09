import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { Job } from "../types";
import StatusBadge from "../components/StatusBadge";
import { BLOCKER_REASON_LABELS, JOB_TYPE_LABELS } from "../labels";

const FLOORS = [1, 2, 3, 4];
const FLOOR_SHORT: Record<number, string> = { 1: "Floor 1", 2: "Floor 2", 3: "Floor 3 (Paint)", 4: "Floor 4 (Body)" };

// After Floor 2, a job branches to paint OR body, not a fixed pipeline —
// this only orders the routing buttons, it never blocks a choice.
const NEXT_SUGGESTIONS: Record<number, number[]> = { 1: [2], 2: [3, 4], 3: [], 4: [] };

const BLOCKER_REASONS = Object.keys(BLOCKER_REASON_LABELS);

export default function FloorView() {
  const { user } = useAuth();
  const [floor, setFloor] = useState<number>(user?.assignedFloor || 1);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (f: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.floorQueue(f);
      setJobs(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(floor);
  }, [floor, load]);

  return (
    <div className="main">
      <h1 style={{ marginBottom: 16 }}>Floor queue</h1>
      <div className="floor-tabs">
        {FLOORS.map((f) => (
          <button key={f} className={`floor-tab ${f === floor ? "active" : ""}`} onClick={() => setFloor(f)}>
            {FLOOR_SHORT[f]}
          </button>
        ))}
      </div>
      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">No jobs currently on this floor.</div>
      ) : (
        <div className="grid">
          {jobs.map((j) => (
            <JobCard key={j.id} job={j} onChanged={() => load(floor)} />
          ))}
        </div>
      )}
    </div>
  );
}

function JobCard({ job, onChanged }: { job: Job; onChanged: () => void }) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBlockerForm, setShowBlockerForm] = useState(false);
  const [blockerReason, setBlockerReason] = useState(BLOCKER_REASONS[0]);
  const [blockerNote, setBlockerNote] = useState("");
  const [hours, setHours] = useState("");
  const [notes, setNotes] = useState("");
  const [partDescription, setPartDescription] = useState("");

  const openLog = job.floorTaskLogs.find((l) => l.exitedAt === null);
  const nextOptions = useMemo(() => {
    const suggested = job.currentFloor ? NEXT_SUGGESTIONS[job.currentFloor] || [] : [];
    const rest = [1, 2, 3, 4].filter((f) => f !== job.currentFloor && !suggested.includes(f));
    return [...suggested, ...rest];
  }, [job.currentFloor]);

  async function run(action: () => Promise<Job>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`job-card status-${job.status}`}>
      <div className="job-card-header" onClick={() => setExpanded((v) => !v)} style={{ cursor: "pointer" }}>
        <div>
          <div className="job-number">{job.jobNumber}</div>
          <div className="job-plate">{job.plate}</div>
        </div>
        <StatusBadge status={job.status} />
      </div>
      <div style={{ color: "var(--text-dim)", fontSize: 14 }}>
        {job.customerName} · {JOB_TYPE_LABELS[job.jobType]}
      </div>
      <div style={{ fontSize: 15 }}>{job.intakeComplaint}</div>

      {job.status === "BLOCKED" && (
        <div className="blocker-banner">
          <strong>{BLOCKER_REASON_LABELS[job.blockerReasonCode || "OTHER"]}</strong>
          {job.blockerNote ? <div>{job.blockerNote}</div> : null}
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      <div className="button-row">
        {job.status === "QUEUED" && (
          <button className="big-button green" disabled={busy} onClick={() => run(() => api.startJob(job.id))}>
            Start work
          </button>
        )}
        {job.status === "IN_PROGRESS" && (
          <>
            <button className="big-button amber" disabled={busy} onClick={() => setShowBlockerForm((v) => !v)}>
              Flag blocker
            </button>
          </>
        )}
        {job.status === "BLOCKED" && (
          <button className="big-button green" disabled={busy} onClick={() => run(() => api.clearBlocker(job.id))}>
            Clear blocker
          </button>
        )}
        <button className="big-button ghost" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Hide details" : "Details"}
        </button>
      </div>

      {showBlockerForm && (
        <div className="card">
          <div className="field">
            <label>Reason</label>
            <select value={blockerReason} onChange={(e) => setBlockerReason(e.target.value)}>
              {BLOCKER_REASONS.map((r) => (
                <option key={r} value={r}>
                  {BLOCKER_REASON_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Note (optional — real cause often varies)</label>
            <textarea value={blockerNote} onChange={(e) => setBlockerNote(e.target.value)} />
          </div>
          <div className="button-row">
            <button
              className="big-button red"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const r = await api.flagBlocker(job.id, blockerReason, blockerNote || undefined);
                  setShowBlockerForm(false);
                  setBlockerNote("");
                  return r;
                })
              }
            >
              Confirm blocker
            </button>
            <button className="big-button ghost" onClick={() => setShowBlockerForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {expanded && (
        <div className="card">
          {job.vin && <div style={{ marginBottom: 8, fontSize: 14, color: "var(--text-dim)" }}>VIN: {job.vin}</div>}

          <div className="section-title">Technician & hours (this floor visit)</div>
          <div className="button-row" style={{ marginBottom: 10 }}>
            {openLog?.technicians.map((t) => (
              <span key={t.id} className="badge IN_PROGRESS">
                {t.user.displayName}
                {t.hoursLogged ? ` · ${t.hoursLogged}h` : ""}
              </span>
            ))}
          </div>
          {user?.role === "FLOOR_TECH" && (
            <div className="button-row" style={{ marginBottom: 16 }}>
              <input
                type="number"
                min={0}
                step={0.25}
                placeholder="Hours"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                style={{ width: 100, padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)" }}
              />
              <button
                className="big-button ghost"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const r = await api.assignTechnician(job.id, user.id, hours ? Number(hours) : null);
                    setHours("");
                    return r;
                  })
                }
              >
                Log my hours
              </button>
            </div>
          )}

          <div className="section-title">Notes</div>
          <div className="field">
            <textarea placeholder={openLog?.notes || "Add a note for this floor visit…"} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="button-row" style={{ marginBottom: 16 }}>
            <button
              className="big-button ghost"
              disabled={busy || !notes}
              onClick={() =>
                run(async () => {
                  const r = await api.setFloorNotes(job.id, notes);
                  setNotes("");
                  return r;
                })
              }
            >
              Save note
            </button>
          </div>

          <div className="section-title">Parts requisition (manual)</div>
          <div className="button-row" style={{ marginBottom: 16 }}>
            <input
              placeholder="Part needed"
              value={partDescription}
              onChange={(e) => setPartDescription(e.target.value)}
              style={{ flex: 1, minWidth: 160, padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)" }}
            />
            <button
              className="big-button ghost"
              disabled={busy || !partDescription}
              onClick={() =>
                run(async () => {
                  await api.createPartsRequisition(job.id, partDescription, 1);
                  setPartDescription("");
                  return api.getJob(job.id);
                })
              }
            >
              Request part
            </button>
          </div>
          {job.partsRequisitions.length > 0 && (
            <div className="button-row" style={{ marginBottom: 16 }}>
              {job.partsRequisitions.map((p) => (
                <span key={p.id} className="badge QUEUED">
                  {p.partDescription} · {p.status}
                </span>
              ))}
            </div>
          )}

          {job.status !== "BLOCKED" && (
            <>
              <div className="section-title">Route this job</div>
              <div className="button-row">
                <button className="big-button green" disabled={busy} onClick={() => run(() => api.routeJob(job.id, null))}>
                  Finish — send to QC
                </button>
                {nextOptions.map((f) => (
                  <button key={f} className="big-button ghost" disabled={busy} onClick={() => run(() => api.routeJob(job.id, f))}>
                    Send to Floor {f}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
