import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { Job } from "../types";
import StatusBadge from "../components/StatusBadge";
import { BLOCKER_REASON_LABELS, FLOOR_LABELS, JOB_TYPE_LABELS } from "../labels";

export default function StatusView() {
  const [q, setQ] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selected, setSelected] = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listJobs(query ? { q: query } : {});
      setJobs(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    search("");
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => search(q), 250);
    return () => clearTimeout(t);
  }, [q, search]);

  function refreshSelected() {
    if (selected) api.getJob(selected.id).then(setSelected);
    search(q);
  }

  return (
    <div className="main">
      <h1 style={{ marginBottom: 16 }}>Job status lookup</h1>
      <div className="search-bar">
        <input placeholder="Search by plate, VIN, job number, or customer…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </div>
      {error && <div className="error-banner">{error}</div>}

      {selected ? (
        <JobDetail job={selected} onBack={() => setSelected(null)} onChanged={refreshSelected} />
      ) : loading ? (
        <div className="empty-state">Loading…</div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">No jobs found.</div>
      ) : (
        <div className="grid">
          {jobs.map((j) => (
            <div key={j.id} className={`job-card status-${j.status}`} style={{ cursor: "pointer" }} onClick={() => setSelected(j)}>
              <div className="job-card-header">
                <div>
                  <div className="job-number">{j.jobNumber}</div>
                  <div className="job-plate">{j.plate}</div>
                </div>
                <StatusBadge status={j.status} />
              </div>
              <div style={{ color: "var(--text-dim)", fontSize: 14 }}>
                {j.customerName} · {j.currentFloor ? FLOOR_LABELS[j.currentFloor] : "Not on a floor"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function JobDetail({ job, onBack, onChanged }: { job: Job; onBack: () => void; onChanged: () => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const canQc = user?.role === "SERVICE_ADVISOR" || user?.role === "IT_ADMIN";
  const canAfterSales = user?.role === "AFTER_SALES" || user?.role === "SERVICE_ADVISOR" || user?.role === "IT_ADMIN";

  return (
    <div className="card">
      <button className="big-button ghost" style={{ marginBottom: 16 }} onClick={onBack}>
        ← Back to results
      </button>

      <div className="job-card-header">
        <div>
          <div className="job-number">{job.jobNumber}</div>
          <div className="job-plate">{job.plate}</div>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div style={{ margin: "12px 0", fontSize: 15, color: "var(--text-dim)" }}>
        {job.customerName} {job.customerPhone ? `· ${job.customerPhone}` : ""} · {JOB_TYPE_LABELS[job.jobType]}
        {job.vin ? ` · VIN ${job.vin}` : ""}
      </div>

      <div style={{ marginBottom: 12 }}>
        <strong>Complaint:</strong> {job.intakeComplaint} ({job.intakeCategory})
      </div>

      <div style={{ marginBottom: 12 }}>
        <strong>Currently:</strong> {job.currentFloor ? FLOOR_LABELS[job.currentFloor] : "Not on a floor (awaiting sign-off / closed)"}
      </div>

      {job.status === "BLOCKED" && (
        <div className="blocker-banner" style={{ marginBottom: 12 }}>
          <strong>{BLOCKER_REASON_LABELS[job.blockerReasonCode || "OTHER"]}</strong>
          {job.blockerNote ? <div>{job.blockerNote}</div> : null}
        </div>
      )}

      <div className="button-row" style={{ marginBottom: 12 }}>
        <span className="badge QUEUED">QC: {job.qcStatus}</span>
        <span className="badge QUEUED">After-sales: {job.afterSalesStatus.replace("_", " ")}</span>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="button-row" style={{ marginBottom: 16 }}>
        {canQc && job.status === "DONE" && job.qcStatus === "PENDING" && (
          <>
            <button className="big-button green" disabled={busy} onClick={() => run(() => api.setQc(job.id, "PASSED"))}>
              QC: Pass
            </button>
            <button className="big-button red" disabled={busy} onClick={() => run(() => api.setQc(job.id, "FAILED"))}>
              QC: Fail
            </button>
          </>
        )}
        {canQc && job.status === "DONE" && job.qcStatus === "PASSED" && (
          <button className="big-button green" disabled={busy} onClick={() => run(() => api.closeJob(job.id))}>
            Close job card
          </button>
        )}
        {canAfterSales && job.status === "DONE" && job.afterSalesStatus !== "HANDED_OFF" && (
          <button
            className="big-button ghost"
            disabled={busy}
            onClick={() => run(() => api.setAfterSales(job.id, job.afterSalesStatus === "NOT_READY" ? "READY" : "HANDED_OFF"))}
          >
            After-sales: mark {job.afterSalesStatus === "NOT_READY" ? "ready" : "handed off"}
          </button>
        )}
      </div>

      <div className="section-title">Floor history</div>
      <div className="timeline">
        {job.floorTaskLogs.map((log) => (
          <div key={log.id} className="timeline-item">
            <div className="timeline-floor">{FLOOR_LABELS[log.floor]?.split(" — ")[0] || `Floor ${log.floor}`}</div>
            <div>
              <div>
                <StatusBadge status={log.status} />
              </div>
              <div className="timeline-meta">
                In: {new Date(log.enteredAt).toLocaleString()}
                {log.exitedAt ? ` · Out: ${new Date(log.exitedAt).toLocaleString()}` : " · still here"}
              </div>
              {log.technicians.length > 0 && (
                <div className="timeline-meta">
                  {log.technicians.map((t) => `${t.user.displayName}${t.hoursLogged ? ` (${t.hoursLogged}h)` : ""}`).join(", ")}
                </div>
              )}
              {log.notes && <div className="timeline-meta">{log.notes}</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="section-title">Event log</div>
      <div className="timeline">
        {job.events.map((ev) => (
          <div key={ev.id} className="timeline-item">
            <div className="timeline-floor" style={{ minWidth: 160 }}>
              {ev.eventType.replace(/_/g, " ")}
            </div>
            <div>
              <div className="timeline-meta">
                {ev.actor.displayName} · {new Date(ev.createdAt).toLocaleString()}
              </div>
              {(ev.toValue || ev.note) && (
                <div className="timeline-meta">
                  {ev.toValue} {ev.note}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
