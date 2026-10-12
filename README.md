# AgriShield3 — Decentralized Parametric Crop Insurance Protocol

Full-stack implementation matching the Review-1 proposal: Solidity contracts
(PolicyRegistry, LiquidityVault, ParametricEngine), a Node/Express backend
that runs the multi-node oracle aggregation + compound risk index, and a
React farmer dashboard.

## Folder layout

```
agrishield3/d:\Blockchain Project\Projects Zips\AgriShield3_RoleBased_Farmer_Operator_P6.zip
├── contracts/     Hardhat project — Solidity contracts, deploy script, tests
├── backend/       Express API — oracle aggregation, policy/claim endpoints, ethers.js bridge
└── frontend/      React (Vite) dashboard — enrollment, certificate, live payout tracking
```

## Quick start (local demo, ~5 minutes)

### 1. Smart contracts (local Hardhat chain)

```bash
cd contracts
npm install
npx hardhat node                     # terminal A — local EVM chain (Ganache-style)
npx hardhat run scripts/deploy.js --network localhost   # terminal B
```
Copy the three printed addresses (PolicyRegistry, LiquidityVault, ParametricEngine)
into `backend/.env`.

### 2. Backend

```bash
cd backend
cp .env.example .env      # fill in RPC_URL + contract addresses + a funded private key
npm install
npm run dev                # http://localhost:4000
```
The backend works in two modes:
- **DEMO_MODE=true** (default): everything (policies, oracle feed, claims) is
  simulated in memory — no wallet, no RPC needed. Good for showing the UI end to end.
- **DEMO_MODE=false**: the backend actually calls the deployed contracts via ethers.js.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                # http://localhost:5173
```

## What's implemented from the proposal

| Proposal objective | Where |
|---|---|
| PolicyRegistry.sol / LiquidityVault.sol | `contracts/contracts/` |
| Multi-node oracle median aggregation | `backend/src/services/oracleAggregator.js` |
| Compound risk index (rainfall + temp + drought continuity) | `contracts/contracts/ParametricEngine.sol` + mirrored in `backend/src/services/riskIndex.js` |
| Sub-second automated payout | `LiquidityVault.releasePayout` triggered from `backend/src/routes/oracle.js` |
| On-chain transparency / auditability | `PolicyRegistry` + `LiquidityVault` emit events; frontend "Reserve" page reads them |
| Web3 onboarding friction fix | Frontend dashboard hides wallet/gas details behind a simple enrollment flow + demo mode |

## Oracle Console — implemented claim-evaluation flow

The Oracle Console demonstrates the complete oracle-to-settlement path for a selected policy:

1. Load the policy and display its rainfall, temperature, and dry-day trigger thresholds.
2. Select one of four demonstration scenarios: normal, healthy, heatwave, or severe drought.
3. Poll the three configured oracle identities and display their raw readings.
4. Compute the median independently for rainfall deficit, temperature anomaly, and dry-day continuity.
5. Evaluate the compound rules:
   - **Drought signature:** rainfall deficit breached AND dry-day continuity breached.
   - **Heat-accelerated drought:** rainfall deficit breached AND temperature anomaly breached.
6. Display the final breach/no-breach decision and settlement status.
7. When a breach is confirmed in demo mode, the in-memory vault records the payout; in live mode, the backend submits readings and invokes `ParametricEngine.evaluateAndSettle()`.

The `heatwave` demonstration scenario intentionally crosses the rainfall and temperature thresholds while remaining below the dry-day threshold, so the dashboard can visibly demonstrate the heat-accelerated drought branch.

## Live Oracle Ingestion & Autonomous Monitoring

The Oracle Console supports two paths. Demo scenarios keep the original deterministic simulation. Live evaluation fetches three independent external sources: OpenWeather, NASA POWER, and Open-Meteo backup. The backend normalizes their observations into AgriShield3's rainfall-deficit, temperature-anomaly, and dry-day variables, submits one report per authorized oracle node, reads the on-chain median, and invokes `ParametricEngine.evaluateAndSettle`.

The Oracle Console also exposes **Start live monitoring / Stop live monitoring**. The scheduler lives in the backend so browser refreshes do not own the monitoring loop. `ORACLE_POLL_INTERVAL_SECONDS` defaults to 900 seconds (15 minutes). `Run autonomous cycle now` is provided for demonstrations and testing.

OpenWeather's free current-weather endpoint does not provide a seven-day observed rainfall history, so the OpenWeather node uses its current 1h/3h precipitation observation and an explicit short-window baseline. NASA POWER and Open-Meteo use recent daily precipitation and mean-temperature observations. These normalization baselines are prototype parameters, not a validated crop/region climatology model. Production deployment should replace them with agronomic, crop-specific and location-specific climatological baselines.

For live on-chain settlement, `ORACLE_NODE_PRIVATE_KEYS` must contain three keys corresponding to the three addresses authorized by the current Hardhat deployment. The keys are used only by the backend; never expose them in the frontend.

## Role-based product architecture

AgriShield3 now separates the application into two portals:

### Farmer portal
- Browse Policies: compare active insurance products from participating companies.
- Enroll a Plot: select an existing product and provide the farmer wallet and plot coordinates. Product terms are not editable by the farmer.
- My Policies: view only the farmer's enrolled policies and certificates.
- Oracle Status: read-only visibility into monitoring status for a farmer policy.

### Insurance operator portal
- Overview: active products, active policies, committed coverage and reserve liquidity.
- Policy Products: create/activate/deactivate insurance products that appear in the farmer marketplace.
- Oracle Monitoring: operate live multi-node ingestion, autonomous monitoring and settlement.
- Reserve Pool: top up liquidity and inspect reserve/audit activity.

### On-chain distinction
`PolicyRegistry` now stores both insurer products and farmer enrollments. A product contains the company's premium, coverage and climate trigger terms. When a farmer enrolls a plot, those terms are copied into a policy record together with the farmer, plot coordinates, insurer and product identifiers. `ParametricEngine` and `LiquidityVault` continue to operate on the resulting policy.

The UI role switch is a prototype portal selector, not a production authentication system. A production deployment should replace it with wallet/session-based role authorization.
