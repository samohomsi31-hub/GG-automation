import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { PartsQueueItem } from "../types";
import StatusBadge from "../components/StatusBadge";

const STATUSES: PartsQueueItem["status"][] = ["REQUESTED", "CONFIRMED_IN_STOCK", "BACKORDERED", "FULFILLED"];
const STATUS_LABELS: Record<string, string> = {
  REQUESTED: "Requested",
  CONFIRMED_IN_STOCK: "Confirmed in stock",
  BACKORDERED: "Backordered",
  FULFILLED: "Fulfilled",
};

export default function PartsQueue() {
  const [items, setItems] = useState<PartsQueueItem[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (status: string) => {
    setLoading(true);
    setError(null);
    try {
      setItems(await api.listPartsQueue(status || undefined));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filter);
  }, [filter, load]);

  return (
    <div className="main">
      <h1 style={{ marginBottom: 16 }}>Parts requisition queue</h1>
      <div className="floor-tabs">
        <button className={`floor-tab ${filter === "" ? "active" : ""}`} onClick={() => setFilter("")}>
          All
        </button>
        {STATUSES.map((s) => (
          <button key={s} className={`floor-tab ${filter === s ? "active" : ""}`} onClick={() => setFilter(s)}>
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>
      {error && <div className="error-banner">{error}</div>}
      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : items.length === 0 ? (
        <div className="empty-state">No requisitions{filter ? ` with status "${STATUS_LABELS[filter]}"` : ""}.</div>
      ) : (
        <div className="grid">
          {items.map((item) => (
            <PartsRow key={item.id} item={item} onChanged={() => load(filter)} />
          ))}
        </div>
      )}
    </div>
  );
}

function PartsRow({ item, onChanged }: { item: PartsQueueItem; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cost, setCost] = useState(item.unitCostUsd || "");

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
    <div className="job-card">
      <div className="job-card-header">
        <div>
          <div className="job-number">
            {item.job.jobNumber} · Floor {item.floorRequested}
          </div>
          <div className="job-plate" style={{ fontSize: 18 }}>
            {item.partDescription}
          </div>
        </div>
        <StatusBadge status={item.status} />
      </div>
      <div style={{ color: "var(--text-dim)", fontSize: 14 }}>
        {item.job.plate} · {item.job.customerName} · qty {item.quantity} · requested by {item.requestedBy.displayName}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="button-row" style={{ alignItems: "center" }}>
        <input
          type="number"
          min={0}
          step={0.01}
          placeholder="Unit cost $"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          style={{ width: 120, padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)" }}
        />
        <button
          className="big-button ghost"
          disabled={busy || cost === ""}
          onClick={() => run(() => api.setPartsCost(item.id, cost === "" ? null : Number(cost)))}
        >
          Save cost
        </button>
      </div>

      <div className="button-row">
        {STATUSES.filter((s) => s !== item.status).map((s) => (
          <button key={s} className="big-button ghost" disabled={busy} onClick={() => run(() => api.updatePartsStatus(item.id, s))}>
            Mark {STATUS_LABELS[s]}
          </button>
        ))}
      </div>
    </div>
  );
}
