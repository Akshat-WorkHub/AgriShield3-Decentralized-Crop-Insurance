require("dotenv").config();

module.exports = {
  port: process.env.PORT || 4000,
  demoMode: (process.env.DEMO_MODE || "true").toLowerCase() !== "false",
  rpcUrl: process.env.RPC_URL || "http://127.0.0.1:8545",
  oracleUpdaterPrivateKey: process.env.ORACLE_UPDATER_PRIVATE_KEY || "",
  operatorPrivateKey: process.env.OPERATOR_PRIVATE_KEY || process.env.ORACLE_UPDATER_PRIVATE_KEY || "",
  oracleNodePrivateKeys: (process.env.ORACLE_NODE_PRIVATE_KEYS || "").split(",").map((x) => x.trim()).filter(Boolean),
  openWeatherApiKey: process.env.OPENWEATHER_API_KEY || "",
  nasaPowerBaseUrl: process.env.NASA_POWER_BASE_URL || "https://power.larc.nasa.gov/api/temporal/daily/point",
  liveOracleEnabled: (process.env.LIVE_ORACLE_ENABLED || "false").toLowerCase() === "true",
  oraclePollIntervalSeconds: Number(process.env.ORACLE_POLL_INTERVAL_SECONDS || 900),
  rainfallBaselineMm: Number(process.env.RAINFALL_BASELINE_MM || 35),
  temperatureBaselineC: Number(process.env.TEMPERATURE_BASELINE_C || 30),
  dryDayRainThresholdMm: Number(process.env.DRY_DAY_RAIN_THRESHOLD_MM || 1),
  openWeatherRainBaselineMm: Number(process.env.OPENWEATHER_RAIN_BASELINE_MM || 5),
  addresses: {
    policyRegistry: process.env.POLICY_REGISTRY_ADDRESS || "",
    liquidityVault: process.env.LIQUIDITY_VAULT_ADDRESS || "",
    oracleAggregator: process.env.ORACLE_AGGREGATOR_ADDRESS || "",
    parametricEngine: process.env.PARAMETRIC_ENGINE_ADDRESS || "",
  },
};
