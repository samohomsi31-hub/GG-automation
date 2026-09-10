import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { ManagementDashboard as Dashboard } from "../types";
import { BLOCKER_REASON_LABELS, FLOOR_LABELS } from "../labels";

const STATUS_LABELS: Record<string, string> = {
  QUEUED: "Queued",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  DONE: "Done",
  CLOSED: "Closed",
};

export default function ManagementDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.managementDashboard());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="main empty-state">Loading…</div>;
  if (error) return <div className="main"><div className="error-banner">{error}</div></div>;
  if (!data) return null;

  return (
    <div className="main">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <h1>Management dashboard</h1>
        <button className="big-button ghost" onClick={load}>
          Refresh
        </button>
      </div>
      <p style={{ color: "var(--text-dim)", marginBottom: 20, fontSize: 13 }}>
        As of {new Date(data.generatedAt).toLocaleString()}
      </p>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginBottom: 24 }}>
        <Stat label="Jobs today" value={String(data.jobsToday)} />
        <Stat label="Jobs last 7 days" value={String(data.jobsLast7d)} />
        <Stat label="Cost last 7 days" value={`$${data.costLast7dUsd.toFixed(2)}`} />
        <Stat label="Cost last 30 days" value={`$${data.costLast30dUsd.toFixed(2)}`} />
        <Stat label="Labor rate" value={`$${data.laborRatePerHourUsd}/hr`} />
      </div>

      <div className="section-title">Jobs by status</div>
      <div className="button-row" style={{ marginBottom: 24 }}>
        {data.jobsByStatus.length === 0 ? (
          <span style={{ color: "var(--text-dim)" }}>No jobs yet.</span>
        ) : (
          data.jobsByStatus.map((s) => (
            <span key={s.status} className={`badge ${s.status}`}>
              {STATUS_LABELS[s.status] || s.status}: {s.count}
            </span>
          ))
        )}
      </div>

      <div className="section-title">Cars currently on each floor</div>
      <div className="button-row" style={{ marginBottom: 24 }}>
        {[1, 2, 3, 4].map((floor) => {
          const entry = data.jobsByFloor.find((f) => f.floor === floor);
          return (
            <span key={floor} className="badge IN_PROGRESS">
              {FLOOR_LABELS[floor].split(" — ")[0]}: {entry?.count ?? 0}
            </span>
          );
        })}
      </div>

      <div className="section-title">Average time per floor (completed visits)</div>
      <div className="button-row" style={{ marginBottom: 24 }}>
        {data.avgHoursPerFloor.map((f) => (
          <span key={f.floor} className="badge QUEUED">
            {FLOOR_LABELS[f.floor].split(" — ")[0]}: {f.avgHours === null ? "no data yet" : `${f.avgHours}h avg (${f.completedVisits} visits)`}
          </span>
        ))}
      </div>

      <div className="section-title">Blockers happening right now</div>
      <div className="button-row" style={{ marginBottom: 24 }}>
        {data.liveBlockersByReason.length === 0 ? (
          <span style={{ color: "var(--text-dim)" }}>Nothing currently blocked.</span>
        ) : (
          data.liveBlockersByReason.map((b) => (
            <span key={b.reason} className="badge BLOCKED">
              {BLOCKER_REASON_LABELS[b.reason || "OTHER"]}: {b.count}
            </span>
          ))
        )}
      </div>

      <div className="section-title">Blocker frequency (all-time — spot recurring problems)</div>
      <div className="button-row">
        {data.historicalBlockersByReason.length === 0 ? (
          <span style={{ color: "var(--text-dim)" }}>No blockers recorded yet.</span>
        ) : (
          data.historicalBlockersByReason.map((b) => (
            <span key={b.reason} className="badge BLOCKED">
              {BLOCKER_REASON_LABELS[b.reason || "OTHER"] || b.reason}: {b.count}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800 }}>{value}</div>
    </div>
  );
}
