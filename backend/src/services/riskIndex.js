// Mirrors ParametricEngine.sol's _isCompoundBreach() exactly, so the backend
// can evaluate/preview a claim before (or instead of) sending the on-chain
// transaction. Objective 03: "Compound Risk Trigger Model".
//
// A policy breaches when EITHER:
//   (a) rainfall deficit AND dry-day continuity both cross threshold
//       (classic drought signature), OR
//   (b) rainfall deficit combined with a heat anomaly crosses threshold
//       (heatwave-accelerated drought — the case a rainfall-only trigger
//       would miss).

function evaluateCompoundRisk(policy, reading) {
  const rainfallBreached = reading.rainfallDeficitBps >= policy.rainfallDeficitBps;
  const dryDaysBreached = reading.dryDayStreak >= policy.dryDayContinuity;
  const heatBreached = reading.tempAnomalyTenths >= policy.tempAnomalyTenthsC;

  const droughtSignature = rainfallBreached && dryDaysBreached;
  const heatAcceleratedSignature = rainfallBreached && heatBreached;

  const breached = droughtSignature || heatAcceleratedSignature;

  return {
    breached,
    signature: breached ? (droughtSignature ? "drought" : "heat-accelerated-drought") : null,
    detail: {
      rainfallBreached,
      dryDaysBreached,
      heatBreached,
    },
  };
}

module.exports = { evaluateCompoundRisk };
