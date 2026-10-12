import { useEffect, useState } from "react";
import { api } from "../api";
import StatusTag from "./StatusTag";
import Certificate from "./Certificate";

export default function PolicyList({ onInspectInOracle, farmer }) {
  const [farmerFilter, setFarmerFilter] = useState(farmer || "");
  const [policies, setPolicies] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listPolicies(farmerFilter.trim() || undefined);
      setPolicies(data);
      if (data.length && !data.find((p) => p.id === selectedId)) {
        setSelectedId(data[0].id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = policies.find((p) => p.id === selectedId);

  return (
    <>
      <div className="panel">
        <div className="panel-title">Field ledger</div>
        <div className="panel-hint">Every registered policy, its coverage window and current settlement status.</div>

        <div className="btn-row" style={{ marginTop: 0, marginBottom: 16 }}>
          <input
            style={{
              border: "1px solid var(--border-strong)",
              borderRadius: 3,
              padding: "8px 10px",
              flex: 1,
              minWidth: 220,
            }}
            placeholder="Farmer wallet address"
            value={farmerFilter}
            onChange={(e) => setFarmerFilter(e.target.value)}
          />
          <button className="btn btn-secondary" onClick={load}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {error && <div className="banner error">{error}</div>}

        <div className="ledger">
          {policies.length === 0 && !loading && (
            <div className="empty-state">No policies yet — choose a product from Browse Policies and enroll a plot.</div>
          )}
          {policies.map((p) => (
            <div
              key={p.id}
              className={`ledger-row ${selectedId === p.id ? "selected" : ""}`}
              onClick={() => setSelectedId(p.id)}
            >
              <div className={`status-strip ${p.status}`} />
              <div className="ledger-meta">#{String(p.id).padStart(4, "0")}</div>
              <div>
                <div className="ledger-crop">{p.cropType}</div>
                <div className="ledger-cert">{p.certificateId}</div>
              </div>
              <div className="ledger-meta">
                {Number(p.latitude).toFixed(2)}, {Number(p.longitude).toFixed(2)}
              </div>
              <div className="ledger-meta">{p.sumInsured} token insured</div>
              <StatusTag status={p.status} />
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div className="panel">
          <div className="panel-title">Certificate — #{String(selected.id).padStart(4, "0")}</div>
          <Certificate policy={selected} />
          <div className="btn-row">
            <button className="btn btn-amber" onClick={() => onInspectInOracle(selected.id)}>
              View oracle status
            </button>
          </div>
        </div>
      )}
    </>
  );
}
