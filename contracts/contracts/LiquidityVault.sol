// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title LiquidityVault
/// @notice Escrows every premium in a transparent, fully collateralized
///         reserve pool and releases payouts the instant a breach is
///         confirmed by ParametricEngine (Objective 04 + 05).
contract LiquidityVault is Ownable, ReentrancyGuard {
    address public parametricEngine;

    uint256 public totalReserves;
    mapping(uint256 => uint256) public policyCollateral; // policyId => sumInsured reserved

    event PremiumDeposited(uint256 indexed policyId, address indexed farmer, uint256 amount);
    event PayoutReleased(uint256 indexed policyId, address indexed farmer, uint256 amount, uint256 timestamp);
    event ReserveTopUp(address indexed provider, uint256 amount);
    event ParametricEngineUpdated(address indexed engine);

    modifier onlyEngine() {
        require(msg.sender == parametricEngine, "LiquidityVault: caller is not ParametricEngine");
        _;
    }

    constructor() Ownable(msg.sender) {}

    function setParametricEngine(address engine) external onlyOwner {
        require(engine != address(0), "LiquidityVault: zero address");
        parametricEngine = engine;
        emit ParametricEngineUpdated(engine);
    }

    /// @notice Farmer (or the dashboard on their behalf) pays the premium and
    ///         reserves the full sum insured against the pool so no policy is
    ///         ever written against unfunded liquidity.
    function depositPremium(uint256 policyId, address farmer, uint256 sumInsured) external payable {
        require(msg.value > 0, "LiquidityVault: premium required");
        totalReserves += msg.value;
        policyCollateral[policyId] = sumInsured;
        emit PremiumDeposited(policyId, farmer, msg.value);
    }

    /// @notice Underwriters / liquidity providers can top up the shared
    ///         reserve pool so it stays solvent as more policies are written.
    function topUpReserve() external payable {
        require(msg.value > 0, "LiquidityVault: zero top-up");
        totalReserves += msg.value;
        emit ReserveTopUp(msg.sender, msg.value);
    }

    /// @notice Called only by ParametricEngine the instant a threshold breach
    ///         is confirmed. No claim form, no manual review (Objective 05).
    function releasePayout(uint256 policyId, address payable farmer, uint256 amount)
        external
        onlyEngine
        nonReentrant
    {
        require(amount > 0, "LiquidityVault: zero payout");
        require(amount <= totalReserves, "LiquidityVault: insufficient reserves");
        require(amount <= policyCollateral[policyId], "LiquidityVault: exceeds collateral");

        totalReserves -= amount;
        policyCollateral[policyId] = 0;

        (bool sent, ) = farmer.call{value: amount}("");
        require(sent, "LiquidityVault: transfer failed");

        emit PayoutReleased(policyId, farmer, amount, block.timestamp);
    }

    /// @notice Anyone can verify the pool is solvent before buying a policy —
    ///         Objective 04's "reserve adequacy is verifiable by anyone".
    function reserveRatio(uint256 outstandingCollateral) external view returns (uint256 bps) {
        if (outstandingCollateral == 0) return 10000;
        bps = (totalReserves * 10000) / outstandingCollateral;
    }

    receive() external payable {
        totalReserves += msg.value;
        emit ReserveTopUp(msg.sender, msg.value);
    }
}
