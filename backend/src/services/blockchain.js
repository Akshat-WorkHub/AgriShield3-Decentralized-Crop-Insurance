const { ethers } = require("ethers");
const env = require("../config/env");
const { policyRegistryAbi, liquidityVaultAbi, oracleAggregatorAbi, parametricEngineAbi } = require("../config/abis");
const store = require("../data/store");
const oracleAggregator = require("./oracleAggregator");
const { evaluateCompoundRisk } = require("./riskIndex");
const { fetchAllLive } = require("./liveOracles");

let provider, signer, operatorSigner, policyRegistry, liquidityVault, oracleContract, parametricEngine;
let oracleNodeSigners = [];
let chainWriteQueue = Promise.resolve();

if (!env.demoMode) {
  provider = new ethers.JsonRpcProvider(env.rpcUrl);
  signer = env.oracleUpdaterPrivateKey
  ? new ethers.NonceManager(
      new ethers.Wallet(env.oracleUpdaterPrivateKey, provider)
    )
  : provider;
  policyRegistry = new ethers.Contract(env.addresses.policyRegistry, policyRegistryAbi, signer);
  liquidityVault = new ethers.Contract(env.addresses.liquidityVault, liquidityVaultAbi, signer);
  oracleContract = new ethers.Contract(env.addresses.oracleAggregator, oracleAggregatorAbi, signer);
  parametricEngine = new ethers.Contract(env.addresses.parametricEngine, parametricEngineAbi, signer);

  // OracleAggregator requires distinct authorized addresses for the three
  // reports. Configure one private key per node (normally account #1/#2/#3
  // on the local Hardhat chain). Each signer has its own NonceManager.
  oracleNodeSigners = env.oracleNodePrivateKeys.map(
    (key) => new ethers.NonceManager(new ethers.Wallet(key, provider))
  );
}

const toBps = (pct) => Math.round(pct * 100);
const CERT_PREFIX = "AGS3";

