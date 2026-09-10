import { Job, PartsRequisition, SessionUser } from "./types";

// Empty by default: local dev goes through Vite's dev-server proxy
// (vite.config.ts) so a relative /api path is enough. In production the
// frontend and API are separate services with different origins, so this
// is baked in at build time to the API's absolute URL — see render.yaml.
const API_BASE = import.meta.env.VITE_API_URL || "";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.error?.formErrors?.join(", ") || JSON.stringify(body.error) || message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  devUsers: () => request<SessionUser[]>("/auth/dev-users"),
  devLogin: (userId: string) => request<{ ok: true }>("/auth/dev-login", { method: "POST", body: JSON.stringify({ userId }) }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  me: () => request<SessionUser>("/auth/me"),

  createJob: (data: {
    plate: string;
    vin?: string;
    customerName: string;
    customerPhone?: string;
    intakeComplaint: string;
    intakeCategory: string;
    jobType: string;
    initialFloor: number;
  }) => request<Job>("/jobs", { method: "POST", body: JSON.stringify(data) }),

  listJobs: (params: { q?: string; status?: string; floor?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.status) qs.set("status", params.status);
    if (params.floor) qs.set("floor", String(params.floor));
    return request<Job[]>(`/jobs?${qs.toString()}`);
  },

  getJob: (id: string) => request<Job>(`/jobs/${id}`),

  floorQueue: (floor: number) => request<Job[]>(`/floors/${floor}/queue`),

  startJob: (id: string) => request<Job>(`/jobs/${id}/start`, { method: "POST" }),
  routeJob: (id: string, nextFloor: number | null) =>
    request<Job>(`/jobs/${id}/route`, { method: "POST", body: JSON.stringify({ nextFloor }) }),
  flagBlocker: (id: string, reasonCode: string, note?: string) =>
    request<Job>(`/jobs/${id}/blocker`, { method: "POST", body: JSON.stringify({ reasonCode, note }) }),
  clearBlocker: (id: string) => request<Job>(`/jobs/${id}/blocker/clear`, { method: "POST" }),
  setQc: (id: string, status: string) => request<Job>(`/jobs/${id}/qc`, { method: "POST", body: JSON.stringify({ status }) }),
  setAfterSales: (id: string, status: string) =>
    request<Job>(`/jobs/${id}/after-sales`, { method: "POST", body: JSON.stringify({ status }) }),
  closeJob: (id: string) => request<Job>(`/jobs/${id}/close`, { method: "POST" }),
  assignTechnician: (id: string, userId: string, hoursLogged: number | null) =>
    request<Job>(`/jobs/${id}/floor-log/technicians`, { method: "POST", body: JSON.stringify({ userId, hoursLogged }) }),
  setFloorNotes: (id: string, notes: string) =>
    request<Job>(`/jobs/${id}/floor-log/notes`, { method: "PATCH", body: JSON.stringify({ notes }) }),

  createPartsRequisition: (jobId: string, partDescription: string, quantity: number) =>
    request<PartsRequisition>("/parts-requisitions", { method: "POST", body: JSON.stringify({ jobId, partDescription, quantity }) }),
  listPartsRequisitions: (status?: string) =>
    request<PartsRequisition[]>(`/parts-requisitions${status ? `?status=${status}` : ""}`),
  updatePartsRequisition: (id: string, status: string) =>
    request<PartsRequisition>(`/parts-requisitions/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
};
