import { useEffect, useState } from "react";
import { api } from "../api";

function money(v) { return `${Number(v).toFixed(3)} ETH`; }
function pct(bps) { return `${(Number(bps) / 100).toFixed(0)}%`; }

export default function BrowsePolicies({ onSelect }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true); setError(null);
    try { setProducts(await api.listProducts()); } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="panel">
      <div className="panel-title">Available insurance policies</div>
      <div className="panel-hint">Compare products offered by participating insurance companies. The company defines the terms; you choose whether to enroll your plot.</div>
      {error && <div className="banner error">{error}</div>}
      {loading && <div className="empty-state">Loading available policies…</div>}
      {!loading && !products.length && <div className="empty-state">No active insurance products are available.</div>}
      <div className="product-grid">
        {products.map((p) => (
          <div className="product-card" key={p.id}>
            <div className="product-company">{p.companyName}</div>
            <div className="product-name">{p.productName}</div>
            <div className="product-crop">{p.cropType}</div>
            <div className="product-stats">
              <div><span>Premium</span><strong>{money(p.premium)}</strong></div>
              <div><span>Coverage</span><strong>{money(p.sumInsured)}</strong></div>
              <div><span>Duration</span><strong>{p.coverageDays} days</strong></div>
              <div><span>Rainfall</span><strong>{pct(p.rainfallDeficitBps)} deficit</strong></div>
              <div><span>Heat</span><strong>+{(p.tempAnomalyTenthsC / 10).toFixed(1)}°C</strong></div>
              <div><span>Dry days</span><strong>{p.dryDayContinuity}</strong></div>
            </div>
            <button className="btn btn-primary" onClick={() => onSelect(p)}>Enroll this plot</button>
          </div>
        ))}
      </div>
    </div>
  );
}
