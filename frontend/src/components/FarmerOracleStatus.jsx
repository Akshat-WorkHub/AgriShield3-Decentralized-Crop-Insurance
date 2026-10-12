import { useEffect, useState } from "react";
import { api } from "../api";
export default function FarmerOracleStatus({ policyId, setPolicyId }) {
  const [policy,setPolicy]=useState(null), [monitor,setMonitor]=useState(null), [error,setError]=useState(null);
  useEffect(()=>{api.monitorStatus().then(setMonitor).catch(()=>{}); if(policyId) api.getPolicy(policyId).then(setPolicy).catch(e=>setError(e.message));},[policyId]);
  return <div className="panel"><div className="panel-title">Oracle status for your policy</div><div className="panel-hint">Farmers can view monitoring status and policy thresholds here. Oracle controls remain with the protocol operator.</div>
    <div className="form-grid"><div className="field"><label>Policy ID</label><input type="number" min="1" value={policyId||""} onChange={e=>setPolicyId(e.target.value?Number(e.target.value):null)} placeholder="e.g. 1"/></div><div className="field"><label>Monitoring</label><input disabled value={monitor?.running?"ACTIVE":"Not currently active"}/></div></div>
    {error&&<div className="banner error">{error}</div>}
    {policy&&<div className="policy-status-card"><div><span>Company</span><strong>{policy.companyName||"—"}</strong></div><div><span>Product</span><strong>{policy.productName}</strong></div><div><span>Last system check</span><strong>{monitor?.lastCycleAt?new Date(monitor.lastCycleAt).toLocaleString():"—"}</strong></div><div><span>Trigger thresholds</span><strong>{policy.rainfallDeficitBps/100}% rainfall · +{policy.tempAnomalyTenthsC/10}°C · {policy.dryDayContinuity} dry days</strong></div></div>}
  </div>;
}