function generateCertificateId(policyId) {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${CERT_PREFIX}-${String(policyId).padStart(4, "0")}-${rand}`;
}

async function withChainWrite(task) {
  const previous = chainWriteQueue;
  let release;
  chainWriteQueue = new Promise((resolve) => { release = resolve; });
  await previous;
  try {
    return await task();
  } finally {
    release();
  }
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
  const next = Number(await policyRegistry.nextProductId());
  const products = [];
  for (let id = 1; id < next; id++) {
    const product = normalizeProduct(await policyRegistry.getProduct(id));
    if (product && product.id && product.active) products.push(product);
  }
  return products;
}

async function getProduct(productId) {
  if (env.demoMode) return store.getProduct(productId) || null;
  const product = normalizeProduct(await policyRegistry.getProduct(productId));
  return product && product.id ? product : null;
}

async function createProduct(input) {
  const {
    companyName, productName, cropType, coverageDays,
    premiumEth, sumInsuredEth, rainfallDeficitPct, tempAnomalyC, dryDayContinuity,
  } = input;
  if (env.demoMode) {
    return store.createProduct({
      insurer: input.insurer || "demo-operator",
      companyName, productName, cropType, coverageDays: Number(coverageDays),
      premium: Number(premiumEth), sumInsured: Number(sumInsuredEth),
      rainfallDeficitBps: Math.round(Number(rainfallDeficitPct) * 100),
      tempAnomalyTenthsC: Math.round(Number(tempAnomalyC) * 10),
      dryDayContinuity: Number(dryDayContinuity), active: true,
    });
  }
  if (!operatorSigner || !policyRegistry) throw new Error("Operator wallet is not configured");
  return withChainWrite(async () => {
    const tx = await policyRegistry.connect(operatorSigner).createProduct(
      companyName, productName, cropType, Number(coverageDays),
      ethers.parseEther(String(premiumEth)), ethers.parseEther(String(sumInsuredEth)),
      Math.round(Number(rainfallDeficitPct) * 100), Math.round(Number(tempAnomalyC) * 10), Number(dryDayContinuity)
    );
    const receipt = await tx.wait();
    const event = receipt.logs.map((l) => { try { return policyRegistry.interface.parseLog(l); } catch { return null; } })
      .find((e) => e && e.name === "ProductCreated");
    return getProduct(event ? Number(event.args.productId) : null);
  });
}

async function setProductActive(productId, active) {
  if (env.demoMode) return store.setProductActive(productId, active);
  if (!operatorSigner || !policyRegistry) throw new Error("Operator wallet is not configured");
  return withChainWrite(async () => {
    const tx = await policyRegistry.connect(operatorSigner).setProductActive(productId, Boolean(active));
    await tx.wait();
    return getProduct(productId);
  });
}

async function enrollProduct(input) {
  const { productId, farmer, latitude, longitude } = input;
  const product = await getProduct(productId);
  if (!product || !product.active) throw new Error("Selected insurance product is unavailable");
  const certificateId = generateCertificateId(Date.now());
  if (env.demoMode) {
    const policy = store.createPolicy({
      farmer, latitude: Number(latitude), longitude: Number(longitude),
      cropType: product.cropType, companyName: product.companyName, productName: product.productName,
      insurer: product.insurer, productId: product.id,
      coverageStart: Math.floor(Date.now() / 1000),
      coverageEnd: Math.floor(Date.now() / 1000) + product.coverageDays * 86400,
      premium: product.premium, sumInsured: product.sumInsured,
      rainfallDeficitBps: product.rainfallDeficitBps,
      tempAnomalyTenthsC: product.tempAnomalyTenthsC,
      dryDayContinuity: product.dryDayContinuity,
      certificateId,
    });
    return policy;
  }
  return withChainWrite(async () => {
    const tx = await policyRegistry.connect(signer).enrollProduct(
      Number(productId), farmer, Math.round(Number(latitude) * 1e6), Math.round(Number(longitude) * 1e6), certificateId
    );
    const receipt = await tx.wait();
    const event = receipt.logs.map((l) => { try { return policyRegistry.interface.parseLog(l); } catch { return null; } })
      .find((e) => e && e.name === "PolicyRegistered");
    const policyId = event ? Number(event.args.policyId) : null;
    const premiumWei = ethers.parseEther(String(product.premium));
    const sumInsuredWei = ethers.parseEther(String(product.sumInsured));
    const depositTx = await liquidityVault.connect(signer).depositPremium(policyId, farmer, sumInsuredWei, { value: premiumWei });
    await depositTx.wait();
    return getPolicy(policyId);
  });
}

async function registerPolicy(input) {
  const {
    farmer,
    latitude,
    longitude,
    cropType,
    coverageDays,
    premiumEth,
    sumInsuredEth,
    rainfallDeficitPct,
    tempAnomalyC,
    dryDayContinuity,
  } = input;

  const now = Math.floor(Date.now() / 1000);
  const coverageStart = now;
  const coverageEnd = now + coverageDays * 24 * 3600;

  if (env.demoMode) {
    const tentativeId = Date.now(); // placeholder, real id assigned by store
    const certificateId = generateCertificateId(tentativeId);
    const policy = store.createPolicy({
      farmer,
      latitude,
      longitude,
      cropType,
      coverageStart,
      coverageEnd,
      premium: Number(premiumEth),
      sumInsured: Number(sumInsuredEth),
      rainfallDeficitBps: toBps(rainfallDeficitPct),
      tempAnomalyTenthsC: Math.round(tempAnomalyC * 10),
      dryDayContinuity,
      certificateId,
    });
    // fix certificate id to reflect the real assigned id
    policy.certificateId = generateCertificateId(policy.id);
    return policy;
  }

  return withChainWrite(async () => {
    const premiumWei = ethers.parseEther(String(premiumEth));
    const sumInsuredWei = ethers.parseEther(String(sumInsuredEth));
    const certificateId = generateCertificateId(Date.now());

    const tx = await policyRegistry.registerPolicy(
      farmer,
      Math.round(latitude * 1e6),
      Math.round(longitude * 1e6),
      cropType,
      coverageStart,
      coverageEnd,
      premiumWei,
      sumInsuredWei,
      toBps(rainfallDeficitPct),
      Math.round(tempAnomalyC * 10),
      dryDayContinuity,
      certificateId
    );
    const receipt = await tx.wait();
    const event = receipt.logs.map((l) => {
      try { return policyRegistry.interface.parseLog(l); } catch { return null; }
    }).find((e) => e && e.name === "PolicyRegistered");
    const policyId = event ? Number(event.args.policyId) : null;

    const depositTx = await liquidityVault.depositPremium(policyId, farmer, sumInsuredWei, { value: premiumWei });
    await depositTx.wait();

    return {
      id: policyId,
      farmer, latitude, longitude, cropType, coverageStart, coverageEnd,
      premium: Number(premiumEth), sumInsured: Number(sumInsuredEth),
      rainfallDeficitBps: toBps(rainfallDeficitPct),
      tempAnomalyTenthsC: Math.round(tempAnomalyC * 10), dryDayContinuity,
      certificateId, status: "Active", txHash: receipt.hash,
    };
  });
}

async function getPolicy(policyId) {
  if (env.demoMode) return store.getPolicy(policyId);
  const p = await policyRegistry.getPolicy(policyId);
  return {
    id: Number(p.id),
    farmer: p.farmer,
    insurer: p.insurer,
    productId: Number(p.productId),
    latitude: Number(p.latitude) / 1e6,
    longitude: Number(p.longitude) / 1e6,
    companyName: p.companyName,
    productName: p.productName,
    cropType: p.cropType,
    coverageStart: Number(p.coverageStart),
    coverageEnd: Number(p.coverageEnd),
    premium: Number(ethers.formatEther(p.premium)),
    sumInsured: Number(ethers.formatEther(p.sumInsured)),
    rainfallDeficitBps: Number(p.rainfallDeficitBps),
    tempAnomalyTenthsC: Number(p.tempAnomalyTenthsC),
    dryDayContinuity: Number(p.dryDayContinuity),
    status: ["Active", "PaidOut", "Expired"][Number(p.status)],
    certificateId: p.certificateId,
  };
}

async function listPolicies(farmer) {
  if (env.demoMode) return store.listPolicies(farmer);

  // Farmer address is required for the on-chain lookup
  if (!farmer) {
    return [];
  }

  const ids = await policyRegistry.getFarmerPolicies(farmer);
  return Promise.all(ids.map((id) => getPolicy(Number(id))));
}

async function topUpReserve(amountEth) {
  if (env.demoMode) return { totalReserves: store.topUpReserve(Number(amountEth)) };
  const tx = await liquidityVault.topUpReserve({ value: ethers.parseEther(String(amountEth)) });
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

async function getReserveState() {
  if (env.demoMode) return store.getReserveState();
  const total = await liquidityVault.totalReserves();
  const nextId = Number(await policyRegistry.nextPolicyId());
  let outstanding = 0n;
  for (let id = 1; id < nextId; id++) {
    const p = await policyRegistry.getPolicy(id);
    if (Number(p.status) === 0) {
      outstanding += await liquidityVault.policyCollateral(id);
    }
  }
  const ratio = outstanding === 0n ? 10000n : (total * 10000n) / outstanding;
  return {
    totalReserves: Number(ethers.formatEther(total)),
    outstandingCollateral: Number(ethers.formatEther(outstanding)),
    availableLiquidity: Math.max(0, Number(ethers.formatEther(total - (total < outstanding ? total : outstanding)))),
    reserveRatioBps: Number(ratio),
  };
}

/// Polls the multi-node oracle for a plot (simulated in demo mode, real
/// on-chain submission + read in live mode), then evaluates + settles the
/// policy's compound risk index. Returns a rich result object the frontend
/// uses to render the "Oracle Ingestion -> Rule Evaluation -> Payout" flow
/// from the proposal live.
async function pollAndEvaluate(policyId, scenario, options = {}) {
  const policy = await getPolicy(policyId);
  if (!policy) throw new Error("Policy not found");

  if (options.live !== true) {
    const { nodeReadings, aggregated } = oracleAggregator.pollPlot(policy.latitude, policy.longitude, scenario);
    const result = evaluateCompoundRisk(policy, aggregated);
    if (env.demoMode) {
      let payoutTx = null;
      if (result.breached && policy.status === "Active") {
        store.settlePolicy(policyId, "PaidOut", policy.sumInsured);
        payoutTx = { amount: policy.sumInsured, farmer: policy.farmer };
      }
      return { mode: "demo", policy: store.getPolicy(policyId), nodeReadings, aggregated, evaluation: result, payoutTx };
    }

    // Preserve the original working live-blockchain/demo-scenario path: the
    // scenario is simulated locally, then submitted by the authorized oracle
    // updater so the existing console remains usable without external APIs.
    if (!oracleNodeSigners.length) {
      throw new Error("Scenario evaluation in live blockchain mode requires ORACLE_NODE_PRIVATE_KEYS with 3 authorized node keys");
    }
    return withChainWrite(async () => {
      for (let i = 0; i < nodeReadings.length; i++) {
        const reading = nodeReadings[i];
        const nodeSigner = oracleNodeSigners[i];
        const tx = await oracleContract.connect(nodeSigner).submitReading(
          Math.round(policy.latitude * 1e6), Math.round(policy.longitude * 1e6),
          reading.rainfallDeficitBps, reading.tempAnomalyTenths, reading.dryDayStreak
        );
        await tx.wait();
      }
      const settleTx = await parametricEngine.evaluateAndSettle(policyId);
      const receipt = await settleTx.wait();
      const claimEvent = receipt.logs.map((l) => {
        try { return parametricEngine.interface.parseLog(l); } catch { return null; }
      }).find((e) => e && e.name === "ClaimTriggered");
      const updatedPolicy = await getPolicy(policyId);
      return {
        mode: "simulated-on-chain", policy: updatedPolicy, nodeReadings, aggregated,
        evaluation: result,
        payoutTx: claimEvent ? { amount: Number(ethers.formatEther(claimEvent.args.payout)), farmer: claimEvent.args.farmer } : null,
        txHash: receipt.hash,
      };
    });
  }

  if (env.demoMode) throw new Error("Live oracle evaluation is unavailable while DEMO_MODE=true");
  if (oracleNodeSigners.length < 3) {
    throw new Error("Live oracle quorum requires ORACLE_NODE_PRIVATE_KEYS with 3 authorized node keys");
  }

  return withChainWrite(async () => {
    const { nodeReadings, errors } = await fetchAllLive(policy.latitude, policy.longitude);
    if (nodeReadings.length !== 3) throw new Error("Live oracle quorum requires all 3 sources");

    for (let i = 0; i < nodeReadings.length; i++) {
      const reading = nodeReadings[i];
      const nodeSigner = oracleNodeSigners[i];
      const tx = await oracleContract.connect(nodeSigner).submitReading(
        Math.round(policy.latitude * 1e6),
        Math.round(policy.longitude * 1e6),
        reading.rainfallDeficitBps,
        reading.tempAnomalyTenths,
        reading.dryDayStreak
      );
      await tx.wait();
      reading.txHash = tx.hash;
    }

    const rawMedian = await oracleContract.getMedianReading(
      Math.round(policy.latitude * 1e6),
      Math.round(policy.longitude * 1e6)
    );
    const aggregated = {
      rainfallDeficitBps: Number(rawMedian[0]),
      tempAnomalyTenths: Number(rawMedian[1]),
      dryDayStreak: Number(rawMedian[2]),
      reportCount: Number(rawMedian[3]),
    };

    const settleTx = await parametricEngine.evaluateAndSettle(policyId);
    const receipt = await settleTx.wait();
    const claimEvent = receipt.logs.map((l) => {
      try { return parametricEngine.interface.parseLog(l); } catch { return null; }
    }).find((e) => e && e.name === "ClaimTriggered");
    const riskEvent = receipt.logs.map((l) => {
      try { return parametricEngine.interface.parseLog(l); } catch { return null; }
    }).find((e) => e && e.name === "RiskEvaluated");

    const updatedPolicy = await getPolicy(policyId);
    return {
      mode: "live",
      policy: updatedPolicy,
      nodeReadings,
      aggregated,
      evaluation: {
        ...evaluateCompoundRisk(policy, aggregated),
        breached: Boolean(claimEvent),
        onChain: true,
        riskEvent: riskEvent ? {
          rainfallDeficitBps: Number(riskEvent.args.rainfallDeficitBps),
          tempAnomalyTenthsC: Number(riskEvent.args.tempAnomalyTenthsC),
          dryDayStreak: Number(riskEvent.args.dryDayStreak),
          breached: Boolean(riskEvent.args.breached),
        } : null,
      },
      payoutTx: claimEvent ? {
        amount: Number(ethers.formatEther(claimEvent.args.payout)),
        farmer: claimEvent.args.farmer,
      } : null,
      txHash: receipt.hash,
      sourceErrors: errors,
    };
  });
}

async function monitorActivePolicies() {
  const policies = [];
  if (env.demoMode) {
    policies.push(...store.listPolicies().filter((p) => p.status === "Active"));
  } else {
    const nextId = Number(await policyRegistry.nextPolicyId());
    for (let id = 1; id < nextId; id++) {
      const p = await getPolicy(id);
      if (p && p.status === "Active") policies.push(p);
    }
  }

  const results = [];
  for (const p of policies) {
    try {
      results.push(await pollAndEvaluate(p.id, undefined, { live: true }));
    } catch (err) {
      results.push({ policyId: p.id, error: err.message });
    }
  }
  return { monitoredPolicies: policies.length, results };
}

async function getEvents(limit = 50) {
  if (env.demoMode) return store.getEvents(limit);
  const filters = [
    [policyRegistry, "PolicyRegistered"],
    [policyRegistry, "PolicySettled"],
    [policyRegistry, "ProductCreated"],
    [liquidityVault, "PremiumDeposited"],
    [liquidityVault, "PayoutReleased"],
    [liquidityVault, "ReserveTopUp"],
    [oracleContract, "ReadingSubmitted"],
    [parametricEngine, "RiskEvaluated"],
    [parametricEngine, "ClaimTriggered"],
  ];
  const events = [];
  for (const [contract, name] of filters) {
    try {
      const logs = await contract.queryFilter(contract.filters[name](), 0, "latest");
      for (const log of logs) {
        events.push({ id: `${log.transactionHash}:${log.index}`, type: name, payload: log.args ? Object.fromEntries(log.fragment.inputs.map((input, i) => [input.name || String(i), formatEventArg(log.args[i])])) : {}, timestamp: new Date((await provider.getBlock(log.blockNumber)).timestamp * 1000).toISOString(), blockNumber: log.blockNumber, txHash: log.transactionHash });
      }
    } catch (err) {
      console.warn(`Could not read ${name} events:`, err.message);
    }
  }
  events.sort((a, b) => b.blockNumber - a.blockNumber);
  return events.slice(0, Number(limit) || 50);
}

function formatEventArg(value) {
  if (typeof value === "bigint") return value.toString();
  return value;
}

module.exports = {
  registerPolicy,
  enrollProduct,
  createProduct,
  listProducts,
  getProduct,
  setProductActive,
  getPolicy,
  listPolicies,
  topUpReserve,
  getReserveState,
  pollAndEvaluate,
  monitorActivePolicies,
  getEvents,
  isDemoMode: env.demoMode,
};
