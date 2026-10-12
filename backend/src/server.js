const express = require("express");
const cors = require("cors");
const env = require("./config/env");

const policiesRouter = require("./routes/policies");
const oracleRouter = require("./routes/oracle");
const vaultRouter = require("./routes/vault");
const productsRouter = require("./routes/products");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", demoMode: env.demoMode, service: "agrishield3-backend" });
});

app.use("/api/policies", policiesRouter);
app.use("/api/oracle", oracleRouter);
app.use("/api/vault", vaultRouter);
app.use("/api/products", productsRouter);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(env.port, () => {
  console.log(`AgriShield3 backend listening on http://localhost:${env.port} (DEMO_MODE=${env.demoMode})`);
});
