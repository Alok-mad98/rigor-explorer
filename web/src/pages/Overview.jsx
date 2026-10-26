import React, { useEffect, useState } from "react";
import { api, atoms, fmt, classify, coreVersion } from "../api.js";
import MiniBlocks from "./MiniBlocks.jsx";

export default function Overview({ openWin, setStatus }) {
  const [st, setSt] = useState(null);
  const [blocks, setBlocks] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, b] = await Promise.all([api("status"), api("blocks?limit=10")]);
        if (!alive) return;
        setSt(s); setBlocks(b.blocks || []);
        setStatus("connected — tip #" + (s.economic_snapshot ? s.economic_snapshot.tip_height : "?"));
      } catch (e) { if (alive) setErr(e.message); }
    })();
    const i = setInterval(async () => {
      try {
        const s = await api("status");
        if (!alive) return;
        setSt(s); setErr(null);
      } catch (_) {}
    }, 15000);
    return () => { alive = false; clearInterval(i); };
  }, []); // eslint-disable-line

  if (err) return <div className="errbox"><div className="x">✖</div><p>Cannot reach the chain API.</p><p className="mono" style={{ fontSize: 11 }}>{err}</p></div>;
  if (!st) return <div className="loading-pad"><span className="hg">◷</span> contacting RIGOR mainnet…</div>;

  const es = st.economic_snapshot || {};
  const ma = st.mining_activity || {};
  const ci = st.chain_identity || {};
  const bh = st.block_health || {};

  const difficulty = bh.difficulty;
  let hashrate = "—";
  try {
    const d = typeof difficulty === "string" ? parseFloat(difficulty) : difficulty;
    if (d) {
      const hps = (d * Math.pow(2, 32)) / 600;
      hashrate = hps > 1e9 ? (hps / 1e9).toFixed(1) + " GH/s" : hps > 1e6 ? (hps / 1e6).toFixed(1) + " MH/s" : (hps / 1e3).toFixed(1) + " kH/s";
    }
  } catch (_) {}

  return (
    <div>
      <div className="group">
        <span className="legend">Network: {ci.chain_name || "RIGOR"} — {ci.network || "mainnet"}</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "14px 22px", padding: "4px 2px" }}>
          <Stat k="Tip height" v={"#" + (es.tip_height ?? "—")} />
          <Stat k="Difficulty" v={difficulty != null ? fmt.num(difficulty, 0) : "—"} />
          <Stat k="Hashrate (est)" v={hashrate} />
          <Stat k="Peers" v={ma.connections ?? "—"} />
          <Stat k="Mempool" v={(ma.mempool_tx_count ?? 0) + " tx"} />
          <Stat k="Core" v={coreVersion()} />
        </div>
      </div>

      <div className="group">
        <span className="legend">Monetary state</span>
        <div className="kv">
          <span className="k">ORU circulating (spendable)</span><span className="v">{es.oru_circulating_spendable_display || "—"}</span>
          <span className="k">Coinbase issued total</span><span className="v">{es.oru_coinbase_total_display || "—"}</span>
          <span className="k">Immature coinbase</span><span className="v">{es.oru_immature_coinbase_display || "—"}</span>
          <span className="k">Subsidy schedule</span><span className="v">{es.oru_subsidy_schedule_display || "—"}</span>
          <span className="k">Convergence burned (lifetime)</span><span className="v">{es.oru_burned_lifetime_display || "—"}</span>
          <span className="k">Fee burn (RFC-018)</span><span className="v">{es.rfc018_fee_burn ? es.rfc018_fee_burn.cumulative_burned_oru_display : "—"}</span>
          <span className="k">RES minted (network)</span><span className="v">{es.network_res_minted_display || "—"} <span style={{ color: "#666" }}>(max 4,194,304)</span></span>
          <span className="k">Cost to mint 1 RES</span><span className="v">{es.res_destroy_cost_display || "—"}</span>
        </div>
      </div>

      <div className="group">
        <span className="legend">Latest blocks</span>
        <MiniBlocks blocks={blocks} openWin={openWin} />
        <div style={{ textAlign: "right", marginTop: 4 }}>
          <button className="btn" onClick={() => openWin("blocks")}>Open all blocks →</button>
        </div>
      </div>

      <div className="group">
        <span className="legend">About this window</span>
        <div style={{ fontSize: 11, color: "#333", lineHeight: 1.5 }}>
          RIGOR pays <b>128 ORU</b> per block, forever, straight to the miner's own <span className="mono">rg1q…</span> address.
          There are no pools: every payout is a coinbase UTXO. Look up any address to see its payouts, or open
          the <b>Chain 3D</b> visualizer. Data: official public chain API via a Rust proxy worker — read-only.
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: 1 }}>{k}</div>
      <div className="mono" style={{ fontSize: 14, fontWeight: 700 }}>{v}</div>
    </div>
  );
}
