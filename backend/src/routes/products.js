const express = require("express");
const router = express.Router();
const blockchain = require("../services/blockchain");

// GET /api/products -> marketplace products visible to farmers
router.get("/", async (req, res) => {
  try { res.json(await blockchain.listProducts()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/products/:id
router.get("/:id", async (req, res) => {
  try {
    const product = await blockchain.getProduct(Number(req.params.id));
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/products -> operator creates an insurance product
router.post("/", async (req, res) => {
  try {
    const required = ["companyName", "productName", "cropType"];
    if (required.some((key) => !req.body?.[key])) {
      return res.status(400).json({ error: "companyName, productName and cropType are required" });
    }
    const product = await blockchain.createProduct(req.body);
    res.status(201).json(product);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/products/:id/status -> operator activates/deactivates its product
router.patch("/:id/status", async (req, res) => {
  try {
    const product = await blockchain.setProductActive(Number(req.params.id), req.body?.active);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
