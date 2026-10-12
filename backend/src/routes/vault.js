const express = require("express");
const router = express.Router();
const blockchain = require("../services/blockchain");

// GET /api/vault/reserve -> public reserve-adequacy snapshot (Objective 04 / Novelty: On-Chain Auditability)
router.get("/reserve", async (req, res) => {
  try {
    const state = await blockchain.getReserveState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/vault/topup { amountEth }
router.post("/topup", async (req, res) => {
  try {
    const { amountEth } = req.body;
    if (!amountEth || Number(amountEth) <= 0) return res.status(400).json({ error: "amountEth must be > 0" });
    const result = await blockchain.topUpReserve(amountEth);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/vault/events -> on-chain-style audit log
router.get("/events", async (req, res) => {
  try {
    const events = await blockchain.getEvents(Number(req.query.limit) || 50);
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
