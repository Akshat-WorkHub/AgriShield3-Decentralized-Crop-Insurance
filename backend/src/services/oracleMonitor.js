const env = require("../config/env");
const blockchain = require("./blockchain");

let timer = null;
let state = { enabled: env.liveOracleEnabled, running: false, lastCycleAt: null, lastCycle: null, lastError: null };
let cycleInProgress = false;

async function runCycle() {
  if (cycleInProgress) return { skipped: true, reason: "cycle already running" };
  cycleInProgress = true;
  try {
    const result = await blockchain.monitorActivePolicies();
    state.lastCycleAt = new Date().toISOString();
    state.lastCycle = result;
    state.lastError = null;
    return result;
  } catch (err) {
    state.lastCycleAt = new Date().toISOString();
    state.lastError = err.message;
    throw err;
  } finally {
    cycleInProgress = false;
  }
}

function start() {
  if (timer) return state;
  if (!env.liveOracleEnabled) throw new Error("Live monitoring is disabled in backend configuration (LIVE_ORACLE_ENABLED=false)");
  state.running = true;
  const interval = Math.max(60, Number(env.oraclePollIntervalSeconds || 900));
  timer = setInterval(() => runCycle().catch((e) => console.error("Autonomous oracle cycle failed:", e.message)), interval * 1000);
  return state;
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  state.running = false;
  return state;
}

function getStatus() {
  return { ...state, intervalSeconds: Number(env.oraclePollIntervalSeconds || 900), cycleInProgress };
}

module.exports = { start, stop, runCycle, getStatus };
