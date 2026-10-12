// Simple in-memory store used in DEMO_MODE so the whole product can be
// demoed without a running blockchain node. Mirrors the shape of
// PolicyRegistry.Policy / LiquidityVault state 1:1 so swapping to the real
// chain later is a drop-in change in services/blockchain.js.

let nextPolicyId = 1;
let nextProductId = 1;

const state = {
  products: new Map(), // id -> insurance product
  policies: new Map(), // id -> enrolled farmer policy
  reserve: {
    totalReserves: 0, // wei-equivalent, stored as plain number (INR-scaled) for the demo
  },
  oracleReadings: new Map(), // plotKey -> { nodeId: reading }
  events: [], // append-only log for the "on-chain auditability" feed
};

function plotKey(lat, lon) {
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
}

function logEvent(type, payload) {
  state.events.unshift({
    id: state.events.length + 1,
    type,
    payload,
    timestamp: new Date().toISOString(),
  });
  if (state.events.length > 200) state.events.pop();
}

function createPolicy(policy) {
  const id = nextPolicyId++;
  const record = {
    id,
    status: "Active",
    createdAt: new Date().toISOString(),
    ...policy,
  };
  state.policies.set(id, record);
  state.reserve.totalReserves += policy.premium;
  logEvent("PolicyRegistered", { policyId: id, farmer: policy.farmer, cropType: policy.cropType, premium: policy.premium, sumInsured: policy.sumInsured, certificateId: policy.certificateId });
  return record;
}


function createProduct(product) {
  const id = nextProductId++;
  const record = { id, createdAt: new Date().toISOString(), ...product };
  state.products.set(id, record);
  logEvent("ProductCreated", { productId: id, companyName: record.companyName, productName: record.productName });
  return record;
}

function getProduct(id) {
  return state.products.get(Number(id));
}

function listProducts(activeOnly = false) {
  const all = Array.from(state.products.values());
  return activeOnly ? all.filter((p) => p.active) : all;
}

function setProductActive(id, active) {
  const p = state.products.get(Number(id));
  if (!p) return null;
  p.active = Boolean(active);
  logEvent("ProductStatusUpdated", { productId: Number(id), active: p.active });
  return p;
}

function getPolicy(id) {
  return state.policies.get(Number(id));
}

function listPolicies(farmer) {
  const all = Array.from(state.policies.values());
  if (!farmer) return all;
  return all.filter((p) => p.farmer.toLowerCase() === farmer.toLowerCase());
}

function settlePolicy(id, status, payout) {
  const policy = state.policies.get(Number(id));
  if (!policy) return null;
  policy.status = status;
  if (status === "PaidOut") {
    policy.payoutAmount = payout;
    policy.paidAt = new Date().toISOString();
    state.reserve.totalReserves -= payout;
    logEvent("PayoutReleased", { policyId: id, farmer: policy.farmer, amount: payout });
  }
  return policy;
}

function topUpReserve(amount) {
  state.reserve.totalReserves += amount;
  logEvent("ReserveTopUp", { amount });
  return state.reserve.totalReserves;
}

function recordOracleReading(lat, lon, nodeId, reading) {
  const key = plotKey(lat, lon);
  if (!state.oracleReadings.has(key)) state.oracleReadings.set(key, {});
  state.oracleReadings.get(key)[nodeId] = { ...reading, timestamp: new Date().toISOString() };
  logEvent("OracleReadingSubmitted", { plotKey: key, nodeId, ...reading });
}

function getReadings(lat, lon) {
  const key = plotKey(lat, lon);
  return state.oracleReadings.get(key) || {};
}

function getReserveState() {
  const outstanding = Array.from(state.policies.values())
    .filter((p) => p.status === "Active")
    .reduce((sum, p) => sum + p.sumInsured, 0);
  return {
    totalReserves: state.reserve.totalReserves,
    outstandingCollateral: outstanding,
    reserveRatioBps: outstanding === 0 ? 10000 : Math.round((state.reserve.totalReserves / outstanding) * 10000),
  };
}

function getEvents(limit = 50) {
  return state.events.slice(0, limit);
}

// Seed a small marketplace in demo mode so the farmer can browse multiple insurers.
createProduct({ insurer: "0x1111111111111111111111111111111111111111", companyName: "GreenShield Insurance", productName: "Wheat Drought Cover", cropType: "Wheat", coverageDays: 120, premium: 0.01, sumInsured: 1, rainfallDeficitBps: 4000, tempAnomalyTenthsC: 50, dryDayContinuity: 10, active: true });
createProduct({ insurer: "0x2222222222222222222222222222222222222222", companyName: "AgriSecure Mutual", productName: "Maize Climate Protect", cropType: "Maize", coverageDays: 100, premium: 0.012, sumInsured: 1.2, rainfallDeficitBps: 3500, tempAnomalyTenthsC: 45, dryDayContinuity: 9, active: true });
createProduct({ insurer: "0x3333333333333333333333333333333333333333", companyName: "CropGuard Cooperative", productName: "Rice Monsoon Shield", cropType: "Rice", coverageDays: 150, premium: 0.015, sumInsured: 1.5, rainfallDeficitBps: 3000, tempAnomalyTenthsC: 55, dryDayContinuity: 12, active: true });

module.exports = {
  createProduct,
  getProduct,
  listProducts,
  setProductActive,
  plotKey,
  createPolicy,
  getPolicy,
  listPolicies,
  settlePolicy,
  topUpReserve,
  recordOracleReading,
  getReadings,
  getReserveState,
  getEvents,
  logEvent,
};
