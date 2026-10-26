import React, { useEffect, useState } from "react";
import { api, API_BASE } from "../api.js";

export default function NetworkPage({ setStatus }) {
  const [st, setSt] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await api("status");
        if (!alive) return;
        setSt(s);
        setStatus("network — " + (s.chain_identity ? s.chain_identity.network : "?"));
      } catch (e) { if (alive) setErr(e.message); }
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line

  if (err) return <div className="errbox"><div className="x">✖</div><p>{err}</p></div>;
  if (!st) return <div className="loading-pad"><span className="hg">◷</span> reading network…</div>;

  const ci = st.chain_identity || {};
  const ma = st.mining_activity || {};
  const sys = st.system_integrity || {};

  const eps = [
    ["GET /api/status", "chain identity, health, monetary snapshot, mining state"],
    ["GET /api/blocks?limit=N", "most recent N blocks"],
    ["GET /api/block/{height|hash}", "full block header + consensus data"],
    ["GET /api/tx/{txid}", "transaction metadata + raw hex"],
    ["GET /api/address/{addr}", "balances, UTXOs, history, convergence activity"],
  ];

  return (
    <div>
      <div className="group">
        <span className="legend">Chain identity</span>
        <div className="kv">
          <span className="k">chain</span><span className="v">{ci.chain_name || "RIGOR"}</span>
          <span className="k">product</span><span className="v">{ci.product || "—"}</span>
          <span className="k">codename</span><span className="v">{ci.codename || "—"}</span>
          <span className="k">network</span><span className="v">{ci.network || "mainnet"}</span>
          <span className="k">genesis</span><span className="v">{ci.genesis_hash || "—"}</span>
        </div>
      </div>

      <div className="group">
        <span className="legend">Live node state</span>
        <div className="kv">
          <span className="k">connections</span><span className="v">{String(ma.connections ?? "—")}</span>
          <span className="k">mempool</span><span className="v">{String(ma.mempool_tx_count ?? "—") + " tx"}</span>
          <span className="k">note</span><span className="v">{ma.availability_note || "—"}</span>
        </div>
      </div>

      <div className="group">
        <span className="legend">This explorer's stack</span>
        <div style={{ fontSize: 11, color: "#333", lineHeight: 1.6 }}>
          <b>Frontend:</b> React + Vite + Three.js, styled after the classic desktop look of the RIGOR website.<br />
          <b>Core logic:</b> Rust crate compiled to WebAssembly (query classification, atom math, window summaries) with a JS fallback.<br />
          <b>Backend:</b> Rust Cloudflare Worker proxying the public chain API (read-only, no keys).<br />
          <b>API base:</b> <span className="mono">{API_BASE}</span>
        </div>
      </div>

      <div className="group">
        <span className="legend">Public API endpoints (proxied)</span>
        <table className="browser-table">
          <thead><tr><th>Endpoint</th><th>Returns</th></tr></thead>
          <tbody>
            {eps.map(([e, d]) => (
              <tr key={e}>
                <td><a href={API_BASE + "/" + e.replace("GET ", "").split(" ")[0]} target="_blank" rel="noopener">{e}</a></td>
                <td style={{ whiteSpace: "normal" }}>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
