const hre = require("hardhat");

async function main() {
  const [deployer, insurerA, insurerB, insurerC] = await hre.ethers.getSigners();
  console.log("Deploying AgriShield3 contracts with account:", deployer.address);

  const PolicyRegistry = await hre.ethers.getContractFactory("PolicyRegistry");
  const policyRegistry = await PolicyRegistry.deploy();
  await policyRegistry.waitForDeployment();

  const LiquidityVault = await hre.ethers.getContractFactory("LiquidityVault");
  const liquidityVault = await LiquidityVault.deploy();
  await liquidityVault.waitForDeployment();

  const OracleAggregator = await hre.ethers.getContractFactory("OracleAggregator");
  const oracleAggregator = await OracleAggregator.deploy();
  await oracleAggregator.waitForDeployment();

  const ParametricEngine = await hre.ethers.getContractFactory("ParametricEngine");
  const parametricEngine = await ParametricEngine.deploy(
    await policyRegistry.getAddress(),
    await liquidityVault.getAddress(),
    await oracleAggregator.getAddress()
  );
  await parametricEngine.waitForDeployment();

  await (await policyRegistry.setParametricEngine(await parametricEngine.getAddress())).wait();
  await (await liquidityVault.setParametricEngine(await parametricEngine.getAddress())).wait();

  // Three independent local oracle identities.
  const demoNodes = [insurerA, insurerB, insurerC];
  for (const node of demoNodes) {
    await (await oracleAggregator.authorizeNode(node.address)).wait();
    console.log("Authorized oracle node:", node.address);
  }

  // Local demo insurers. On a real deployment these would be registered by governance.
  for (const insurer of [deployer, insurerA, insurerB]) {
    await (await policyRegistry.authorizeInsurer(insurer.address, true)).wait();
  }

  // Seed three products so Browse Policies is useful immediately after deployment.
  const products = [
    [deployer, "GreenShield Insurance", "Wheat Drought Cover", "Wheat", 120, "0.01", "1", 4000, 50, 10],
    [insurerA, "AgriSecure Mutual", "Maize Climate Protect", "Maize", 100, "0.012", "1.2", 3500, 45, 9],
    [insurerB, "CropGuard Cooperative", "Rice Monsoon Shield", "Rice", 150, "0.015", "1.5", 3000, 55, 12],
  ];
  for (const [insurer, company, name, crop, days, premium, sum, rain, heat, dry] of products) {
    const tx = await policyRegistry.connect(insurer).createProduct(
      company, name, crop, days,
      hre.ethers.parseEther(premium), hre.ethers.parseEther(sum), rain, heat, dry
    );
    await tx.wait();
  }

  console.log("\n=== Copy these into backend/.env ===");
  console.log(`POLICY_REGISTRY_ADDRESS=${await policyRegistry.getAddress()}`);
  console.log(`LIQUIDITY_VAULT_ADDRESS=${await liquidityVault.getAddress()}`);
  console.log(`ORACLE_AGGREGATOR_ADDRESS=${await oracleAggregator.getAddress()}`);
  console.log(`PARAMETRIC_ENGINE_ADDRESS=${await parametricEngine.getAddress()}`);
  console.log(`OPERATOR_ADDRESS=${deployer.address}`);
  console.log(`ORACLE_NODE_1=${insurerA.address}`);
  console.log(`ORACLE_NODE_2=${insurerB.address}`);
  console.log(`ORACLE_NODE_3=${insurerC.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
