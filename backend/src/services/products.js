const { ethers } = require("ethers");
const env = require("../config/env");
const { policyRegistryAbi } = require("../config/abis");
const store = require("../data/store");

let provider, operatorSigner, registry;
if (!env.demoMode && env.addresses.policyRegistry && env.operatorPrivateKey) {
  provider = new ethers.JsonRpcProvider(env.rpcUrl);
  operatorSigner = new ethers.NonceManager(new ethers.Wallet(env.operatorPrivateKey, provider));
  registry = new ethers.Contract(env.addresses.policyRegistry, policyRegistryAbi, operatorSigner);
}

function normalizeProduct(p) {
  if (!p) return null;
  return {
    id: Number(p.id),
    insurer: p.insurer,
    companyName: p.companyName,
    productName: p.productName,
    cropType: p.cropType,
    coverageDays: Number(p.coverageDays),
    premium: Number(ethers.formatEther(p.premium)),
    sumInsured: Number(ethers.formatEther(p.sumInsured)),
    rainfallDeficitBps: Number(p.rainfallDeficitBps),
    tempAnomalyTenthsC: Number(p.tempAnomalyTenthsC),
    dryDayContinuity: Number(p.dryDayContinuity),
    active: Boolean(p.active),
  };
}

async function listProducts() {
  if (env.demoMode) return store.listProducts(true);
  const next = Number(await registry.nextProductId());
  const result = [];
  for (let id = 1; id < next; id++) {
    const p = normalizeProduct(await registry.getProduct(id));
    if (p && p.id) result.push(p);
  }
  return result;
}

async function getProduct(id) {
  if (env.demoMode) return store.getProduct(id);
  const p = normalizeProduct(await registry.getProduct(id));
  return p && p.id ? p : null;
}

async function createProduct(input) {
  const {
    companyName, productName, cropType, coverageDays,
    premiumEth, sumInsuredEth, rainfallDeficitPct, tempAnomalyC, dryDayContinuity,
  } = input;
  if (env.demoMode) return store.createProduct({
    insurer: input.insurer || "demo-insurer",
    companyName, productName, cropType,
    coverageDays: Number(coverageDays), premium: Number(premiumEth), sumInsured: Number(sumInsuredEth),
    rainfallDeficitBps: Math.round(Number(rainfallDeficitPct) * 100),
    tempAnomalyTenthsC: Math.round(Number(tempAnomalyC) * 10),
    dryDayContinuity: Number(dryDayContinuity), active: true,
  });
  if (!registry) throw new Error("Operator wallet is not configured");
  return withOperatorWrite(async () => {
    const tx = await registry.createProduct(
      companyName, productName, cropType, Number(coverageDays),
      ethers.parseEther(String(premiumEth)), ethers.parseEther(String(sumInsuredEth)),
      Math.round(Number(rainfallDeficitPct) * 100), Math.round(Number(tempAnomalyC) * 10), Number(dryDayContinuity)
    );
    const receipt = await tx.wait();
    const event = receipt.logs.map((l) => { try { return registry.interface.parseLog(l); } catch { return null; } })
      .find((e) => e && e.name === "ProductCreated");
    return getProduct(event ? Number(event.args.productId) : null);
  });
}

async function setProductActive(id, active) {
  if (env.demoMode) return store.setProductActive(id, active);
  if (!registry) throw new Error("Operator wallet is not configured");
  return withOperatorWrite(async () => {
    const tx = await registry.setProductActive(id, Boolean(active));
    await tx.wait();
    return getProduct(id);
  });
}

let writeQueue = Promise.resolve();
async function withOperatorWrite(task) {
  const previous = writeQueue;
  let release;
  writeQueue = new Promise((resolve) => { release = resolve; });
  await previous;
  try { return await task(); } finally { release(); }
}

module.exports = { listProducts, getProduct, createProduct, setProductActive };
