import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import BrowsePolicies from "./components/BrowsePolicies";
import EnrollProduct from "./components/EnrollProduct";
import PolicyList from "./components/PolicyList";
import OracleConsole from "./components/OracleConsole";
import FarmerOracleStatus from "./components/FarmerOracleStatus";
import ReservePanel from "./components/ReservePanel";
import OperatorOverview from "./components/OperatorOverview";
import ProductManager from "./components/ProductManager";
import { api } from "./api";

const FARMER_COPY = {
  browse: ["Browse insurance policies", "Compare products offered by insurance companies before choosing cover for your plot."],
  enroll: ["Enroll a plot", "Choose an insurance product, provide your plot details and accept the company's predefined terms."],
  ledger: ["My policies", "View your active and settled crop-insurance enrollments and coverage certificates."],
  oracle: ["Oracle status", "View the climate-monitoring status for your policy without controlling the oracle infrastructure."],
};
const OPERATOR_COPY = {
  overview: ["Operator dashboard", "Manage insurance products, monitor protocol operations and review reserve capacity."],
  products: ["Policy products", "Create the insurance products that farmers can browse and enroll into."],
  oracle: ["Oracle monitoring", "Operate autonomous climate monitoring and inspect multi-node oracle evidence."],
  reserve: ["Reserve pool", "Manage the liquidity backing active policies and inspect the on-chain audit trail."],
};

export default function App() {
  const [role, setRole] = useState("farmer");
  const [page, setPage] = useState("browse");
  const [demoMode, setDemoMode] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [oracleTargetId, setOracleTargetId] = useState(null);
  const farmerWallet = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

  useEffect(() => { api.health().then(h => setDemoMode(h.demoMode)).catch(() => setDemoMode(null)); }, []);

  function changeRole(next) {
    setRole(next);
    setOracleTargetId(next === "operator" ? 1 : null);
    setSelectedProduct(null);
    setPage(next === "farmer" ? "browse" : "overview");
  }
  function selectProduct(product) { setSelectedProduct(product); setPage("enroll"); }
  function enrolled(policy) { setOracleTargetId(policy.id); setPage("ledger"); }
  function goToOracle(policyId) { setOracleTargetId(policyId); setPage("oracle"); }

  const copy = (role === "farmer" ? FARMER_COPY : OPERATOR_COPY)[page];
  return <div className="app-shell">
    <Sidebar page={page} onNavigate={setPage} demoMode={demoMode} role={role} onRoleChange={changeRole} />
    <main className="main">
      <div className="page-header"><div className="eyebrow">{role === "farmer" ? "FARMER PORTAL" : "INSURANCE OPERATOR PORTAL"}</div><h1>{copy[0]}</h1><p>{copy[1]}</p></div>

      {role === "farmer" && page === "browse" && <BrowsePolicies onSelect={selectProduct} />}
      {role === "farmer" && page === "enroll" && <EnrollProduct product={selectedProduct} onDone={enrolled} onBack={() => setPage("browse")} />}
      {role === "farmer" && page === "ledger" && <PolicyList farmer={farmerWallet} onInspectInOracle={goToOracle} />}
      {role === "farmer" && page === "oracle" && <FarmerOracleStatus policyId={oracleTargetId} setPolicyId={setOracleTargetId} />}

      {role === "operator" && page === "overview" && <OperatorOverview onNavigate={setPage} />}
      {role === "operator" && page === "products" && <ProductManager />}
      {role === "operator" && page === "oracle" && <OracleConsole policyId={oracleTargetId} setPolicyId={setOracleTargetId} />}
      {role === "operator" && page === "reserve" && <ReservePanel />}
    </main>
  </div>;
}
