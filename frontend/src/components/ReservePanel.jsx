import { useEffect, useState } from "react";
import { api } from "../api";

function timeAgo(iso) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default function ReservePanel() {
  const [reserve, setReserve] = useState(null);
  const [events, setEvents] = useState([]);
  const [topUpAmount, setTopUpAmount] = useState(1);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [r, e] = await Promise.all([api.getReserve(), api.getEvents(40)]);
      setReserve(r);
      setEvents(e);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleTopUp() {
    setBusy(true);
    setError(null);
    try {
      await api.topUpReserve(Number(topUpAmount));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const ratioPct = reserve ? Math.max(0, Math.round(reserve.reserveRatioBps / 100)) : null;

  return (
    <>
      <div className="panel">
        <div className="panel-title">Reserve pool</div>
        <div className="panel-hint">
          Premiums and operator-provided liquidity fund this shared on-chain pool. It backs active policies and is used for automatic payouts when the parametric trigger is breached.
        </div>

        {error && <div className="banner error">{error}</div>}

        {reserve && (
          <div className="stat-row">
            <div className="stat-box">
              <div className="label">Total pool liquidity</div>
              <div className="value">{Number(reserve.totalReserves).toFixed(4)} ETH</div>
            </div>
            <div className="stat-box">
              <div className="label">Committed coverage</div>
              <div className="value">{Number(reserve.outstandingCollateral).toFixed(4)} ETH</div>
            </div>
            <div className="stat-box">
              <div className="label">Available liquidity</div>
              <div className="value">{Number(reserve.availableLiquidity ?? (Number(reserve.totalReserves)-Number(reserve.outstandingCollateral||0))).toFixed(4)} ETH</div>
            </div>
            <div className="stat-box">
              <div className="label">Reserve coverage ratio</div>
              <div className="value">{ratioPct}%</div>
            </div>
          </div>
        )}

        <div className="btn-row" style={{ alignItems: "center" }}>
          <input
            type="number"
            step="0.01"
            style={{ border: "1px solid var(--border-strong)", borderRadius: 3, padding: "8px 10px", width: 120 }}
            value={topUpAmount}
            onChange={(e) => setTopUpAmount(e.target.value)}
          />
          <button className="btn btn-primary" onClick={handleTopUp} disabled={busy}>
            {busy ? "Sending…" : "Top up reserve"}
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Audit log</div>
        <div className="panel-hint">Append-only record of every policy, oracle submission and payout — the on-chain auditability trail.</div>
        <div className="event-log">
          {events.length === 0 && <div className="empty-state">No activity yet.</div>}
          {events.map((ev) => (
            <div className="event-row" key={ev.id}>
              <div className="event-type">{ev.type}</div>
              <div className="event-time">{timeAgo(ev.timestamp)}</div>
              <div className="event-payload">{JSON.stringify(ev.payload)}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
