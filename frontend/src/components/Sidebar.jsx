const FARMER_NAV = [
  { key: "browse", index: "01", label: "Browse Policies" },
  { key: "enroll", index: "02", label: "Enroll a Plot" },
  { key: "ledger", index: "03", label: "My Policies" },
  { key: "oracle", index: "04", label: "Oracle Status" },
];

const OPERATOR_NAV = [
  { key: "overview", index: "01", label: "Overview" },
  { key: "products", index: "02", label: "Policy Products" },
  { key: "oracle", index: "03", label: "Oracle Monitoring" },
  { key: "reserve", index: "04", label: "Reserve Pool" },
];

export default function Sidebar({ page, onNavigate, demoMode, role, onRoleChange }) {
  const items = role === "farmer" ? FARMER_NAV : OPERATOR_NAV;
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">A3</div>
        <div>
          <div className="brand-name">AgriShield3</div>
          <div className="brand-sub">Parametric crop cover</div>
        </div>
      </div>

      <div className="role-switcher">
        <div className="role-caption">CURRENT PORTAL</div>
        <button className={role === "farmer" ? "role-btn active" : "role-btn"} onClick={() => onRoleChange("farmer")}>👨‍🌾 Farmer</button>
        <button className={role === "operator" ? "role-btn active" : "role-btn"} onClick={() => onRoleChange("operator")}>🏢 Operator</button>
      </div>

      <ul className="nav-list">
        {items.map((item) => (
          <li key={item.key} className={`nav-item ${page === item.key ? "active" : ""}`} onClick={() => onNavigate(item.key)}>
            <span className="nav-index">{item.index}</span>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>

      <div className="sidebar-footer">
        <div className="mode-pill"><span className="mode-dot" />{demoMode === null ? "checking backend…" : demoMode ? "Demo mode — simulated chain" : "Live mode — on-chain"}</div>
        <div style={{ marginTop: 8 }}>{role === "farmer" ? "Farmer portal" : "Insurance operator portal"}</div>
        <div>Review-1 build · EVM-compatible</div>
      </div>
    </aside>
  );
}
