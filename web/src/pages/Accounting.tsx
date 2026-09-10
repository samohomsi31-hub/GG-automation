import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { AccountingJob, AccountingJobDetail } from "../types";
import StatusBadge from "../components/StatusBadge";
import { JOB_TYPE_LABELS } from "../labels";

const JOB_TYPES = ["", "PAID", "WARRANTY", "INSURANCE"];

export default function Accounting() {
  const [jobs, setJobs] = useState<AccountingJob[]>([]);
  const [laborRate, setLaborRate] = useState<number>(0);
  const [rateInput, setRateInput] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState("");
  const [billingFilter, setBillingFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingRate, setSavingRate] = useState(false);

  const load = useCallback(async (jobType: string, billingStatus: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.accountingJobs({ jobType: jobType || undefined, billingStatus: billingStatus || undefined });
      setJobs(data.jobs);
      setLaborRate(data.laborRatePerHourUsd);
      setRateInput(String(data.laborRatePerHourUsd));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(jobTypeFilter, billingFilter);
  }, [jobTypeFilter, billingFilter, load]);

  async function saveRate() {
    setSavingRate(true);
    setError(null);
    try {
      const r = await api.setLaborRate(Number(rateInput));
      setLaborRate(r.laborRatePerHourUsd);
      load(jobTypeFilter, billingFilter);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingRate(false);
    }
  }

  const totalCost = jobs.reduce((sum, j) => sum + j.cost.totalCost, 0);

  if (selectedId) {
    return <AccountingJobDetailView jobId={selectedId} onBack={() => setSelectedId(null)} onChanged={() => load(jobTypeFilter, billingFilter)} />;
  }

  return (
    <div className="main">
      <h1 style={{ marginBottom: 16 }}>Cost roll-up</h1>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-title">Shop labor rate</div>
        <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 12 }}>
          Placeholder until IMPEX gives a real figure — applies to every technician's logged hours, shop-wide.
        </p>
        <div className="button-row" style={{ alignItems: "center" }}>
          <span>$</span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={rateInput}
            onChange={(e) => setRateInput(e.target.value)}
            style={{ width: 100, padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)" }}
          />
          <span>/ hour</span>
          <button className="big-button ghost" disabled={savingRate || Number(rateInput) === laborRate} onClick={saveRate}>
            Save rate
          </button>
        </div>
      </div>

      <div className="floor-tabs">
        {JOB_TYPES.map((t) => (
          <button key={t} className={`floor-tab ${jobTypeFilter === t ? "active" : ""}`} onClick={() => setJobTypeFilter(t)}>
            {t ? JOB_TYPE_LABELS[t] : "All types"}
          </button>
        ))}
      </div>
      <div className="floor-tabs">
        {[
          { v: "", l: "All billing" },
          { v: "open", l: "Billing open" },
          { v: "closed", l: "Billing closed" },
        ].map((o) => (
          <button key={o.v} className={`floor-tab ${billingFilter === o.v ? "active" : ""}`} onClick={() => setBillingFilter(o.v)}>
            {o.l}
          </button>
        ))}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <strong>{jobs.length}</strong> job{jobs.length === 1 ? "" : "s"} · total cost <strong>${totalCost.toFixed(2)}</strong>
      </div>

      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">No jobs match this filter.</div>
      ) : (
        <div className="grid">
          {jobs.map((j) => (
            <div key={j.id} className={`job-card status-${j.status}`} style={{ cursor: "pointer" }} onClick={() => setSelectedId(j.id)}>
              <div className="job-card-header">
                <div>
                  <div className="job-number">{j.jobNumber}</div>
                  <div className="job-plate">{j.plate}</div>
                </div>
                <StatusBadge status={j.status} />
              </div>
              <div style={{ color: "var(--text-dim)", fontSize: 14 }}>
                {j.customerName} · {JOB_TYPE_LABELS[j.jobType]} · {j.billingClosedAt ? "billing closed" : "billing open"}
              </div>
              <div className="button-row">
                <span className="badge QUEUED">labor ${j.cost.laborCost.toFixed(2)} ({j.cost.laborHours}h)</span>
                <span className="badge QUEUED">
                  parts ${j.cost.partsCost.toFixed(2)}
                  {!j.cost.partsCostKnown ? " (partial — some unpriced)" : ""}
                </span>
                <span className="badge DONE">total ${j.cost.totalCost.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AccountingJobDetailView({ jobId, onBack, onChanged }: { jobId: string; onBack: () => void; onChanged: () => void }) {
  const [job, setJob] = useState<AccountingJobDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.accountingJob(jobId);
      setJob(data.job);
    } catch (e: any) {
      setError(e.message);
    }
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  async function closeBilling() {
    setBusy(true);
    setError(null);
    try {
      await api.closeBilling(jobId);
      await load();
      onChanged();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!job) return <div className="main">{error ? <div className="error-banner">{error}</div> : <div className="empty-state">Loading…</div>}</div>;

  return (
    <div className="main">
      <button className="big-button ghost" style={{ marginBottom: 16 }} onClick={onBack}>
        ← Back to cost roll-up
      </button>
      <div className="card">
        <div className="job-card-header">
          <div>
            <div className="job-number">{job.jobNumber}</div>
            <div className="job-plate">{job.plate}</div>
          </div>
          <StatusBadge status={job.status} />
        </div>
        <div style={{ margin: "12px 0", color: "var(--text-dim)" }}>
          {job.customerName} · {JOB_TYPE_LABELS[job.jobType]} · created by {job.createdBy.displayName}
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="section-title">Labor</div>
        <div className="timeline" style={{ marginBottom: 16 }}>
          {job.floorTaskLogs.map((log) => (
            <div key={log.id} className="timeline-item">
              <div className="timeline-floor">Floor {log.floor}</div>
              <div>
                {log.technicians.length === 0 ? (
                  <div className="timeline-meta">No hours logged</div>
                ) : (
                  log.technicians.map((t, i) => (
                    <div key={i} className="timeline-meta">
                      {t.user.displayName}: {t.hoursLogged || 0}h
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="section-title">Parts</div>
        <div className="timeline" style={{ marginBottom: 16 }}>
          {job.partsRequisitions.length === 0 ? (
            <p style={{ color: "var(--text-dim)", fontSize: 14 }}>No parts requested.</p>
          ) : (
            job.partsRequisitions.map((p) => (
              <div key={p.id} className="timeline-item">
                <div className="timeline-floor">{p.quantity}×</div>
                <div>
                  <div>{p.partDescription}</div>
                  <div className="timeline-meta">
                    {p.unitCostUsd ? `$${p.unitCostUsd} each` : "cost not entered yet"} · {p.status}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="button-row" style={{ marginBottom: 16 }}>
          <span className="badge QUEUED">labor ${job.cost.laborCost.toFixed(2)} ({job.cost.laborHours}h)</span>
          <span className="badge QUEUED">parts ${job.cost.partsCost.toFixed(2)}</span>
          <span className="badge DONE">total ${job.cost.totalCost.toFixed(2)}</span>
        </div>

        {job.billingClosedAt ? (
          <div className="blocker-banner" style={{ borderColor: "var(--green)", color: "var(--green)" }}>
            Billing closed {new Date(job.billingClosedAt).toLocaleString()}
          </div>
        ) : (job.status === "DONE" || job.status === "CLOSED") ? (
          <button className="big-button green" disabled={busy} onClick={closeBilling}>
            Close out billing
          </button>
        ) : (
          <p style={{ color: "var(--text-dim)", fontSize: 14 }}>Billing can be closed once the job finishes all floors.</p>
        )}
      </div>
    </div>
  );
}
