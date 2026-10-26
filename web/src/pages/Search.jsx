import React, { useEffect, useState } from "react";
import { api, classify, coreVersion } from "../api.js";

export default function SearchPage({ openWin, setStatus }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const run = async () => {
    const query = q.trim();
    if (!query) return;
    setBusy(true); setResult(null);
    const c = classify(query);
    try {
      if (c.kind === "height") {
        await api("block/" + c.value);
        openWin("block", { id: c.value });
      } else if (c.kind === "address") {
        openWin("addr", { id: c.value });
      } else if (c.kind === "hex64") {
        let found = false;
        try {
          await api("tx/" + c.value);
          openWin("tx", { id: c.value }); found = true;
        } catch (_) {
          try {
            await api("block/" + c.value);
            openWin("block", { id: c.value }); found = true;
          } catch (_) {}
        }
        if (!found) setResult({ err: "No transaction or block matches that 64-hex value." });
      } else {
        setResult({ err: "Unrecognized query. Try a block height (e.g. 1150), a 64-char hash, or an rg1q… address." });
      }
    } catch (e) {
      setResult({ err: e.message });
    }
    setBusy(false);
  };

  return (
    <div style={{ padding: "16px 10px", textAlign: "center" }}>
      <div style={{ marginBottom: 14 }}>
        <b>Find</b> anything on the RIGOR mainnet — a block height, block hash, transaction id, or an <span className="mono">rg1q…</span> address.
      </div>
      <div style={{ display: "flex", gap: 8, maxWidth: 560, margin: "0 auto" }}>
        <input className="field" value={q} spellCheck={false} autoFocus
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="e.g. 1150  ·  64-hex hash  ·  rg1q…" />
        <button className="btn" onClick={run} disabled={busy}>{busy ? "Working…" : "Find"}</button>
      </div>
      {result && (
        <div className="errbox">
          <div className="x">✖</div>
          <p>{result.err}</p>
          <button className="btn" onClick={() => setResult(null)}>OK</button>
        </div>
      )}
      <div style={{ marginTop: 18, fontSize: 10, color: "#555" }}>
        query classification runs in {coreVersion()} — Rust compiled to WebAssembly, with a JS fallback.
      </div>
    </div>
  );
}
