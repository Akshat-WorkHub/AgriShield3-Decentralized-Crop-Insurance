// Objective 02 from the proposal: "Multi-Node Oracle Aggregation".
// Independent nodes each fetch (or, in demo mode, simulate) a weather /
// satellite reading for a plot. We take the MEDIAN across nodes so a single
// bad or manipulated feed can never move a payout decision on its own —
// this directly answers the "single-oracle vulnerability" research gap.

const store = require("../data/store");

const NODE_IDS = ["openweather-node", "nasa-power-node", "backup-satellite-node"];

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

/// Deterministic-ish pseudo-random generator seeded by plot + node so repeated
/// calls for the same plot drift smoothly instead of jumping wildly, which
/// looks more like a real weather signal in the demo UI.
function seededNoise(seedString, amplitude) {
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = (hash << 5) - hash + seedString.charCodeAt(i);
    hash |= 0;
  }
  const rand = Math.sin(hash) * 10000;
  const frac = rand - Math.floor(rand);
  return (frac - 0.5) * 2 * amplitude;
}

/// Simulates each node independently fetching data for the plot. In a real
/// deployment, `fetchLive` versions of these would call OpenWeatherMap and
/// the NASA POWER API using the coordinates; here we generate physically
/// plausible values that respond to an optional `scenario` override so the
/// frontend "Simulate Drought" demo button has something to drive.
function simulateNodeReading(nodeId, lat, lon, scenario) {
  const timeSalt = Math.floor(Date.now() / (1000 * 60 * 5)); // drifts every 5 min
  const seed = `${nodeId}:${lat.toFixed(3)}:${lon.toFixed(3)}:${timeSalt}`;

  let baseRainfallDeficitBps = 800; // ~8% deficit, normal
  let baseTempAnomalyTenths = 5; // +0.5C, normal
  let baseDryDayStreak = 2;

  if (scenario === "drought") {
    baseRainfallDeficitBps = 4600;
    baseTempAnomalyTenths = 58;
    baseDryDayStreak = 12;
  } else if (scenario === "heatwave") {
    baseRainfallDeficitBps = 4200;
    baseTempAnomalyTenths = 72;
    baseDryDayStreak = 6;
  } else if (scenario === "healthy") {
    baseRainfallDeficitBps = 200;
    baseTempAnomalyTenths = 2;
    baseDryDayStreak = 0;
  }

  return {
    nodeId,
    rainfallDeficitBps: Math.max(0, Math.round(baseRainfallDeficitBps + seededNoise(seed + "r", 250))),
    tempAnomalyTenths: Math.round(baseTempAnomalyTenths + seededNoise(seed + "t", 5)),
    dryDayStreak: Math.max(0, Math.round(baseDryDayStreak + seededNoise(seed + "d", 1.2))),
  };
}

/// Polls every registered node for a plot, stores each raw submission, and
/// returns the aggregated median reading plus per-node breakdown so the
/// frontend can show "3 independent sources agree" style transparency.
function pollPlot(lat, lon, scenario) {
  const nodeReadings = NODE_IDS.map((nodeId) => {
    const reading = simulateNodeReading(nodeId, lat, lon, scenario);
    store.recordOracleReading(lat, lon, nodeId, reading);
    return reading;
  });

  const aggregated = {
    rainfallDeficitBps: Math.round(median(nodeReadings.map((r) => r.rainfallDeficitBps))),
    tempAnomalyTenths: Math.round(median(nodeReadings.map((r) => r.tempAnomalyTenths))),
    dryDayStreak: Math.round(median(nodeReadings.map((r) => r.dryDayStreak))),
    reportCount: nodeReadings.length,
  };

  return { nodeReadings, aggregated };
}

module.exports = { pollPlot, NODE_IDS, median };
