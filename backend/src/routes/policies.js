const express = require("express");
const router = express.Router();
const blockchain = require("../services/blockchain");

// POST /api/policies/enroll -> farmer enrolls a plot into an existing product
router.post("/enroll", async (req, res) => {
  try {
    const { productId, farmer, latitude, longitude } = req.body || {};
    if (!productId || !farmer || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: "productId, farmer, latitude and longitude are required" });
    }
    const policy = await blockchain.enrollProduct({
      productId: Number(productId), farmer, latitude: Number(latitude), longitude: Number(longitude),
    });
    res.status(201).json(policy);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/policies -> register a new policy (Proposed Solution Step 01)
router.post("/", async (req, res) => {
  try {
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
    } = req.body;

    if (!farmer || latitude === undefined || longitude === undefined || !cropType) {
      return res.status(400).json({ error: "farmer, latitude, longitude and cropType are required" });
    }

    const policy = await blockchain.registerPolicy({
      farmer,
      latitude: Number(latitude),
      longitude: Number(longitude),
      cropType,
      coverageDays: Number(coverageDays) || 120,
      premiumEth: Number(premiumEth) || 0.01,
      sumInsuredEth: Number(sumInsuredEth) || 1,
      rainfallDeficitPct: Number(rainfallDeficitPct) || 40,
      tempAnomalyC: Number(tempAnomalyC) || 5,
      dryDayContinuity: Number(dryDayContinuity) || 10,
    });

    res.status(201).json(policy);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/policies?farmer=0x... -> list policies (optionally by farmer)
router.get("/", async (req, res) => {
  try {
    const policies = await blockchain.listPolicies(req.query.farmer);
    res.json(policies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/policies/:id -> single policy + certificate
router.get("/:id", async (req, res) => {
  try {
    const policy = await blockchain.getPolicy(req.params.id);
    if (!policy) return res.status(404).json({ error: "Policy not found" });
    res.json(policy);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
