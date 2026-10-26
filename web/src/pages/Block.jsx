import React, { useEffect, useState } from "react";
import { api, fmt } from "../api.js";

export default function BlockPage({ id, openWin, closeWin, setStatus }) {
  const [b, setB] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await api("block/" + encodeURIComponent(id));
        if (!alive) return;
        setB(d.block || d);
        setStatus("block #" + (d.block || d).height);
      } catch (e) { if (alive) setErr(e.message); }
    })();
    return () => { alive = false; };
  }, [id]); // eslint-disable-line

  if (err) return (
    <div className="errbox">
      <div className="x">✖</div>
      <p>Cannot find block <b className="mono">{String(id).slice(0, 24)}</b>.</p>
      <p className="mono" style={{ fontSize: 10, color: "#555" }}>{err}</p>
      <button className="btn" onClick={closeWin}>OK</button>
    </div>
  );
  if (!b) return <div className="loading-pad"><span className="hg">◷</span> loading block…</div>;

  const Row = ({ k, v, link }) => (
    <React.Fragment>
      <span className="k">{k}</span>
      <span className="v">
        {link ? <a href={link} onClick={(e) => { e.preventDefault(); link.startsWith("#/block/") ? openWin("block", { id: link.slice(8) }) : openWin("tx", { id: link.slice(5) }); }}>{v}</a> : v}
      </span>
    </React.Fragment>
  );

  return (
    <div>
      <div className="group">
        <span className="legend">Header</span>
        <div className="kv">
          <Row k="height" v={"#" + b.height} />
          <Row k="hash" v={b.block_hash} />
          <Row k="previous block" v={b.previous_block_hash ? fmt.short(b.previous_block_hash, 30) : "—"} link={b.previous_block_hash ? "#/block/" + b.previous_block_hash : null} />
          <Row k="time (UTC)" v={fmt.utc(b.time)} />
          <Row k="bits" v={b.bits} />
          <Row k="merkle root" v={b.merkleroot} />
          <Row k="opus hash" v={b.opus_hash} />
          <Row k="tx count" v={String(b.tx_count ?? "—")} />
        </div>
      </div>
      <div className="group">
        <span className="legend">Reward & convergence</span>
        <div className="kv">
          <Row k="ORU minted" v={b.oru_minted_display || "—"} />
          <Row k="RES minted" v={b.res_minted_display || "—"} />
          <Row k="convergence burn" v={b.converge_burn_display || "—"} />
          <Row k="cumulative convergence" v={b.cumulative_convergence != null ? String(b.cumulative_convergence) : "—"} />
          <Row k="res probability target" v={b.res_probability_target_display || b.res_probability_target || "—"} />
        </div>
      </div>
      <div className="group">
        <span className="legend">Consensus</span>
        <div className="kv">
          <Row k="fingerprint status" v={b.consensus_fingerprint_status || "—"} />
          <Row k="fingerprint" v={b.consensus_fingerprint_display || b.consensus_fingerprint || "—"} />
          <Row k="draw candidate root" v={b.draw_candidate_root || "—"} />
          <Row k="committed root" v={b.committed_root || "—"} />
          <Row k="computed root" v={b.computed_root || "—"} />
          <Row k="candidate set size" v={String(b.candidate_set_size ?? "—")} />
          <Row k="rigor winner" v={b.rigor_winner || "—"} />
        </div>
      </div>
    </div>
  );
}
