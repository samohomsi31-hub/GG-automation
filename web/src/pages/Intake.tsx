import { FormEvent, useState } from "react";
import { api } from "../api";
import { Job } from "../types";

const CATEGORIES = ["Quick mechanic", "Hard mechanic", "Paint", "Body / exterior", "Other"];
const JOB_TYPES = [
  { value: "PAID", label: "Paid" },
  { value: "WARRANTY", label: "Warranty" },
  { value: "INSURANCE", label: "Insurance" },
];
const FLOORS = [
  { value: 1, label: "Floor 1 — Quick mechanic" },
  { value: 2, label: "Floor 2 — Hard mechanic" },
  { value: 3, label: "Floor 3 — Paint" },
  { value: 4, label: "Floor 4 — Body" },
];

export default function Intake() {
  const [plate, setPlate] = useState("");
  const [vin, setVin] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [intakeComplaint, setIntakeComplaint] = useState("");
  const [intakeCategory, setIntakeCategory] = useState(CATEGORIES[0]);
  const [jobType, setJobType] = useState("PAID");
  const [initialFloor, setInitialFloor] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Job | null>(null);

  function reset() {
    setPlate("");
    setVin("");
    setCustomerName("");
    setCustomerPhone("");
    setIntakeComplaint("");
    setIntakeCategory(CATEGORIES[0]);
    setJobType("PAID");
    setInitialFloor(1);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const job = await api.createJob({
        plate,
        vin: vin || undefined,
        customerName,
        customerPhone: customerPhone || undefined,
        intakeComplaint,
        intakeCategory,
        jobType,
        initialFloor,
      });
      setCreated(job);
      reset();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <div className="main">
        <div className="card" style={{ borderColor: "var(--green)" }}>
          <div className="section-title" style={{ color: "var(--green)" }}>
            Job card created
          </div>
          <h2 style={{ margin: "6px 0" }}>{created.jobNumber}</h2>
          <p>
            {created.plate} — {created.customerName} — routed to Floor {created.currentFloor}
          </p>
          <div className="button-row" style={{ marginTop: 16 }}>
            <button className="big-button" onClick={() => setCreated(null)}>
              New intake
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main">
      <h1 style={{ marginBottom: 20 }}>New job intake</h1>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={submit} className="card">
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="field">
            <label>Plate number *</label>
            <input value={plate} onChange={(e) => setPlate(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label>VIN (optional)</label>
            <input value={vin} onChange={(e) => setVin(e.target.value)} />
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="field">
            <label>Customer name *</label>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
          </div>
          <div className="field">
            <label>Customer phone</label>
            <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label>Complaint (from customer) *</label>
          <textarea value={intakeComplaint} onChange={(e) => setIntakeComplaint(e.target.value)} required />
        </div>

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="field">
            <label>Category *</label>
            <select value={intakeCategory} onChange={(e) => setIntakeCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Job type *</label>
            <select value={jobType} onChange={(e) => setJobType(e.target.value)}>
              {JOB_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label>Route to floor *</label>
          <select value={initialFloor} onChange={(e) => setInitialFloor(Number(e.target.value))}>
            {FLOORS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div className="button-row">
          <button className="big-button green" type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create job card"}
          </button>
        </div>
      </form>
    </div>
  );
}
