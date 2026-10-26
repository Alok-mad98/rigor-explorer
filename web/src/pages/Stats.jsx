import React, { useEffect, useRef, useState } from "react";
import { api, atoms, fmt, summarize } from "../api.js";

export default function StatsPage({ setStatus }) {
  const [st, setSt] = useState(null);
  const [blocks, setBlocks] = useState(null);
  const c1 = useRef(null), c2 = useRef(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, b] = await Promise.all([api("status"), api("blocks?limit=100")]);
        if (!alive) return;
        setSt(s); setBlocks((b.blocks || []).slice().reverse());
        setStatus("statistics over the last " + (b.blocks || []).length + " blocks");
      } catch (e) { if (alive) setErr(e.message); }
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line

  // Rust core summary (or fallback inline)
  const sum = st && blocks ? summarize(JSON.stringify({ blocks: blocks.slice().reverse() }), JSON.stringify(st)) : null;

  useEffect(() => {
    if (!blocks || !blocks.length) return;
    const series = blocks.map((b) => Number(b.tx_count || 0));
    const burns = blocks.map((b) => {
      try { return Number(BigInt(b.converge_burn_atoms || "0")) / 1e8; } catch (_) { return 0; }
    });
    draw(c1.current, series, "#000080");
    draw(c2.current, burns, "#800000");
  }, [blocks]); // eslint-disable-line

  if (err) return <div className="errbox"><div className="x">✖</div><p>{err}</p></div>;
  if (!st || !blocks) return <div className="loading-pad"><span className="hg">◷</span> computing statistics…</div>;

  const es = st.economic_snapshot || {};
  const windowStats = sum || {
    window: {
      blocks: blocks.length,
      avg_tx_per_block: (blocks.reduce((a, b) => a + Number(b.tx_count || 0), 0) / blocks.length).toFixed(2),
    },
  };
  const w = windowStats.window || {};

  return (
    <div>
      <div className="group">
        <span className="legend">Window (last {blocks.length} blocks){sum ? " — computed in Rust/WASM" : ""}</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "14px 26px", padding: "2px" }}>
          <S k="Avg tx / block" v={String(w.avg_tx_per_block ?? "—")} />
          <S k="Avg interval" v={(w.avg_interval_seconds ?? "—") + (w.avg_interval_seconds ? "s" : "")} />
          <S k="Blocks / hour" v={String(w.blocks_per_hour ?? "—")} />
          <S k="Fee burn (window)" v={String(w.fee_burn_sum_oru ?? "—") + " ORU"} />
          <S k="Minted (window)" v={String(w.minted_sum_oru ?? "—") + " ORU"} />
        </div>
      </div>

      <div className="group">
        <span className="legend">Transactions per block</span>
        <canvas ref={c1} className="c95"></canvas>
      </div>

      <div className="group">
        <span className="legend">Convergence burn per block (ORU)</span>
        <canvas ref={c2} className="c95"></canvas>
      </div>

      <div className="group">
        <span className="legend">Supply snapshot</span>
        <div className="kv">
          <span className="k">circulating spendable</span><span className="v">{es.oru_circulating_spendable_display || "—"}</span>
          <span className="k">coinbase issued</span><span className="v">{es.oru_coinbase_total_display || "—"}</span>
          <span className="k">immature coinbase</span><span className="v">{es.oru_immature_coinbase_display || "—"}</span>
          <span className="k">convergence burned</span><span className="v">{es.oru_burned_lifetime_display || "—"}</span>
          <span className="k">RES minted</span><span className="v">{es.res_minted_total_display || "—"}</span>
          <span className="k">subsidy</span><span className="v">{es.oru_subsidy_schedule_display || "—"}</span>
        </div>
      </div>
    </div>
  );
}

function S({ k, v }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: 1 }}>{k}</div>
      <div className="mono" style={{ fontSize: 14, fontWeight: 700 }}>{v}</div>
    </div>
  );
}

function draw(canvas, series, color) {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth || 600, h = 160;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  const max = Math.max(...series, 0.000001);
  const pad = 14;
  ctx.strokeStyle = "#cccccc";
  ctx.beginPath();
  for (let i = 0; i <= 4; i++) {
    const y = pad + ((h - 2 * pad) * i) / 4;
    ctx.moveTo(0, y); ctx.lineTo(w, y);
  }
  ctx.stroke();
  ctx.fillStyle = "#555";
  ctx.font = "9px monospace";
  for (let i = 0; i <= 4; i++) {
    const y = pad + ((h - 2 * pad) * i) / 4;
    ctx.fillText(String(+(max * (1 - i / 4)).toPrecision(3)), 2, y - 2);
  }
  ctx.fillStyle = color;
  const n = series.length;
  const bw = Math.max(1, (w - 2 * pad) / n - 1);
  series.forEach((v, i) => {
    const bh = (v / max) * (h - 2 * pad);
    ctx.fillRect(pad + (i * (w - 2 * pad)) / n, h - pad - bh, bw, Math.max(bh, v > 0 ? 1 : 0));
  });
}
