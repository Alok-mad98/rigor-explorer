import React, { useEffect, useState } from "react";
import { api, fmt, atoms } from "../api.js";

// Address lookup window. If no address given yet, shows a form.
export default function AddressPage({ id, openWin, closeWin, setStatus }) {
  const [addr, setAddr] = useState(id || "");
  const [input, setInput] = useState(id || "");
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  const lookup = async (a) => {
    if (!a) return;
    setLoading(true); setErr(null); setD(null);
    try {
      const r = await api("address/" + encodeURIComponent(a));
      setD(r);
      setStatus("address " + fmt.short(a, 20));
    } catch (e) {
      setErr(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { if (id) lookup(id); }, [id]); // eslint-disable-line

  const form = (
    <div style={{ padding: "18px 8px", textAlign: "center" }}>
      <div style={{ marginBottom: 12 }}>Enter an <b>rg1q…</b> address to see balances, UTXOs, mining payouts and convergence activity.</div>
      <div style={{ display: "flex", gap: 8, maxWidth: 520, margin: "0 auto" }}>
        <input className="field" value={input} spellCheck={false}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && lookup(input.trim())}
          placeholder="rg1q…" />
        <button className="btn" onClick={() => lookup(input.trim())}>Look up</button>
      </div>
      {id && err && (
        <div className="errbox">
          <div className="x">✖</div>
          <p>{err}</p>
          <button className="btn" onClick={closeWin}>OK</button>
        </div>
      )}
    </div>
  );

  if (!id && !d) return form;

  if (loading) return <div className="loading-pad"><span className="hg">◷</span> reading address…</div>;
  if (err && !d) return form;
  if (!d) return form;

  const idn = d.identity || {};
  const bal = d.balances || {};
  const us = d.utxo_summary || {};
  const ca = d.convergence_activity || {};
  const rm = d.res_mint_activity || {};
  const th = d.transaction_history || {};
  const utxos = d.oru_utxos || [];
  const items = (th && th.items) || [];

  return (
    <div>
      <div className="addr-bar">
        <span className="lbl">Address:</span>
        <span className="mono" style={{ fontSize: 11, wordBreak: "break-all", flex: 1 }}>{idn.address || addr}</span>
      </div>

      <div className="group">
        <span className="legend">Identity</span>
        <div className="kv">
          <span className="k">type</span><span className="v">{idn.address_type || "—"}</span>
          <span className="k">classification</span><span className="v">{idn.classification || "—"}</span>
          <span className="k">first seen</span><span className="v">{idn.first_seen_block != null ? "block #" + idn.first_seen_block : "not seen yet"}</span>
          <span className="k">last activity</span><span className="v">{idn.latest_activity_block != null ? "block #" + idn.latest_activity_block : "—"}</span>
        </div>
      </div>

      <div className="group">
        <span className="legend">Balances & lifetime flows</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "14px 26px", padding: "2px" }}>
          <Flow title="ORU balance" v={(bal.oru || {}).display || "—"} sub={"received " + ((us.oru || {}).total_received || "—") + " · spent " + ((us.oru || {}).total_spent || "—")} />
          <Flow title="RES balance" v={(bal.res || {}).display || "—"} sub={(us.res || {}).total_utxo_count + " outputs"} />
          <Flow title="Spendable UTXOs" v={String((us.oru || {}).spendable_utxo_count ?? "—")} sub={"of " + ((us.oru || {}).total_utxo_count ?? "—") + " total"} />
        </div>
      </div>

      <div className="group">
        <span className="legend">Mining payouts (no pools on RIGOR)</span>
        <div style={{ fontSize: 11, color: "#333", lineHeight: 1.5, marginBottom: 6 }}>
          RIGOR block rewards (128 ORU) are paid <b>directly</b> to the miner's own address as coinbase UTXOs.
          Total received below is the sum of everything this address ever got, including mining payouts.
        </div>
        <div className="kv">
          <span className="k">total received (ORU)</span><span className="v">{(us.oru || {}).total_received || "—"}</span>
          <span className="k">current balance (ORU)</span><span className="v">{(us.oru || {}).current_balance || "—"}</span>
        </div>
      </div>

      <div className="group">
        <span className="legend">Convergence activity</span>
        <div className="kv">
          <span className="k">participated</span><span className="v">{ca.participated ? "yes" : "no"}</span>
          <span className="k">transactions</span><span className="v">{String(ca.convergence_transaction_count ?? 0)}</span>
          <span className="k">RES mints</span><span className="v">{String(ca.mint_count ?? 0)}</span>
          <span className="k">winner roles</span><span className="v">{String(ca.winner_count ?? 0)}</span>
          <span className="k">candidate roles</span><span className="v">{String(ca.candidate_count ?? 0)}</span>
          <span className="k">RES minted via address</span><span className="v">{rm.total_res_minted_display || "0.00000000 RES"}</span>
        </div>
      </div>

      {utxos.length > 0 && (
        <div className="group">
          <span className="legend">ORU UTXOs ({utxos.length})</span>
          <div className="hscroll">
            <table className="browser-table">
              <thead><tr><th>TXID</th><th>Vout</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {utxos.slice(0, 60).map((u, i) => {
                  const txid = u.txid || (u.outpoint ? String(u.outpoint).split(":")[0] : "");
                  return (
                    <tr key={i} onClick={() => openWin("tx", { id: txid })} style={{ cursor: "pointer" }}>
                      <td>{fmt.short(txid, 20)}</td>
                      <td>{String(u.vout ?? u.vout_index ?? "—")}</td>
                      <td>{u.amount_display || (u.amount_atoms ? atoms(u.amount_atoms) : "—")}</td>
                      <td>{u.status || (u.spendable ? "spendable" : "—")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="group">
          <span className="legend">Transaction history{th.total ? " (" + th.total + ")" : ""}</span>
          <div className="hscroll">
            <table className="browser-table">
              <thead><tr><th>TXID</th><th>Block</th><th>Direction</th><th>Value</th></tr></thead>
              <tbody>
                {items.slice(0, 60).map((it, i) => (
                  <tr key={i} onClick={() => openWin("tx", { id: it.txid })} style={{ cursor: "pointer" }}>
                    <td>{fmt.short(it.txid, 20)}</td>
                    <td>#{it.block_height ?? "—"}</td>
                    <td>{String(it.direction || it.role || "—")}</td>
                    <td>{String(it.value_display || it.amount_display || it.value || "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {utxos.length === 0 && items.length === 0 && (
        <div className="loading-pad" style={{ color: "#555" }}>No indexed activity for this address yet.</div>
      )}
    </div>
  );
}

function Flow({ title, v, sub }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: 1 }}>{title}</div>
      <div className="mono" style={{ fontSize: 14, fontWeight: 700 }}>{v}</div>
      <div style={{ fontSize: 10, color: "#666" }}>{sub}</div>
    </div>
  );
}
