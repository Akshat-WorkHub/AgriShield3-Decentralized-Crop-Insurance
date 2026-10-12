// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title OracleAggregator
/// @notice Objective 02 — Multi-Node Oracle Aggregation. Independent nodes
///         (bridging OpenWeatherMap + NASA POWER data off-chain) each submit
///         a signed reading for a given plot; the contract stores every
///         submission and exposes the on-chain median so that no single feed
///         can move a payout decision (fixes the "single-oracle vulnerability"
///         research gap).
contract OracleAggregator is Ownable {
    struct Reading {
        int256 rainfallDeficitBps; // negative rainfall vs. baseline, in bps
        int256 tempAnomalyTenthsC; // anomaly vs. baseline, tenths of a degree C
        uint256 dryDayStreak; // consecutive dry days observed by this node
        uint64 timestamp;
    }

    mapping(address => bool) public isNode;
    address[] public nodes;

    // plotKey => node => latest reading
    mapping(bytes32 => mapping(address => Reading)) public submissions;
    mapping(bytes32 => address[]) private reportersOf;
    mapping(bytes32 => mapping(address => bool)) private hasReported;

    event NodeAuthorized(address indexed node);
    event NodeRevoked(address indexed node);
    event ReadingSubmitted(bytes32 indexed plotKey, address indexed node, int256 rainfallDeficitBps, int256 tempAnomalyTenthsC, uint256 dryDayStreak);

    modifier onlyNode() {
        require(isNode[msg.sender], "OracleAggregator: not an authorized node");
        _;
    }

    constructor() Ownable(msg.sender) {}

    function authorizeNode(address node) external onlyOwner {
        require(!isNode[node], "OracleAggregator: already authorized");
        isNode[node] = true;
        nodes.push(node);
        emit NodeAuthorized(node);
    }

    function revokeNode(address node) external onlyOwner {
        isNode[node] = false;
        emit NodeRevoked(node);
    }

    function plotKey(int256 latitude, int256 longitude) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(latitude, longitude));
    }

    /// @notice Independent oracle node reports the weather/satellite reading
    ///         it fetched for a plot. Multiple nodes report the same plot;
    ///         the median is taken at read time in getMedianReading().
    function submitReading(
        int256 latitude,
        int256 longitude,
        int256 rainfallDeficitBps,
        int256 tempAnomalyTenthsC,
        uint256 dryDayStreak
    ) external onlyNode {
        bytes32 key = plotKey(latitude, longitude);
        submissions[key][msg.sender] = Reading({
            rainfallDeficitBps: rainfallDeficitBps,
            tempAnomalyTenthsC: tempAnomalyTenthsC,
            dryDayStreak: dryDayStreak,
            timestamp: uint64(block.timestamp)
        });
        if (!hasReported[key][msg.sender]) {
            hasReported[key][msg.sender] = true;
            reportersOf[key].push(msg.sender);
        }
        emit ReadingSubmitted(key, msg.sender, rainfallDeficitBps, tempAnomalyTenthsC, dryDayStreak);
    }

    /// @notice Returns the median across every node that has reported this
    ///         plot. Median (not mean) so a single spiked/manipulated report
    ///         cannot swing the result.
    function getMedianReading(int256 latitude, int256 longitude)
        external
        view
        returns (int256 medianRainfallDeficitBps, int256 medianTempAnomalyTenthsC, uint256 medianDryDayStreak, uint256 reportCount)
    {
        bytes32 key = plotKey(latitude, longitude);
        address[] memory reporters = reportersOf[key];
        reportCount = reporters.length;
        require(reportCount > 0, "OracleAggregator: no reports for plot");

        int256[] memory rainfall = new int256[](reportCount);
        int256[] memory temp = new int256[](reportCount);
        uint256[] memory dryDays = new uint256[](reportCount);

        for (uint256 i = 0; i < reportCount; i++) {
            Reading memory r = submissions[key][reporters[i]];
            rainfall[i] = r.rainfallDeficitBps;
            temp[i] = r.tempAnomalyTenthsC;
            dryDays[i] = r.dryDayStreak;
        }

        _sortInt(rainfall);
        _sortInt(temp);
        _sortUint(dryDays);

        medianRainfallDeficitBps = _medianOfSortedInt(rainfall);
        medianTempAnomalyTenthsC = _medianOfSortedInt(temp);
        medianDryDayStreak = _medianOfSortedUint(dryDays);
    }

    function _sortInt(int256[] memory arr) private pure {
        for (uint256 i = 1; i < arr.length; i++) {
            int256 key = arr[i];
            uint256 j = i;
            while (j > 0 && arr[j - 1] > key) {
                arr[j] = arr[j - 1];
                j--;
            }
            arr[j] = key;
        }
    }

    function _sortUint(uint256[] memory arr) private pure {
        for (uint256 i = 1; i < arr.length; i++) {
            uint256 key = arr[i];
            uint256 j = i;
            while (j > 0 && arr[j - 1] > key) {
                arr[j] = arr[j - 1];
                j--;
            }
            arr[j] = key;
        }
    }

    function _medianOfSortedInt(int256[] memory sorted) private pure returns (int256) {
        uint256 n = sorted.length;
        if (n % 2 == 1) return sorted[n / 2];
        return (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    }

    function _medianOfSortedUint(uint256[] memory sorted) private pure returns (uint256) {
        uint256 n = sorted.length;
        if (n % 2 == 1) return sorted[n / 2];
        return (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    }
}
