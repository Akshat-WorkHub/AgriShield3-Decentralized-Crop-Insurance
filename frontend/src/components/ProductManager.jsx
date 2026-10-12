import { useEffect, useState } from "react";
import { api } from "../api";

const EMPTY = { companyName: "", productName: "", cropType: "Wheat", coverageDays: 120, premiumEth: 0.01, sumInsuredEth: 1, rainfallDeficitPct: 40, tempAnomalyC: 5, dryDayContinuity: 10 };
export default function ProductManager() {
  const [form, setForm] = useState(EMPTY); const [products, setProducts] = useState([]); const [busy, setBusy] = useState(false); const [error, setError] = useState(null);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const load=()=>api.listProducts().then(setProducts).catch(e=>setError(e.message));
  useEffect(()=>{load();},[]);
  async function create(e){e.preventDefault();setBusy(true);setError(null);try{await api.createProduct(form);setForm(EMPTY);await load();}catch(e){setError(e.message)}finally{setBusy(false)}}
  async function toggle(p){try{await api.setProductActive(p.id,!p.active);await load()}catch(e){setError(e.message)}}
  return <>
    <div className="panel"><div className="panel-title">Create insurance product</div><div className="panel-hint">The operator/insurance company defines the product. Farmers later browse and enroll their plots; they do not edit these terms.</div>{error&&<div className="banner error">{error}</div>}
      <form onSubmit={create}><div className="form-grid">
        <div className="field"><label>Insurance company</label><input value={form.companyName} onChange={e=>set("companyName",e.target.value)} placeholder="e.g. GreenShield Insurance" required/></div>
        <div className="field"><label>Product name</label><input value={form.productName} onChange={e=>set("productName",e.target.value)} placeholder="e.g. Wheat Drought Cover" required/></div>
        <div className="field"><label>Crop</label><select value={form.cropType} onChange={e=>set("cropType",e.target.value)}>{["Wheat","Rice","Cotton","Maize","Sugarcane","Groundnut"].map(c=><option key={c}>{c}</option>)}</select></div>
        <div className="field"><label>Coverage (days)</label><input type="number" min="1" value={form.coverageDays} onChange={e=>set("coverageDays",e.target.value)}/></div>
        <div className="field"><label>Premium (ETH)</label><input type="number" step="0.001" min="0" value={form.premiumEth} onChange={e=>set("premiumEth",e.target.value)}/></div>
        <div className="field"><label>Sum insured (ETH)</label><input type="number" step="0.01" min="0" value={form.sumInsuredEth} onChange={e=>set("sumInsuredEth",e.target.value)}/></div>
        <div className="field"><label>Rainfall deficit trigger (%)</label><input type="number" value={form.rainfallDeficitPct} onChange={e=>set("rainfallDeficitPct",e.target.value)}/></div>
        <div className="field"><label>Heat anomaly trigger (°C)</label><input type="number" step="0.1" value={form.tempAnomalyC} onChange={e=>set("tempAnomalyC",e.target.value)}/></div>
        <div className="field"><label>Consecutive dry days</label><input type="number" min="1" value={form.dryDayContinuity} onChange={e=>set("dryDayContinuity",e.target.value)}/></div>
      </div><div className="btn-row"><button className="btn btn-primary" disabled={busy}>{busy?"Writing product on-chain…":"Publish insurance product"}</button></div></form>
    </div>
    <div className="panel"><div className="panel-title">Published products</div><div className="product-list">
      {products.map(p=><div className="product-list-row" key={p.id}><div><strong>{p.companyName}</strong><span>{p.productName} · {p.cropType}</span></div><div><span>{p.premium} ETH premium</span><span>{p.sumInsured} ETH coverage</span></div><button className="btn btn-secondary" onClick={()=>toggle(p)}>{p.active?"Deactivate":"Activate"}</button></div>)}
    </div></div>
  </>;
}
