const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AgriShield3 end-to-end policy lifecycle", function () {
  let policyRegistry, liquidityVault, oracleAggregator, parametricEngine;
  let owner, farmer, nodeA, nodeB, nodeC;

  const LAT = 12_345_000; // 12.345 * 1e6
  const LON = 77_620_000; // 77.62 * 1e6

  beforeEach(async function () {
    [owner, farmer, nodeA, nodeB, nodeC] = await ethers.getSigners();

    const PolicyRegistry = await ethers.getContractFactory("PolicyRegistry");
    policyRegistry = await PolicyRegistry.deploy();

    const LiquidityVault = await ethers.getContractFactory("LiquidityVault");
    liquidityVault = await LiquidityVault.deploy();

    const OracleAggregator = await ethers.getContractFactory("OracleAggregator");
    oracleAggregator = await OracleAggregator.deploy();

    const ParametricEngine = await ethers.getContractFactory("ParametricEngine");
    parametricEngine = await ParametricEngine.deploy(
      await policyRegistry.getAddress(),
      await liquidityVault.getAddress(),
      await oracleAggregator.getAddress()
    );

    await policyRegistry.setParametricEngine(await parametricEngine.getAddress());
    await liquidityVault.setParametricEngine(await parametricEngine.getAddress());
    await oracleAggregator.authorizeNode(nodeA.address);
    await oracleAggregator.authorizeNode(nodeB.address);
    await oracleAggregator.authorizeNode(nodeC.address);
  });

  it("registers a policy, funds the vault, and pays out on a compound breach", async function () {
    const premium = ethers.parseEther("0.01");
    const sumInsured = ethers.parseEther("1");
    const now = Math.floor(Date.now() / 1000);

    const tx = await policyRegistry.registerPolicy(
      farmer.address,
      LAT,
      LON,
      "Wheat",
      now - 60,
      now + 30 * 24 * 3600,
      premium,
      sumInsured,
      4000, // 40% rainfall deficit threshold
      50, // +5.0C temp anomaly threshold
      10, // 10 consecutive dry days
      "AGS3-DEMO-0001"
    );
    const receipt = await tx.wait();
    const policyId = 1;

    await liquidityVault.depositPremium(policyId, farmer.address, sumInsured, { value: premium });
    // Underwriter tops up the shared pool so it can cover the full sum insured
    await liquidityVault.topUpReserve({ value: sumInsured });

    // Three independent nodes report a severe drought + heat signature
    await oracleAggregator.connect(nodeA).submitReading(LAT, LON, 4500, 60, 12);
    await oracleAggregator.connect(nodeB).submitReading(LAT, LON, 4200, 55, 11);
    await oracleAggregator.connect(nodeC).submitReading(LAT, LON, 4800, 65, 13);

    const farmerBalanceBefore = await ethers.provider.getBalance(farmer.address);

    await expect(parametricEngine.evaluateAndSettle(policyId))
      .to.emit(parametricEngine, "ClaimTriggered")
      .withArgs(policyId, farmer.address, sumInsured);

    const farmerBalanceAfter = await ethers.provider.getBalance(farmer.address);
    expect(farmerBalanceAfter - farmerBalanceBefore).to.equal(sumInsured);

    const policy = await policyRegistry.getPolicy(policyId);
    expect(policy.status).to.equal(1n); // PaidOut
  });

  it("pays out on the heat-accelerated drought signature", async function () {
    const premium = ethers.parseEther("0.01");
    const sumInsured = ethers.parseEther("1");
    const now = Math.floor(Date.now() / 1000);

    await policyRegistry.registerPolicy(
      farmer.address,
      LAT,
      LON,
      "Wheat",
      now - 60,
      now + 30 * 24 * 3600,
      premium,
      sumInsured,
      4000, // 40% rainfall deficit threshold
      50, // +5.0C temp anomaly threshold
      10, // 10 consecutive dry days
      "AGS3-DEMO-HEAT"
    );

    const policyId = 1;
    await liquidityVault.depositPremium(policyId, farmer.address, sumInsured, { value: premium });
    await liquidityVault.topUpReserve({ value: sumInsured });

    // Rainfall crosses its threshold and temperature crosses its threshold,
    // while dry-day continuity stays below threshold. This must use the
    // heat-accelerated drought branch rather than the classic drought branch.
    await oracleAggregator.connect(nodeA).submitReading(LAT, LON, 4100, 70, 6);
    await oracleAggregator.connect(nodeB).submitReading(LAT, LON, 4300, 65, 7);
    await oracleAggregator.connect(nodeC).submitReading(LAT, LON, 4200, 75, 5);

    await expect(parametricEngine.evaluateAndSettle(policyId))
      .to.emit(parametricEngine, "RiskEvaluated")
      .withArgs(policyId, 4200, 70, 6, true);

    const policy = await policyRegistry.getPolicy(policyId);
    expect(policy.status).to.equal(1n); // PaidOut
  });

  it("does not pay out when conditions stay within normal range", async function () {
    const premium = ethers.parseEther("0.01");
    const sumInsured = ethers.parseEther("1");
    const now = Math.floor(Date.now() / 1000);

    await policyRegistry.registerPolicy(
      farmer.address,
      LAT,
      LON,
      "Wheat",
      now - 60,
      now + 30 * 24 * 3600,
      premium,
      sumInsured,
      4000,
      50,
      10,
      "AGS3-DEMO-0002"
    );
    const policyId = 1;
    await liquidityVault.depositPremium(policyId, farmer.address, sumInsured, { value: premium });
    await liquidityVault.topUpReserve({ value: sumInsured });

    // Mild conditions, well under threshold
    await oracleAggregator.connect(nodeA).submitReading(LAT, LON, 500, 10, 2);
    await oracleAggregator.connect(nodeB).submitReading(LAT, LON, 400, 5, 1);
    await oracleAggregator.connect(nodeC).submitReading(LAT, LON, 600, 8, 3);

    const breached = await parametricEngine.evaluateAndSettle.staticCall(policyId);
    expect(breached).to.equal(false);
  });
});
