const express = require("express");
const router = express.Router();
const blockchain = require("../services/blockchain");
const oracleMonitor = require("../services/oracleMonitor");
const store = require("../data/store");

router.post("/:policyId/evaluate", async (req, res) => {
  try {
    const { scenario } = req.body || {};
    const live = Boolean(req.body?.live);
    const result = await blockchain.pollAndEvaluate(Number(req.params.policyId), scenario, { live });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/readings", async (req, res) => {
  const { lat, lon } = req.query;
  if (lat === undefined || lon === undefined) return res.status(400).json({ error: "lat and lon required" });
  res.json(store.getReadings(Number(lat), Number(lon)));
});

router.get("/monitor/status", (req, res) => {
  res.json(oracleMonitor.getStatus());
});

router.post("/monitor/start", (req, res) => {
  try { res.json(oracleMonitor.start()); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

router.post("/monitor/stop", (req, res) => {
  res.json(oracleMonitor.stop());
});

router.post("/monitor/run", async (req, res) => {
  try { res.json(await oracleMonitor.runCycle()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
