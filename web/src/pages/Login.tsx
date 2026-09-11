import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { SessionUser } from "../types";

const ROLE_LABELS: Record<string, string> = {
  SERVICE_ADVISOR: "Service Advisor",
  FLOOR_TECH: "Floor Technician / Lead",
  PARTS_OFFICE: "Parts Office",
  AFTER_SALES: "After-Sales",
  ACCOUNTING: "Accounting",
  SENIOR_MANAGEMENT: "Senior Management",
  IT_ADMIN: "IT / Admin",
};

export default function Login() {
  const [users, setUsers] = useState<SessionUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { loginAs } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api
      .devUsers()
      .then(setUsers)
      .catch((e) => setError(e.message));
  }, []);

  async function pick(u: SessionUser) {
    try {
      await loginAs(u.id);
      navigate("/");
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="main">
      <h1 style={{ marginBottom: 4 }}>IMPEX Job Card — dev login</h1>
      <p style={{ color: "var(--text-dim)", marginBottom: 20 }}>
        Local development stand-in for Microsoft Entra ID SSO. Pick a staff member to sign in as.
      </p>
      {error && <div className="error-banner">{error}</div>}
      <div className="login-grid">
        {users.map((u) => (
          <button key={u.id} className="login-card" onClick={() => pick(u)}>
            <div className="role">
              {ROLE_LABELS[u.role] || u.role}
              {u.assignedFloor ? ` · Floor ${u.assignedFloor}` : ""}
            </div>
            <div className="name">{u.displayName}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
