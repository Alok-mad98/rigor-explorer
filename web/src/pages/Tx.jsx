import React, { useEffect, useState } from "react";
import { api, fmt } from "../api.js";

export default function TxPage({ id, openWin, closeWin, setStatus }) {
  const [t, setT] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await api("tx/" + encodeURIComponent(id));
        if (!alive) return;
        setT(d.tx || d);
        setStatus("tx in block #" + (d.tx || d).block_height);
      } catch (e) { if (alive) setErr(e.message); }
    })();
    return () => { alive = false; };
  }, [id]); // eslint-disable-line

  if (err) return (
    <div className="errbox">
      <div className="x">✖</div>
      <p>Transaction not found.</p>
      <p className="mono" style={{ fontSize: 10, color: "#555", wordBreak: "break-all" }}>{String(id).slice(0, 80)}</p>
      <button className="btn" onClick={closeWin}>OK</button>
    </div>
  );
  if (!t) return <div className="loading-pad"><span className="hg">◷</span> loading transaction…</div>;

  return (
    <div>
      <div className="group">
        <span className="legend">Summary</span>
        <div className="kv">
          <span className="k">txid</span><span className="v">{t.txid}</span>
          <span className="k">wtxid</span><span className="v">{t.wtxid}</span>
          <span className="k">in block</span><span className="v"><a href="#/x" onClick={(e) => { e.preventDefault(); openWin("block", { id: t.block_height }); }}>#{t.block_height}</a> (index {String(t.block_tx_index ?? "—")})</span>
          <span className="k">coinbase</span><span className="v">{t.is_coinbase ? "yes — mining reward" : "no"}</span>
          <span className="k">version</span><span className="v">{String(t.version)}</span>
          <span className="k">locktime</span><span className="v">{String(t.locktime)}</span>
          <span className="k">block hash</span><span className="v">{t.block_hash}</span>
        </div>
      </div>
      {t.raw_hex && (
        <div className="group">
          <span className="legend">Raw hex (notepad)</span>
          <div className="term" style={{ maxHeight: 220 }}>{t.raw_hex}</div>
        </div>
      )}
    </div>
  );
}
