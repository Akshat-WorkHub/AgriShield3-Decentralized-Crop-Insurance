import { useEffect, useMemo, useState } from "react";
import { api } from "../api";

const SCENARIOS = [
  { key: "normal", label: "Normal conditions", description: "Low climate stress" },
  { key: "healthy", label: "Healthy / well-watered", description: "Minimal rainfall and heat stress" },
  { key: "heatwave", label: "Heatwave", description: "High heat with rainfall stress" },
  { key: "drought", label: "Severe drought", description: "High rainfall deficit and prolonged dry period" },
];

function formatPct(bps) {
  return `${(Number(bps) / 100).toFixed(1)}%`;
}

function formatTemp(tenths) {
  const value = Number(tenths) / 10;
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}°C`;
}

function Metric({ label, value, threshold, breached }) {
  return (
    <div className="rule-row">
      <div>
        <div className="rule-name">{label}</div>
        <div className="rule-threshold">Threshold: {threshold}</div>
      </div>
      <div className="rule-result">
        <strong>{value}</strong>
        <span className={`rule-chip ${breached ? "breached" : "clear"}`}>
          {breached ? "BREACHED" : "CLEAR"}
        </span>
      </div>
    </div>
  );
}

export default function OracleConsole({ policyId, setPolicyId }) {
  const [policy, setPolicy] = useState(null);
  const [scenario, setScenario] = useState("normal");
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [monitor, setMonitor] = useState({ enabled: false, running: false, intervalSeconds: 900, lastCycleAt: null, lastError: null });
  const [liveRunning, setLiveRunning] = useState(false);

  useEffect(() => {
    setResult(null);
    setError(null);
    if (!policyId) {
      setPolicy(null);
      return;
    }

    api
      .getPolicy(policyId)
      .then(setPolicy)
      .catch((err) => {
        setPolicy(null);
        setError(err.message);
      });
  }, [policyId]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const status = await api.monitorStatus();
        if (mounted) {
          setMonitor(status);
          setLiveRunning(Boolean(status.running));
        }
      } catch { /* backend may not be reachable yet */ }
    };
    load();
    const timer = setInterval(load, 5000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  async function runLiveEvaluation() {
    if (!policyId) {
      setError("Enter a valid Policy ID first.");
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const res = await api.evaluateLivePolicy(policyId);
      setResult(res);
      setPolicy(res.policy);
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  async function toggleMonitoring() {
    setError(null);
    try {
      const status = liveRunning ? await api.stopMonitoring() : await api.startMonitoring();
      setMonitor(status);
      setLiveRunning(Boolean(status.running));
    } catch (err) {
      setError(err.message);
    }
  }

  async function runAutonomousCycle() {
    setRunning(true);
    setError(null);
    try {
      const res = await api.runMonitoringCycle();
      const current = await api.monitorStatus();
      setMonitor(current);
      const policyResult = res?.results?.find((r) => Number(r.policy?.id) === Number(policyId));
      if (policyResult) {
        setResult(policyResult);
        setPolicy(policyResult.policy);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  async function runEvaluation() {
    if (!policyId) {
      setError("Enter a valid Policy ID first.");
      return;
    }

    setRunning(true);
    setError(null);
    try {
      const res = await api.evaluatePolicy(policyId, scenario);
      setResult(res);
      setPolicy(res.policy);
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  const selectedScenario = useMemo(
    () => SCENARIOS.find((s) => s.key === scenario),
    [scenario]
  );

  const detail = result?.evaluation?.detail;
  const aggregated = result?.aggregated;
  const thresholds = policy
    ? {
        rainfall: policy.rainfallDeficitBps,
        temp: policy.tempAnomalyTenthsC,
        dryDays: policy.dryDayContinuity,
      }
    : null;

  return (
    <>
      <div className="panel">
        <div className="panel-title">Oracle console</div>
        <div className="panel-hint">
          Poll three oracle identities for the selected plot, aggregate their readings by median,
          and evaluate the compound ParametricEngine rules. In demo mode, the node readings are
          deterministic simulations designed to exercise the complete claim workflow.
        </div>

        <div className="form-grid" style={{ marginBottom: 14 }}>
          <div className="field">
            <label>Policy ID</label>
            <input
              type="number"
              min="1"
              value={policyId || ""}
              onChange={(e) => {
                const value = e.target.value;
                setPolicyId(value ? Number(value) : null);
              }}
              placeholder="e.g. 1"
            />
          </div>
          {policy && (
            <div className="field">
              <label>Insured plot</label>
              <input
                disabled
                value={`${policy.cropType} · ${Number(policy.latitude).toFixed(4)}, ${Number(policy.longitude).toFixed(4)}`}
              />
            </div>
          )}
        </div>

        {policy && (
          <div className="policy-thresholds">
            <div className="threshold-title">Policy trigger thresholds</div>
            <div className="threshold-grid">
              <div><span>Rainfall deficit</span><strong>{formatPct(policy.rainfallDeficitBps)}</strong></div>
              <div><span>Temperature anomaly</span><strong>{formatTemp(policy.tempAnomalyTenthsC)}</strong></div>
              <div><span>Dry-day continuity</span><strong>{policy.dryDayContinuity} days</strong></div>
            </div>
          </div>
        )}

        <div className="panel-hint" style={{ marginBottom: 6 }}>Simulate a weather scenario for this plot:</div>
        <div className="scenario-row">
          {SCENARIOS.map((s) => (
            <button
              key={s.key}
              className={`scenario-btn ${scenario === s.key ? "active" : ""}`}
              onClick={() => {
                setScenario(s.key);
                setResult(null);
                setError(null);
              }}
              type="button"
              title={s.description}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="scenario-selected">
          Selected scenario: <strong>{selectedScenario.label}</strong> — {selectedScenario.description}
        </div>

        {error && <div className="banner error">{error}</div>}

        <div className="btn-row" style={{ marginTop: 12, flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={runEvaluation} disabled={!policyId || running}>
            {running ? "Polling nodes & evaluating…" : "Poll oracle & evaluate"}
          </button>
          <button className="btn" onClick={runLiveEvaluation} disabled={!policyId || running}>
            {running ? "Fetching live data…" : "Fetch live APIs & evaluate"}
          </button>
        </div>

        <div className="panel" style={{ marginTop: 16, marginBottom: 0 }}>
          <div className="panel-title">Autonomous live monitoring</div>
          <div className="panel-hint">
            The backend, not the browser, owns the scheduler. When active it periodically fetches
            the configured live oracle sources, aggregates them, evaluates active policies and
            settles a breach on-chain.
          </div>
          <div className="median-strip" style={{ marginTop: 10 }}>
            <div className="metric">
              <span className="label">Configuration</span>
              <span className="value">{monitor.enabled ? "READY" : "DISABLED"}</span>
            </div>
            <div className="metric">
              <span className="label">Monitor</span>
              <span className="value">{liveRunning ? "ACTIVE" : "STOPPED"}</span>
            </div>
            <div className="metric">
              <span className="label">Interval</span>
              <span className="value">{Math.round(Number(monitor.intervalSeconds || 900) / 60)} min</span>
            </div>
            <div className="metric">
              <span className="label">Last cycle</span>
              <span className="value" style={{ fontSize: 13 }}>{monitor.lastCycleAt ? new Date(monitor.lastCycleAt).toLocaleTimeString() : "—"}</span>
            </div>
          </div>
          <div className="btn-row" style={{ marginTop: 12, flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={toggleMonitoring} disabled={!monitor.enabled}>
              {liveRunning ? "■ Stop live monitoring" : "▶ Start live monitoring"}
            </button>
            <button className="btn" onClick={runAutonomousCycle} disabled={!monitor.enabled || running}>
              Run autonomous cycle now
            </button>
          </div>
          {monitor.lastError && <div className="banner error" style={{ marginTop: 10 }}>{monitor.lastError}</div>}
        </div>
      </div>

      {result && (
        <>
          <div className="panel">
            <div className="panel-title">1. Oracle ingestion</div>
            <div className="panel-hint">
              Each node reports the same three climate variables. The protocol exposes the raw
              readings so the aggregation step is auditable.
            </div>

            <div className="node-grid">
              {result.nodeReadings.map((n) => (
                <div className="node-card" key={n.nodeId}>
                  <div className="node-id">{n.nodeId}</div>
                  <div className="node-metric"><span>Rainfall deficit</span><strong>{formatPct(n.rainfallDeficitBps)}</strong></div>
                  <div className="node-metric"><span>Temp anomaly</span><strong>{formatTemp(n.tempAnomalyTenths)}</strong></div>
                  <div className="node-metric"><span>Dry-day streak</span><strong>{n.dryDayStreak}d</strong></div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">2. Median aggregation</div>
            <div className="panel-hint">
              Values are aggregated independently per variable. With three reports, the middle
              observation becomes the median, preventing one outlier from directly deciding the claim.
            </div>

            <div className="median-strip">
              <div className="metric">
                <span className="label">Median rainfall deficit</span>
                <span className="value">{formatPct(aggregated.rainfallDeficitBps)}</span>
              </div>
              <div className="metric">
                <span className="label">Median temp anomaly</span>
                <span className="value">{formatTemp(aggregated.tempAnomalyTenths)}</span>
              </div>
              <div className="metric">
                <span className="label">Median dry-day streak</span>
                <span className="value">{aggregated.dryDayStreak}d</span>
              </div>
              <div className="metric">
                <span className="label">Reports</span>
                <span className="value">{aggregated.reportCount}/3</span>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">3. Compound risk evaluation</div>
            <div className="panel-hint">
              A payout requires rainfall deficit together with either prolonged dry days or a heat
              anomaly. No single variable can trigger the claim by itself.
            </div>

            <div className="rule-list">
              <Metric
                label="Rainfall deficit"
                value={formatPct(aggregated.rainfallDeficitBps)}
                threshold={formatPct(thresholds.rainfall)}
                breached={detail?.rainfallBreached}
              />
              <Metric
                label="Temperature anomaly"
                value={formatTemp(aggregated.tempAnomalyTenths)}
                threshold={formatTemp(thresholds.temp)}
                breached={detail?.heatBreached}
              />
              <Metric
                label="Dry-day continuity"
                value={`${aggregated.dryDayStreak} days`}
                threshold={`${thresholds.dryDays} days`}
                breached={detail?.dryDaysBreached}
              />
            </div>

            <div className="signature-grid">
              <div className={`signature-card ${result.evaluation.signature === "drought" ? "active" : ""}`}>
                <div className="signature-name">Drought signature</div>
                <div className="signature-formula">Rainfall breached AND dry days breached</div>
                <strong>{result.evaluation.signature === "drought" ? "SATISFIED" : "NOT SATISFIED"}</strong>
              </div>
              <div className={`signature-card ${result.evaluation.signature === "heat-accelerated-drought" ? "active" : ""}`}>
                <div className="signature-name">Heat-accelerated drought</div>
                <div className="signature-formula">Rainfall breached AND heat breached</div>
                <strong>{result.evaluation.signature === "heat-accelerated-drought" ? "SATISFIED" : "NOT SATISFIED"}</strong>
              </div>
            </div>

            {result.evaluation.breached ? (
              <div className="verdict breach">
                <strong>BREACH CONFIRMED.</strong> The compound condition was satisfied
                {result.evaluation.signature === "drought" ? " through the drought signature." : " through the heat-accelerated drought signature."}
              </div>
            ) : (
              <div className="verdict clear">
                <strong>NO BREACH.</strong> The aggregated climate conditions remain within the policy's compound trigger rules.
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panel-title">4. Settlement decision</div>
            <div className="settlement-grid">
              <div className="settlement-item">
                <span>Policy status</span>
                <strong>{result.policy.status}</strong>
              </div>
              <div className="settlement-item">
                <span>Payout decision</span>
                <strong>{result.payoutTx ? "RELEASED" : "NOT RELEASED"}</strong>
              </div>
              {result.payoutTx && (
                <div className="settlement-item">
                  <span>Amount</span>
                  <strong>{result.payoutTx.amount} native token</strong>
                </div>
              )}
            </div>

            {result.payoutTx ? (
              <div className="verdict breach">
                <strong>LiquidityVault payout released.</strong> {result.payoutTx.amount} native token was assigned to the farmer's wallet.
                {result.txHash && <div className="tx-ref">Transaction: {result.txHash}</div>}
              </div>
            ) : (
              <div className="verdict clear">
                No liquidity transfer was required for this evaluation.
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
