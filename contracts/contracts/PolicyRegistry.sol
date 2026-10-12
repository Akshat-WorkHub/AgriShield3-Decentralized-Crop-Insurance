// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title PolicyRegistry
/// @notice On-chain registry for insurance products and farmer enrollments.
///         Products are created by authorized insurers; farmers enroll their
///         plots into an existing product. Enrollment copies the immutable
///         product terms into the farmer's policy record.
contract PolicyRegistry is Ownable {
    enum PolicyStatus { Active, PaidOut, Expired }

    struct Product {
        uint256 id;
        address insurer;
        string companyName;
        string productName;
        string cropType;
        uint64 coverageDays;
        uint256 premium;
        uint256 sumInsured;
        uint16 rainfallDeficitBps;
        int16 tempAnomalyTenthsC;
        uint8 dryDayContinuity;
        bool active;
    }

    struct Policy {
        uint256 id;
        address farmer;
        address insurer;
        uint256 productId;
        int256 latitude;
        int256 longitude;
        string companyName;
        string productName;
        string cropType;
        uint64 coverageStart;
        uint64 coverageEnd;
        uint256 premium;
        uint256 sumInsured;
        uint16 rainfallDeficitBps;
        int16 tempAnomalyTenthsC;
        uint8 dryDayContinuity;
        PolicyStatus status;
        string certificateId;
    }

    uint256 public nextPolicyId = 1;
    uint256 public nextProductId = 1;

    mapping(uint256 => Product) public products;
    mapping(uint256 => Policy) public policies;
    mapping(address => uint256[]) public policiesByFarmer;
    mapping(address => uint256[]) public productsByInsurer;
    mapping(address => bool) public authorizedInsurers;

    address public parametricEngine;

    event InsurerAuthorized(address indexed insurer, bool authorized);
    event ProductCreated(uint256 indexed productId, address indexed insurer, string companyName, string productName);
    event ProductStatusUpdated(uint256 indexed productId, bool active);
    event PolicyRegistered(
        uint256 indexed policyId,
        address indexed farmer,
        string cropType,
        uint256 premium,
        uint256 sumInsured,
        string certificateId
    );
    event PolicySettled(uint256 indexed policyId, PolicyStatus status);
    event ParametricEngineUpdated(address indexed engine);

    modifier onlyEngine() {
        require(msg.sender == parametricEngine, "PolicyRegistry: caller is not ParametricEngine");
        _;
    }

    modifier onlyInsurer() {
        require(authorizedInsurers[msg.sender], "PolicyRegistry: insurer not authorized");
        _;
    }

    constructor() Ownable(msg.sender) {
        authorizedInsurers[msg.sender] = true;
    }

    function authorizeInsurer(address insurer, bool authorized) external onlyOwner {
        require(insurer != address(0), "PolicyRegistry: zero insurer");
        authorizedInsurers[insurer] = authorized;
        emit InsurerAuthorized(insurer, authorized);
    }

    function setParametricEngine(address engine) external onlyOwner {
        require(engine != address(0), "PolicyRegistry: zero address");
        parametricEngine = engine;
        emit ParametricEngineUpdated(engine);
    }

    /// @notice Insurance company creates a product that farmers can later buy.
    function createProduct(
        string calldata companyName,
        string calldata productName,
        string calldata cropType,
        uint64 coverageDays,
        uint256 premium,
        uint256 sumInsured,
        uint16 rainfallDeficitBps,
        int16 tempAnomalyTenthsC,
        uint8 dryDayContinuity
    ) external onlyInsurer returns (uint256 productId) {
        require(bytes(companyName).length > 0, "PolicyRegistry: company required");
        require(bytes(productName).length > 0, "PolicyRegistry: product required");
        require(coverageDays > 0, "PolicyRegistry: bad coverage days");
        require(premium > 0, "PolicyRegistry: zero premium");
        require(sumInsured > 0, "PolicyRegistry: zero sum insured");

        productId = nextProductId++;
        products[productId] = Product({
            id: productId,
            insurer: msg.sender,
            companyName: companyName,
            productName: productName,
            cropType: cropType,
            coverageDays: coverageDays,
            premium: premium,
            sumInsured: sumInsured,
            rainfallDeficitBps: rainfallDeficitBps,
            tempAnomalyTenthsC: tempAnomalyTenthsC,
            dryDayContinuity: dryDayContinuity,
            active: true
        });
        productsByInsurer[msg.sender].push(productId);
        emit ProductCreated(productId, msg.sender, companyName, productName);
    }

    function setProductActive(uint256 productId, bool active) external {
        Product storage product = products[productId];
        require(product.id != 0, "PolicyRegistry: unknown product");
        require(msg.sender == product.insurer || msg.sender == owner(), "PolicyRegistry: not product owner");
        product.active = active;
        emit ProductStatusUpdated(productId, active);
    }

    function getProduct(uint256 productId) external view returns (Product memory) {
        return products[productId];
    }

    function getInsurerProducts(address insurer) external view returns (uint256[] memory) {
        return productsByInsurer[insurer];
    }

    /// @notice Farmer enrolls a plot into an existing insurer product.
    ///         Product terms are copied into the policy and cannot be changed.
    function enrollProduct(
        uint256 productId,
        address farmer,
        int256 latitude,
        int256 longitude,
        string calldata certificateId
    ) external returns (uint256 policyId) {
        Product memory product = products[productId];
        require(product.id != 0, "PolicyRegistry: unknown product");
        require(product.active, "PolicyRegistry: product inactive");
        require(farmer != address(0), "PolicyRegistry: zero farmer");

        uint64 start = uint64(block.timestamp);
        uint64 end = start + product.coverageDays * 1 days;
        policyId = nextPolicyId++;
        policies[policyId] = Policy({
            id: policyId,
            farmer: farmer,
            insurer: product.insurer,
            productId: product.id,
            latitude: latitude,
            longitude: longitude,
            companyName: product.companyName,
            productName: product.productName,
            cropType: product.cropType,
            coverageStart: start,
            coverageEnd: end,
            premium: product.premium,
            sumInsured: product.sumInsured,
            rainfallDeficitBps: product.rainfallDeficitBps,
            tempAnomalyTenthsC: product.tempAnomalyTenthsC,
            dryDayContinuity: product.dryDayContinuity,
            status: PolicyStatus.Active,
            certificateId: certificateId
        });
        policiesByFarmer[farmer].push(policyId);
        emit PolicyRegistered(policyId, farmer, product.cropType, product.premium, product.sumInsured, certificateId);
    }

    /// @notice Legacy registration retained for compatibility with the original prototype.
    function registerPolicy(
        address farmer,
        int256 latitude,
        int256 longitude,
        string calldata cropType,
        uint64 coverageStart,
        uint64 coverageEnd,
        uint256 premium,
        uint256 sumInsured,
        uint16 rainfallDeficitBps,
        int16 tempAnomalyTenthsC,
        uint8 dryDayContinuity,
        string calldata certificateId
    ) external returns (uint256 policyId) {
        require(farmer != address(0), "PolicyRegistry: zero farmer");
        require(coverageEnd > coverageStart, "PolicyRegistry: bad coverage window");
        require(sumInsured > 0, "PolicyRegistry: zero sum insured");

        policyId = nextPolicyId++;
        policies[policyId] = Policy({
            id: policyId,
            farmer: farmer,
            insurer: address(0),
            productId: 0,
            latitude: latitude,
            longitude: longitude,
            companyName: "",
            productName: "Legacy policy",
            cropType: cropType,
            coverageStart: coverageStart,
            coverageEnd: coverageEnd,
            premium: premium,
            sumInsured: sumInsured,
            rainfallDeficitBps: rainfallDeficitBps,
            tempAnomalyTenthsC: tempAnomalyTenthsC,
            dryDayContinuity: dryDayContinuity,
            status: PolicyStatus.Active,
            certificateId: certificateId
        });
        policiesByFarmer[farmer].push(policyId);
        emit PolicyRegistered(policyId, farmer, cropType, premium, sumInsured, certificateId);
    }

    function markSettled(uint256 policyId, PolicyStatus status) external onlyEngine {
        require(policies[policyId].id != 0, "PolicyRegistry: unknown policy");
        policies[policyId].status = status;
        emit PolicySettled(policyId, status);
    }

    function getPolicy(uint256 policyId) external view returns (Policy memory) {
        return policies[policyId];
    }

    function getFarmerPolicies(address farmer) external view returns (uint256[] memory) {
        return policiesByFarmer[farmer];
    }
}
