import { useEffect, useState } from "react";
import { api } from "../api";

export default function OperatorOverview({ onNavigate }) {
  const [products, setProducts] = useState([]);
  const [reserve, setReserve] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [monitor, setMonitor] = useState(null);
  useEffect(() => {
    Promise.all([api.listProducts(), api.getReserve(), api.listPolicies()]).then(([p,r,pol]) => { setProducts(p); setReserve(r); setPolicies(pol); }).catch(() => {});
    api.monitorStatus().then(setMonitor).catch(() => {});
  }, []);
  const active = policies.filter(p => p.status === "Active").length;
  const coverage = policies.filter(p => p.status === "Active").reduce((s,p) => s + Number(p.sumInsured || 0), 0);
  return <>
    <div className="panel"><div className="panel-title">Operator overview</div><div className="panel-hint">Operational view for an insurance provider: products offered, policies enrolled, oracle monitoring and reserve capacity.</div>
      <div className="stat-row">
        <div className="stat-box"><div className="label">Active products</div><div className="value">{products.length}</div></div>
        <div className="stat-box"><div className="label">Active policies</div><div className="value">{active}</div></div>
        <div className="stat-box"><div className="label">Committed coverage</div><div className="value">{coverage.toFixed(2)} ETH</div></div>
        <div className="stat-box"><div className="label">Reserve pool</div><div className="value">{reserve ? Number(reserve.totalReserves).toFixed(2) : "—"} ETH</div></div>
      </div>
    </div>
    <div className="panel"><div className="panel-title">System controls</div>
      <div className="operator-cards">
        <button className="operator-card" onClick={() => onNavigate("products")}><strong>Policy products</strong><span>Create and manage insurance products offered to farmers.</span></button>
        <button className="operator-card" onClick={() => onNavigate("oracle")}><strong>Oracle monitoring</strong><span>{monitor?.running ? "Monitoring is active." : "Start or inspect autonomous climate monitoring."}</span></button>
        <button className="operator-card" onClick={() => onNavigate("reserve")}><strong>Reserve pool</strong><span>Review liquidity, collateral and reserve activity.</span></button>
      </div>
    </div>
  </>;
}
