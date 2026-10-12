import { useState } from "react";
import { api } from "../api";
import Certificate from "./Certificate";

const DEFAULT_FARMER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

export default function EnrollProduct({ product, onDone, onBack }) {
  const [farmer, setFarmer] = useState(DEFAULT_FARMER);
  const [latitude, setLatitude] = useState(12.345);
  const [longitude, setLongitude] = useState(77.62);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [policy, setPolicy] = useState(null);

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      const p = await api.enrollProduct({ productId: product.id, farmer, latitude: Number(latitude), longitude: Number(longitude) });
      setPolicy(p); onDone?.(p);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  if (!product) return <div className="panel"><div className="empty-state">Select an insurance product first.</div></div>;

  return <>
    <div className="panel">
      <button className="btn btn-secondary" type="button" onClick={onBack}>← Back to policies</button>
      <div className="product-summary">
        <div><span>Insurance company</span><strong>{product.companyName}</strong></div>
        <div><span>Product</span><strong>{product.productName}</strong></div>
        <div><span>Crop</span><strong>{product.cropType}</strong></div>
        <div><span>Premium</span><strong>{Number(product.premium).toFixed(3)} ETH</strong></div>
        <div><span>Sum insured</span><strong>{Number(product.sumInsured).toFixed(3)} ETH</strong></div>
        <div><span>Coverage</span><strong>{product.coverageDays} days</strong></div>
      </div>
      <div className="panel-title">Your plot details</div>
      <div className="panel-hint">The insurance company has already defined the premium, coverage and climate triggers. You only provide your plot and farmer details.</div>
      {error && <div className="banner error">{error}</div>}
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field span-2"><label>Farmer wallet address</label><input value={farmer} onChange={e => setFarmer(e.target.value)} required /></div>
          <div className="field"><label>Plot latitude</label><input type="number" step="0.0001" value={latitude} onChange={e => setLatitude(e.target.value)} required /></div>
          <div className="field"><label>Plot longitude</label><input type="number" step="0.0001" value={longitude} onChange={e => setLongitude(e.target.value)} required /></div>
        </div>
        <div className="policy-readonly-terms">
          <div><span>Rainfall trigger</span><strong>{product.rainfallDeficitBps / 100}% deficit</strong></div>
          <div><span>Heat trigger</span><strong>+{product.tempAnomalyTenthsC / 10}°C</strong></div>
          <div><span>Dry-day trigger</span><strong>{product.dryDayContinuity} days</strong></div>
        </div>
        <div className="btn-row"><button className="btn btn-primary" disabled={busy}>{busy ? "Enrolling on-chain…" : "Accept terms & enroll plot"}</button></div>
      </form>
    </div>
    {policy && <div className="panel"><div className="panel-title">Coverage confirmed</div><div className="panel-hint">The farmer is now enrolled in the selected company product.</div><Certificate policy={policy} /></div>}
  </>;
}
