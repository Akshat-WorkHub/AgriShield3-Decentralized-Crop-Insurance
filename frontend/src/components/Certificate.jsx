import StatusTag from "./StatusTag";

function fmtDate(unixSeconds) {
  if (!unixSeconds) return "—";
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function Certificate({ policy }) {
  if (!policy) return null;
  return (
    <div className="certificate">
      <div className="certificate-id">{policy.certificateId}</div>
      <div className="kv-grid">
        <div className="kv">
          <span className="k">Farmer</span>
          <span className="v">{policy.farmer.slice(0, 6)}…{policy.farmer.slice(-4)}</span>
        </div>
        <div className="kv">
          <span className="k">Status</span>
          <span className="v">
            <StatusTag status={policy.status} />
          </span>
        </div>
        <div className="kv">
          <span className="k">Insurance company</span>
          <span className="v">{policy.companyName || "—"}</span>
        </div>
        <div className="kv">
          <span className="k">Product</span>
          <span className="v">{policy.productName || "—"}</span>
        </div>
        <div className="kv">
          <span className="k">Crop</span>
          <span className="v">{policy.cropType}</span>
        </div>
        <div className="kv">
          <span className="k">Plot</span>
          <span className="v">
            {Number(policy.latitude).toFixed(4)}, {Number(policy.longitude).toFixed(4)}
          </span>
        </div>
        <div className="kv">
          <span className="k">Coverage window</span>
          <span className="v">
            {fmtDate(policy.coverageStart)} – {fmtDate(policy.coverageEnd)}
          </span>
        </div>
        <div className="kv">
          <span className="k">Sum insured</span>
          <span className="v">{policy.sumInsured} native token</span>
        </div>
        <div className="kv">
          <span className="k">Premium paid</span>
          <span className="v">{policy.premium} native token</span>
        </div>
        <div className="kv">
          <span className="k">Rainfall trigger</span>
          <span className="v">{(policy.rainfallDeficitBps / 100).toFixed(0)}% deficit</span>
        </div>
        <div className="kv">
          <span className="k">Heat trigger</span>
          <span className="v">+{(policy.tempAnomalyTenthsC / 10).toFixed(1)}°C</span>
        </div>
        <div className="kv">
          <span className="k">Dry-day trigger</span>
          <span className="v">{policy.dryDayContinuity} days</span>
        </div>
        {policy.status === "PaidOut" && (
          <div className="kv">
            <span className="k">Payout released</span>
            <span className="v">{policy.payoutAmount} native token</span>
          </div>
        )}
      </div>
    </div>
  );
}
