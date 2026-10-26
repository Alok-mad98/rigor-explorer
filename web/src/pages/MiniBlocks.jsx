import React from "react";
import { fmt } from "../api.js";

export default function MiniBlocks({ blocks, openWin }) {
  if (!blocks || !blocks.length) return <div className="loading-pad">no blocks</div>;
  return (
    <div className="hscroll">
      <table className="browser-table">
        <thead>
          <tr><th>Height</th><th>Age</th><th>Time (UTC)</th><th>TX</th><th>ORU minted</th><th>Hash</th></tr>
        </thead>
        <tbody>
          {blocks.map((b) => (
            <tr key={b.height} onClick={() => openWin("block", { id: b.height })} style={{ cursor: "pointer" }}>
              <td><a href={"#/block/" + b.height} onClick={(e) => e.preventDefault()}>#{b.height}</a></td>
              <td>{fmt.age(b.time)}</td>
              <td>{fmt.utc(b.time)}</td>
              <td>{String(b.tx_count)}</td>
              <td>{b.oru_minted_display || "—"}</td>
              <td>{fmt.short(b.block_hash, 16)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
