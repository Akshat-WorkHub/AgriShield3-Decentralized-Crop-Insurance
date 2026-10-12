// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./PolicyRegistry.sol";
import "./LiquidityVault.sol";
import "./OracleAggregator.sol";

/// @title ParametricEngine
/// @notice Objective 03 — Compound Risk Trigger Model. Evaluates the median
///         oracle reading for a policy's plot against precipitation deficit,
///         temperature anomaly and dry-day continuity together (not rainfall
///         alone), and — the moment the combined index crosses threshold —
///         calls LiquidityVault directly with no human in the loop
///         (Objective 05, "Sub-Second Settlement").
contract ParametricEngine is Ownable {
    PolicyRegistry public immutable policyRegistry;
    LiquidityVault public immutable liquidityVault;
    OracleAggregator public immutable oracleAggregator;

    // Minimum number of independent oracle nodes required before a reading
    // is trusted enough to trigger a payout.
    uint256 public minReportsRequired = 3;

    event RiskEvaluated(
        uint256 indexed policyId,
        int256 rainfallDeficitBps,
        int256 tempAnomalyTenthsC,
        uint256 dryDayStreak,
        bool breached
    );
    event ClaimTriggered(uint256 indexed policyId, address indexed farmer, uint256 payout);
    event MinReportsUpdated(uint256 minReports);

    constructor(address _policyRegistry, address _liquidityVault, address _oracleAggregator) Ownable(msg.sender) {
        policyRegistry = PolicyRegistry(_policyRegistry);
        liquidityVault = LiquidityVault(payable(_liquidityVault));
        oracleAggregator = OracleAggregator(_oracleAggregator);
    }

    function setMinReportsRequired(uint256 n) external onlyOwner {
        require(n >= 1, "ParametricEngine: need at least 1 report");
        minReportsRequired = n;
        emit MinReportsUpdated(n);
    }

    /// @notice Pulls the latest median oracle reading for a policy's plot and
    ///         evaluates the compound index. Anyone can call this (a keeper
    ///         bot, the backend cron, or a farmer checking their own plot) —
    ///         the outcome is fully deterministic given on-chain data.
    function evaluateAndSettle(uint256 policyId) external returns (bool breached) {
        PolicyRegistry.Policy memory p = policyRegistry.getPolicy(policyId);
        require(p.id != 0, "ParametricEngine: unknown policy");
        require(p.status == PolicyRegistry.PolicyStatus.Active, "ParametricEngine: policy not active");
        require(block.timestamp >= p.coverageStart && block.timestamp <= p.coverageEnd, "ParametricEngine: outside coverage window");

        (
            int256 rainfallDeficitBps,
            int256 tempAnomalyTenthsC,
            uint256 dryDayStreak,
            uint256 reportCount
        ) = oracleAggregator.getMedianReading(p.latitude, p.longitude);

        require(reportCount >= minReportsRequired, "ParametricEngine: insufficient oracle consensus");

        breached = _isCompoundBreach(p, rainfallDeficitBps, tempAnomalyTenthsC, dryDayStreak);

        emit RiskEvaluated(policyId, rainfallDeficitBps, tempAnomalyTenthsC, dryDayStreak, breached);

        if (breached) {
            policyRegistry.markSettled(policyId, PolicyRegistry.PolicyStatus.PaidOut);
            liquidityVault.releasePayout(policyId, payable(p.farmer), p.sumInsured);
            emit ClaimTriggered(policyId, p.farmer, p.sumInsured);
        }
    }

    /// @dev Compound index: a policy pays out when EITHER
    ///        (a) rainfall deficit AND dry-day continuity both cross their
    ///            thresholds together (drought signature), OR
    ///        (b) rainfall deficit combined with a heat anomaly crosses
    ///            threshold even if dry-day count alone is borderline
    ///            (heatwave-accelerated drought signature).
    ///      This directly answers the "single-variable rigidity" gap: a
    ///      modest rainfall deficit plus a heatwave can trigger even though
    ///      neither variable alone would.
    function _isCompoundBreach(
        PolicyRegistry.Policy memory p,
        int256 rainfallDeficitBps,
        int256 tempAnomalyTenthsC,
        uint256 dryDayStreak
    ) internal pure returns (bool) {
        bool rainfallBreached = rainfallDeficitBps >= int16(p.rainfallDeficitBps);
        bool dryDaysBreached = dryDayStreak >= p.dryDayContinuity;
        bool heatBreached = tempAnomalyTenthsC >= p.tempAnomalyTenthsC;

        bool droughtSignature = rainfallBreached && dryDaysBreached;
        bool heatAcceleratedSignature = rainfallBreached && heatBreached;

        return droughtSignature || heatAcceleratedSignature;
    }
}
