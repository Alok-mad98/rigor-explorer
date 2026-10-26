import React, { useEffect, useState } from "react";
import { api, fmt } from "../api.js";

export default function Blocks({ openWin, setStatus }) {
  const [blocks, setBlocks] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const b = await api("blocks?limit=100");
        if (!alive) return;
        setBlocks(b.blocks || []);
        setStatus("100 most recent blocks — live refresh every 30s");
      } catch (e) { if (alive) setErr(e.message); }
    })();
    const i = setInterval(async () => {
      try {
        const b = await api("blocks?limit=100");
        if (alive) setBlocks(b.blocks || []);
      } catch (_) {}
    }, 30000);
    return () => { alive = false; clearInterval(i); };
  }, []); // eslint-disable-line

  if (err) return <div className="errbox"><div className="x">✖</div><p>{err}</p></div>;
  if (!blocks) return <div className="loading-pad"><span className="hg">◷</span> loading blocks…</div>;

  return (
    <div>
      <div className="addr-bar">
        <span className="lbl">C:\RIGOR\BLOCKS</span>
        <span className="mono" style={{ fontSize: 10, color: "#555" }}>{blocks.length} blocks listed</span>
      </div>
      <div className="hscroll">
        <table className="browser-table">
          <thead>
            <tr>
              <th>Height</th><th>Age</th><th>Time (UTC)</th><th>TX</th>
              <th>ORU minted</th><th>Converge burn</th><th>RES minted</th><th>Hash</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((b) => (
              <tr key={b.height} onClick={() => openWin("block", { id: b.height })} style={{ cursor: "pointer" }}>
                <td><a href={"#/block/" + b.height} onClick={(e) => e.preventDefault()}>#{b.height}</a></td>
                <td>{fmt.age(b.time)}</td>
                <td>{fmt.utc(b.time)}</td>
                <td>{String(b.tx_count)}</td>
                <td>{b.oru_minted_display || "—"}</td>
                <td>{b.converge_burn_display || "—"}</td>
                <td>{b.res_minted_display || "—"}</td>
                <td>{fmt.short(b.block_hash, 18)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
