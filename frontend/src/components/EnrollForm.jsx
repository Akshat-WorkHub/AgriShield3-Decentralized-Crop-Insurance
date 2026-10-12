import { useState } from "react";
import { api } from "../api";
import Certificate from "./Certificate";

const CROPS = ["Wheat", "Rice", "Cotton", "Maize", "Sugarcane", "Groundnut"];

const DEFAULTS = {
  farmer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  cropType: "Wheat",
  latitude: 12.345,
  longitude: 77.62,
  coverageDays: 120,
  premiumEth: 0.01,
  sumInsuredEth: 1,
  rainfallDeficitPct: 40,
  tempAnomalyC: 5,
  dryDayContinuity: 10,
};

export default function EnrollForm({ onEnrolled }) {
  const [form, setForm] = useState(DEFAULTS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [policy, setPolicy] = useState(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.registerPolicy(form);
      setPolicy(created);
      onEnrolled?.(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="panel">
        <div className="panel-title">Plot &amp; coverage details</div>
        <div className="panel-hint">
          One transaction writes location, crop type, coverage window and payout thresholds directly into
          PolicyRegistry — terms are immutable from this point on.
        </div>

        {error && <div className="banner error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field span-2">
              <label>Wallet address</label>
              <input value={form.farmer} onChange={(e) => update("farmer", e.target.value)} required />
            </div>

            <div className="field">
              <label>Crop type</label>
              <select value={form.cropType} onChange={(e) => update("cropType", e.target.value)}>
                {CROPS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Coverage window (days)</label>
              <input
                type="number"
                min="1"
                value={form.coverageDays}
                onChange={(e) => update("coverageDays", e.target.value)}
              />
            </div>

            <div className="field">
              <label>Plot latitude</label>
              <input
                type="number"
                step="0.0001"
                value={form.latitude}
                onChange={(e) => update("latitude", e.target.value)}
              />
            </div>

            <div className="field">
              <label>Plot longitude</label>
              <input
                type="number"
                step="0.0001"
                value={form.longitude}
                onChange={(e) => update("longitude", e.target.value)}
              />
            </div>

            <div className="field">
              <label>Premium (native token)</label>
              <input
                type="number"
                step="0.001"
                value={form.premiumEth}
                onChange={(e) => update("premiumEth", e.target.value)}
              />
            </div>

            <div className="field">
              <label>Sum insured (native token)</label>
              <input
                type="number"
                step="0.01"
                value={form.sumInsuredEth}
                onChange={(e) => update("sumInsuredEth", e.target.value)}
              />
            </div>

            <div className="field">
              <label>Rainfall deficit trigger (%)</label>
              <input
                type="number"
                value={form.rainfallDeficitPct}
                onChange={(e) => update("rainfallDeficitPct", e.target.value)}
              />
              <span className="field-note">Payout considered once rainfall falls this far below baseline.</span>
            </div>

            <div className="field">
              <label>Heat anomaly trigger (°C above baseline)</label>
              <input
                type="number"
                value={form.tempAnomalyC}
                onChange={(e) => update("tempAnomalyC", e.target.value)}
              />
            </div>

            <div className="field">
              <label>Consecutive dry days trigger</label>
              <input
                type="number"
                value={form.dryDayContinuity}
                onChange={(e) => update("dryDayContinuity", e.target.value)}
              />
              <span className="field-note">Compound index: pays out on drought OR heat-accelerated signature.</span>
            </div>
          </div>

          <div className="btn-row">
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? "Writing policy on-chain…" : "Register policy"}
            </button>
          </div>
        </form>
      </div>

      {policy && (
        <div className="panel">
          <div className="panel-title">Policy registered</div>
          <div className="panel-hint">Proof of coverage — share this certificate ID or view it anytime under My Policies.</div>
          <Certificate policy={policy} />
        </div>
      )}
    </>
  );
}
