import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./AuthContext";
import Login from "./pages/Login";
import Intake from "./pages/Intake";
import FloorView from "./pages/FloorView";
import StatusView from "./pages/StatusView";
import PartsQueue from "./pages/PartsQueue";
import AfterSales from "./pages/AfterSales";
import Accounting from "./pages/Accounting";
import ManagementDashboard from "./pages/ManagementDashboard";

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

  const isAdmin = user.role === "IT_ADMIN";
  const canIntake = user.role === "SERVICE_ADVISOR" || isAdmin;
  const canFloorView = user.role === "FLOOR_TECH" || user.role === "SERVICE_ADVISOR" || isAdmin;
  const canParts = user.role === "PARTS_OFFICE" || user.role === "ACCOUNTING" || user.role === "SENIOR_MANAGEMENT" || isAdmin;
  const canAfterSales = user.role === "AFTER_SALES" || user.role === "SERVICE_ADVISOR" || isAdmin;
  const canAccounting = user.role === "ACCOUNTING" || isAdmin;
  const canDashboard = user.role === "SENIOR_MANAGEMENT" || user.role === "ACCOUNTING" || isAdmin;

  // Each role's own primary screen — not just "first capability that's
  // true", since e.g. Accounting can also see the Parts queue but that's
  // not their home.
  const ROLE_HOME: Record<string, string> = {
    SERVICE_ADVISOR: "/floor",
    FLOOR_TECH: "/floor",
    PARTS_OFFICE: "/parts",
    AFTER_SALES: "/after-sales",
    ACCOUNTING: "/accounting",
    SENIOR_MANAGEMENT: "/dashboard",
    IT_ADMIN: "/floor",
  };
  const homePath = ROLE_HOME[user.role] || "/status";

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
          {canParts && (
            <NavLink to="/parts" className={({ isActive }) => (isActive ? "active" : "")}>
              Parts
            </NavLink>
          )}
          {canAfterSales && (
            <NavLink to="/after-sales" className={({ isActive }) => (isActive ? "active" : "")}>
              After-Sales
            </NavLink>
          )}
          {canAccounting && (
            <NavLink to="/accounting" className={({ isActive }) => (isActive ? "active" : "")}>
              Accounting
            </NavLink>
          )}
          {canDashboard && (
            <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "active" : "")}>
              Dashboard
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
        <Route path="/" element={<Navigate to={homePath} replace />} />
        {canIntake && <Route path="/intake" element={<Intake />} />}
        {canFloorView && <Route path="/floor" element={<FloorView />} />}
        {canParts && <Route path="/parts" element={<PartsQueue />} />}
        {canAfterSales && <Route path="/after-sales" element={<AfterSales />} />}
        {canAccounting && <Route path="/accounting" element={<Accounting />} />}
        {canDashboard && <Route path="/dashboard" element={<ManagementDashboard />} />}
        <Route path="/status" element={<StatusView />} />
        <Route path="*" element={<Navigate to="/status" replace />} />
      </Routes>
    </div>
  );
}
