import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Job } from "../types";
import StatusBadge from "../components/StatusBadge";
import { JOB_TYPE_LABELS } from "../labels";

const CONTACT_METHODS = [
  { value: "CALL", label: "Phone call" },
  { value: "SMS", label: "SMS" },
  { value: "EMAIL", label: "Email" },
  { value: "IN_PERSON", label: "In person" },
  { value: "OTHER", label: "Other" },
];

export default function AfterSales() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [showHandedOff, setShowHandedOff] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [done, closed] = await Promise.all([api.listJobs({ status: "DONE" }), api.listJobs({ status: "CLOSED" })]);
      const all = [...done, ...closed];
      setJobs(all);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = jobs.filter((j) => showHandedOff || j.afterSalesStatus !== "HANDED_OFF");

  return (
    <div className="main">
      <h1 style={{ marginBottom: 8 }}>Ready for customer</h1>
      <p style={{ color: "var(--text-dim)", marginBottom: 16 }}>
        Jobs that have finished all floors — no cost data shown here, just status and customer contact history.
      </p>
      <div className="button-row" style={{ marginBottom: 16 }}>
        <button className={`floor-tab ${!showHandedOff ? "active" : ""}`} onClick={() => setShowHandedOff(false)}>
          Awaiting handoff
        </button>
        <button className={`floor-tab ${showHandedOff ? "active" : ""}`} onClick={() => setShowHandedOff(true)}>
          Show handed off too
        </button>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="empty-state">Nothing waiting on After-Sales right now.</div>
      ) : (
        <div className="grid">
          {visible.map((j) => (
            <AfterSalesCard key={j.id} job={j} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function AfterSalesCard({ job, onChanged }: { job: Job; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState(CONTACT_METHODS[0].value);
  const [note, setNote] = useState("");

  async function run(action: () => Promise<unknown>) {
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
        <StatusBadge status={job.afterSalesStatus} />
      </div>
      <div style={{ color: "var(--text-dim)", fontSize: 14 }}>
        {job.customerName} {job.customerPhone ? `· ${job.customerPhone}` : ""} · {JOB_TYPE_LABELS[job.jobType]}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="button-row">
        {job.afterSalesStatus === "NOT_READY" && (
          <button className="big-button green" disabled={busy} onClick={() => run(() => api.setAfterSales(job.id, "READY"))}>
            Mark ready for pickup
          </button>
        )}
        {job.afterSalesStatus === "READY" && (
          <button className="big-button green" disabled={busy} onClick={() => run(() => api.setAfterSales(job.id, "HANDED_OFF"))}>
            Mark handed off
          </button>
        )}
        <button className="big-button ghost" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Hide" : "Contact log"}
        </button>
      </div>

      {expanded && (
        <div className="card">
          <div className="section-title">Contact history</div>
          {job.contactLogs.length === 0 ? (
            <p style={{ color: "var(--text-dim)", fontSize: 14 }}>No contact logged yet.</p>
          ) : (
            <div className="timeline" style={{ marginBottom: 16 }}>
              {job.contactLogs.map((c) => (
                <div key={c.id} className="timeline-item">
                  <div className="timeline-floor">{CONTACT_METHODS.find((m) => m.value === c.method)?.label || c.method}</div>
                  <div>
                    <div>{c.note}</div>
                    <div className="timeline-meta">
                      {c.contactedBy.displayName} · {new Date(c.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="section-title">Log a contact</div>
          <div className="field">
            <label>Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              {CONTACT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <textarea placeholder="e.g. Called customer, car ready for pickup" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="button-row">
            <button
              className="big-button ghost"
              disabled={busy || !note.trim()}
              onClick={() =>
                run(async () => {
                  await api.logContact(job.id, method, note.trim());
                  setNote("");
                })
              }
            >
              Save contact
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
