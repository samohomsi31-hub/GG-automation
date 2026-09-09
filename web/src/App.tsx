import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./AuthContext";
import Login from "./pages/Login";
import Intake from "./pages/Intake";
import FloorView from "./pages/FloorView";
import StatusView from "./pages/StatusView";

const ROLE_LABELS: Record<string, string> = {
  SERVICE_ADVISOR: "Service Advisor",
  FLOOR_TECH: "Floor Technician / Lead",
  PARTS_OFFICE: "Parts Office",
  AFTER_SALES: "After-Sales",
  ACCOUNTING: "Accounting",
  SENIOR_MANAGEMENT: "Senior Management",
  IT_ADMIN: "IT / Admin",
};

export default function App() {
  const { user, loading, logout } = useAuth();

  if (loading) return <div className="empty-state">Loading…</div>;
  if (!user) return <Login />;

  const canIntake = user.role === "SERVICE_ADVISOR" || user.role === "IT_ADMIN";
  const canFloorView = user.role === "FLOOR_TECH" || user.role === "SERVICE_ADVISOR" || user.role === "IT_ADMIN";

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="topbar-brand">
          IMPEX <span>Job Card</span>
        </div>
        <div className="nav">
          {canIntake && (
            <NavLink to="/intake" className={({ isActive }) => (isActive ? "active" : "")}>
              Intake
            </NavLink>
          )}
          {canFloorView && (
            <NavLink to="/floor" className={({ isActive }) => (isActive ? "active" : "")}>
              Floor view
            </NavLink>
          )}
          <NavLink to="/status" className={({ isActive }) => (isActive ? "active" : "")}>
            Status
          </NavLink>
        </div>
        <div className="user-badge">
          <span>
            <strong>{user.displayName}</strong> · {ROLE_LABELS[user.role]}
          </span>
          <button className="nav-logout" onClick={() => logout()} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", textDecoration: "underline" }}>
            Sign out
          </button>
        </div>
      </div>

      <Routes>
        <Route path="/" element={<Navigate to={canFloorView ? "/floor" : "/status"} replace />} />
        {canIntake && <Route path="/intake" element={<Intake />} />}
        {canFloorView && <Route path="/floor" element={<FloorView />} />}
        <Route path="/status" element={<StatusView />} />
        <Route path="*" element={<Navigate to="/status" replace />} />
      </Routes>
    </div>
  );
}
