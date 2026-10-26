/* RIGOR Explorer — community, read-only SPA.
   Data: public chain API via /api proxy (Cloudflare Pages Functions). */
(function () {
  "use strict";

  /* ---------- tiny helpers ---------- */
  const $ = (sel, el) => (el || document).querySelector(sel);
  const app = $("#app");

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null) continue;
        if (k === "class") el.className = v;
        else if (k === "text") el.textContent = v;
        else if (k === "html") el.innerHTML = v;
        else el.setAttribute(k, v);
      }
    }
    for (const kid of kids.flat()) {
      if (kid == null) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(kid));
    }
    return el;
  }

  async function api(path, opts) {
    const res = await fetch("/api/" + path.replace(/^\/+/, ""), {
      cache: "no-store",
      signal: (opts || {}).signal
    });
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.text()).slice(0, 300); } catch (_) {}
      const e = new Error("API " + res.status + " " + detail);
      e.status = res.status;
      throw e;
    }
    return res.json();
  }

  const fmt = {
    int: (n) => Number(n).toLocaleString("en-US"),
    age: (unix) => {
      const t = Number(unix);
      if (!t) return "—";
      const s = Math.max(0, Math.floor(Date.now() / 1000 - t));
      if (s < 60) return s + "s ago";
      if (s < 3600) return Math.floor(s / 60) + "m ago";
      if (s < 86400) return Math.floor(s / 3600) + "h ago";
      return Math.floor(s / 86400) + "d ago";
    },
    time: (unix) => {
      const t = Number(unix);
      return t ? new Date(t * 1000).toISOString().replace("T", " ").replace(".000Z", "Z") : "—";
    },
    short: (s, n) => {
      s = String(s || "");
      if (s.length <= (n || 18)) return s;
      return s.slice(0, (n || 18) / 2 + 2) + "…" + s.slice(-(n || 18) / 2);
    }
  };

  function setPill(state, text) {
    const pill = $("#pill");
    pill.className = "status-pill " + state;
    $("#pill-text").textContent = text;
  }

  function title(t) { document.title = t ? t + " — RIGOR Explorer" : "RIGOR Explorer"; }

  function breadcrumbs(parts) {
    const bc = h("div", { class: "breadcrumbs" });
    parts.forEach((p, i) => {
      if (i) bc.append(h("span", { class: "sep", text: "›" }));
      bc.append(p.href ? h("a", { href: p.href, text: p.text }) : h("span", { text: p.text }));
    });
    return bc;
  }

  function panel(tag, ...kids) {
    return h("div", { class: "panel" }, h("span", { class: "tag", text: tag }), ...kids);
  }

  function stat(k, v, sub) {
    return h("div", { class: "stat" },
      h("div", { class: "k", text: k }),
      h("div", { class: "v", text: v || "—" }),
      sub ? h("div", { class: "sub", text: sub }) : null);
  }

  function kvGrid(obj, opts) {
    const o = opts || {};
    const g = h("div", { class: "kv" });
    for (const [k, v] of Object.entries(obj)) {
      if (v === null || v === undefined || v === "") continue;
      g.append(h("div", { class: "k", text: k.replace(/_/g, " ") }));
      if (typeof v === "object") {
        g.append(h("div", { class: "v mono", text: JSON.stringify(v).slice(0, 200) }));
      } else if (o.linkKeys && o.linkKeys[k]) {
        g.append(h("div", { class: "v mono" }, h("a", { href: o.linkKeys[k](v), text: String(v) })));
      } else {
        g.append(h("div", { class: "v mono", text: String(v) }));
      }
    }
    return g;
  }

  function errorState(err, retry) {
    app.replaceChildren(h("div", { class: "wrap" },
      breadcrumbs([{ text: "Home", href: "#/" }, { text: "Error" }]),
      h("div", { class: "state" },
        h("div", { class: "big", text: "✕" }),
        h("h2", { text: "Could not load this page" }),
        h("p", { text: String(err.message || err).slice(0, 300) }),
        retry ? h("p", null, h("a", { href: retry, text: "← go back" })) : null)));
    setPill("bad", "OFFLINE");
  }

  function searchForm() {
    const wrap = h("div", { class: "searchbar", role: "search" });
    const input = h("input", { placeholder: "height, block hash, txid or rg1q… address", "aria-label": "Search the chain" });
    const go = h("button", { text: "RUN ▸" });
    wrap.append(h("span", { class: "promptch", text: "search>" }), input, go);
    const submit = () => {
      const q = input.value.trim();
      if (q) location.hash = "#/search/" + encodeURIComponent(q);
    };
    go.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
    return wrap;
  }

  /* ---------- live status ---------- */
  let lastTip = null;
  let pollTimer = null;

  async function pollStatus() {
    try {
      const st = await api("/status");
      const tip = st.economic_snapshot ? st.economic_snapshot.tip_height : (st.block_health && st.block_health.tip_height);
      if (tip != null) {
        if (lastTip !== null && String(tip) !== String(lastTip)) {
          onNewBlock(String(tip));
        }
        lastTip = String(tip);
      }
      setPill("ok", "LIVE · HEIGHT " + (lastTip || "…"));
    } catch (e) {
      setPill("bad", "API ERROR");
    }
  }
  function onNewBlock(tip) {
    const route = location.hash;
    if (route.startsWith("#/") && (route === "#/" || route === "" || route === "#/" || route.startsWith("#/blocks") || route.startsWith("#/stats"))) {
      routeTo(route, true);
    }
  }
  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollStatus();
    pollTimer = setInterval(pollStatus, 12000);
  }

  /* ---------- pages ---------- */

  async function pageHome() {
    title("Overview");
    setPill("warn", "CONNECTING");
    const [st, blocks] = await Promise.all([api("/status"), api("/blocks?limit=10")]);
    const es = st.economic_snapshot || {};
    const ma = st.mining_activity || {};
    const ci = st.chain_identity || {};
    const tip = es.tip_height;

    const root = h("div", { class: "wrap" });
    root.append(h("section", { class: "hero" },
      h("div", { class: "eyebrow", text: "RIGOR MAINNET · READ-ONLY" }),
      h("h1", null, "Every block, ", h("span", { class: "hl" }, "every transaction, in the open.")),
      h("p", { class: "lede", text: "Blocks, transactions, addresses, UTXOs and convergence activity on the RIGOR mainnet — read straight from the chain API. Nothing here is estimated by us: if the chain says it, you can check it." }),
      searchForm()));
    root.append(breadcrumbs([{ text: "Home" }]));

    // ribbon
    const ribbon = h("div", { class: "grid g4" });
    ribbon.append(
      stat("TIP HEIGHT", tip ? fmt.int(tip) : "—", "next subsidy 128 ORU"),
      stat("DIFFICULTY", st.block_health && st.block_health.difficulty ? st.block_health.difficulty : "—"),
      stat("HASHRATE (EST)", estHashrate(st), "SHA3-256 · ASERT"),
      stat("PEERS", ma.connections != null ? fmt.int(ma.connections) : "—", "mempool " + (ma.mempool_tx_count ?? "—") + " tx"));
    root.append(ribbon);

    // economy
    root.append(h("h2", { class: "sec", text: "MONETARY STATE" }));
    const econ = h("div", { class: "grid g3" });
    econ.append(
      panel("ORU SUPPLY", stat("CIRCULATING SPENDABLE", es.oru_circulating_spendable_display, "mature UTXOs only"), stat("COINBASE ISSUED TOTAL", es.oru_coinbase_total_display, es.oru_subsidy_schedule_display)),
      panel("BURNS", stat("CONVERGENCE BURNED", es.oru_burned_lifetime_display, "lifetime, destroyed for RES"), stat("FEE BURN (RFC-018)", es.rfc018_fee_burn ? es.rfc018_fee_burn.cumulative_burned_oru_display : "—")),
      panel("RES — SCARCE ASSET", stat("NETWORK RES MINTED", es.network_res_minted_display, "max supply 4,194,304 RES"), stat("COST TO MINT 1 RES", es.res_destroy_cost_display, "grows every block")));
    root.append(econ);

    // latest blocks
    root.append(h("h2", { class: "sec", text: "LATEST BLOCKS" }));
    root.append(blocksTable(blocks.blocks || [], 10));

    // convergence
    if (es.last_res_height) {
      root.append(h("h2", { class: "sec", text: "CONVERGENCE" }));
      root.append(panel("LAST RES MINT", kvGrid({
        block: es.last_res_height,
        txid: es.last_res_mint_txid,
        res_minted_total: es.res_minted_total_display,
        convergence_events: es.convergence_event_count
      }, { linkKeys: { txid: (v) => "#/tx/" + v } })));
    }

    app.replaceChildren(root);
    setPill("ok", "LIVE · HEIGHT " + (lastTip || tip));
  }

  function estHashrate(st) {
    try {
      const d = st.block_health && st.block_health.difficulty;
      if (!d) return "—";
      const bits = typeof d === "string" ? parseFloat(d) : d;
      const hps = bits * Math.pow(2, 32) / 600;
      if (hps > 1e9) return (hps / 1e9).toFixed(2) + " GH/s";
      if (hps > 1e6) return (hps / 1e6).toFixed(2) + " MH/s";
      return (hps / 1e3).toFixed(2) + " kH/s";
    } catch (e) { return "—"; }
  }

  function blocksTable(blocks, limit) {
    const rows = blocks.slice(0, limit || blocks.length);
    const tbl = h("div", { class: "tblwrap" });
    const t = h("table", { class: "tbl" });
    t.append(h("thead", null, h("tr", null,
      h("th", { text: "HEIGHT" }), h("th", { text: "AGE" }), h("th", { text: "TIME (UTC)" }),
      h("th", { text: "TX" }), h("th", { text: "ORU MINTED" }), h("th", { text: "CONVERGE BURN" }), h("th", { text: "HASH" }))));
    const tb = h("tbody");
    for (const b of rows) {
      tb.append(h("tr", null,
        h("td", null, h("a", { href: "#/block/" + b.height, text: "#" + b.height })),
        h("td", { text: fmt.age(b.time) }),
        h("td", { text: fmt.time(b.time) }),
        h("td", { text: String(b.tx_count ?? "—") }),
        h("td", { text: b.oru_minted_display || (b.oru_minted_atoms ? atomsToOru(b.oru_minted_atoms) + " ORU" : "—") }),
        h("td", { text: b.converge_burn_display || "—" }),
        h("td", { class: "hash" }, h("a", { href: "#/block/" + b.height, text: fmt.short(b.block_hash, 14), title: b.block_hash }))));
    }
    t.append(tb);
    tbl.append(t);
    return tbl;
  }

  function atomsToOru(atoms) {
    try { return (Number(BigInt(atoms)) / 1e8).toFixed(8); } catch (e) { return "?"; }
  }

  async function pageBlocks() {
    title("Blocks");
    const [st, blocks] = await Promise.all([api("/status"), api("/blocks?limit=100")]);
    const root = h("div", { class: "wrap" });
    root.append(breadcrumbs([{ text: "Home", href: "#/" }, { text: "Blocks" }]));
    root.append(h("h1", { class: "eyebrow", text: "RECENT BLOCKS" }));
    root.append(blocksTable(blocks.blocks || []));
    app.replaceChildren(root);
  }

  async function pageBlock(id) {
    title("Block " + id);
    const data = await api("/block/" + encodeURIComponent(id));
    const b = data.block || data;
    const root = h("div", { class: "wrap" });
    root.append(breadcrumbs([{ text: "Home", href: "#/" }, { text: "Blocks", href: "#/blocks" }, { text: "Block " + (b.height || id) }]));
    root.append(h("h1", { class: "eyebrow", text: "BLOCK #" + (b.height || id) }));

    const g = h("div", { class: "grid g2" });
    g.append(
      panel("HEADER", kvGrid({
        height: b.height,
        hash: b.block_hash,
        previous: b.previous_block_hash,
        time_utc: fmt.time(b.time),
        bits: b.bits,
        merkleroot: b.merkleroot,
        opus_hash: b.opus_hash
      }, { linkKeys: { previous: (v) => "#/block/" + v } })),
      panel("REWARD & CONVERGENCE", kvGrid({
        oru_minted: b.oru_minted_display,
        res_minted: b.res_minted_display,
        converge_burn: b.converge_burn_display,
        cumulative_convergence: b.cumulative_convergence,
        rigor_res_minted: b.rigor_res_minted
      })));
    root.append(g);
    root.append(panel("CONSENSUS", kvGrid({
      fingerprint_status: b.consensus_fingerprint_status,
      fingerprint: b.consensus_fingerprint_display || b.consensus_fingerprint,
      draw_candidate_root: b.draw_candidate_root,
      committed_root: b.committed_root,
      computed_root: b.computed_root,
      candidate_set_size: b.candidate_set_size
    })));
    app.replaceChildren(root);
  }

  async function pageTx(id) {
    title("Tx " + fmt.short(id, 12));
    const data = await api("/tx/" + encodeURIComponent(id));
    const t = data.tx || data;
    const root = h("div", { class: "wrap" });
    root.append(breadcrumbs([{ text: "Home", href: "#/" }, { text: "Block " + (t.block_height || "?"), href: t.block_height ? "#/block/" + t.block_height : null }, { text: "Tx" }]));
    root.append(h("h1", { class: "eyebrow", text: "TRANSACTION" }));

    root.append(panel("SUMMARY", kvGrid({
      txid: t.txid,
      wtxid: t.wtxid,
      block_height: t.block_height,
      block_tx_index: t.block_tx_index,
      is_coinbase: t.is_coinbase,
      version: t.version,
      locktime: t.locktime
    }, { linkKeys: { block_height: (v) => "#/block/" + v } })));

    if (t.raw_hex) {
      const details = h("details", null,
        h("summary", { text: "▸ raw transaction hex (" + t.raw_hex.length + " chars)" }),
        h("pre", { class: "mono", style: "white-space:pre-wrap;word-break:break-all;color:var(--dim);font-size:12px", text: t.raw_hex }));
      root.append(panel("RAW", details));
    }
    app.replaceChildren(root);
  }

  async function pageAddress(addr) {
    title("Address " + fmt.short(addr, 12));
    const data = await api("/address/" + encodeURIComponent(addr));
    const id = data.identity || {};
    const bal = data.balances || {};
    const us = data.utxo_summary || {};
    const ca = data.convergence_activity || {};
    const rm = data.res_mint_activity || {};
    const th = data.transaction_history || {};

    const root = h("div", { class: "wrap" });
    root.append(breadcrumbs([{ text: "Home", href: "#/" }, { text: "Address" }, { text: fmt.short(addr, 16) }]));
    root.append(h("h1", { class: "eyebrow", text: "ADDRESS" }));
    root.append(h("div", { class: "mono", style: "font-size:15px;color:var(--accent2);word-break:break-all;margin:2px 0 14px", text: addr }));

    // balances + identity
    const g1 = h("div", { class: "grid g3" });
    g1.append(
      panel("BALANCES", stat("ORU", bal.oru ? bal.oru.display : "—"), stat("RES", bal.res ? bal.res.display : "—")),
      panel("LIFETIME FLOWS", (() => {
        const o = us.oru || {};
        return h("div", null,
          stat("TOTAL RECEIVED", o.total_received),
          h("div", { style: "height:10px" }),
          stat("TOTAL SPENT", o.total_spent),
          h("div", { style: "height:10px" }),
          stat("CURRENT BALANCE", o.current_balance, (o.spendable_utxo_count ?? o.total_utxo_count) + " spendable UTXOs"));
      })()),
      panel("IDENTITY", kvGrid({
        type: id.address_type,
        classification: id.classification,
        first_seen: id.first_seen_block != null ? "block " + id.first_seen_block : "not seen yet",
        last_activity: id.latest_activity_block != null ? "block " + id.latest_activity_block : "—",
        indexer_height: (data.accounting || {}).indexer_height
      })));
    root.append(g1);

    // mining / convergence activity (RIGOR analogue of "miners behind an address")
    root.append(h("h2", { class: "sec", text: "CONVERGENCE & MINING ACTIVITY" }));
    const g2 = h("div", { class: "grid g3" });
    g2.append(
      panel("CONVERGENCE", stat("PARTICIPATED", ca.participated ? "YES" : "NO"),
        kvGrid({
          transactions: ca.convergence_transaction_count,
          mints: ca.mint_count,
          winner_roles: ca.winner_count,
          candidate_roles: ca.candidate_count
        })),
      panel("RES MINTED VIA THIS ADDRESS", stat("TOTAL", rm.total_res_minted_display || "0.00000000 RES"),
        kvGrid({ mints: rm.res_mint_count, latest_mint_block: rm.latest_mint_block })),
      panel("MINING NOTE", h("p", { class: "muted", text: "RIGOR has no mining pools: block rewards pay a miner's own rg1q address directly as coinbase UTXOs. Received coinbase outputs in the UTXO list below are mining payouts." })));
    root.append(g2);

    if (Array.isArray(ca.mint_txids) && ca.mint_txids.length) {
      root.append(panel("CONVERGENCE TXIDS", h("div", { class: "rows" },
        ca.mint_txids.slice(0, 10).map((t) => h("div", { class: "row" }, h("span", { class: "r1", text: "MINT" }), h("span", { class: "r2 mono" }, h("a", { href: "#/tx/" + t, text: fmt.short(t, 26) })))))));
    }
    if (Array.isArray(ca.winner_txids) && ca.winner_txids.length) {
      root.append(panel("WINNER ROLES", h("div", { class: "rows" },
        ca.winner_txids.slice(0, 10).map((t) => h("div", { class: "row" }, h("span", { class: "r1", text: "WIN" }), h("span", { class: "r2 mono" }, h("a", { href: "#/tx/" + t, text: fmt.short(t, 26) })))))));
    }

    // UTXOs
    const utxos = data.oru_utxos || [];
    root.append(h("h2", { class: "sec", text: "ORU UTXOS (" + utxos.length + ")" }));
    if (utxos.length) {
      const tbl = h("div", { class: "tblwrap" });
      const t = h("table", { class: "tbl" });
      t.append(h("thead", null, h("tr", null, h("th", { text: "TXID" }), h("th", { text: "VOUT" }), h("th", { text: "AMOUNT" }), h("th", { text: "STATUS" }))));
      const tb = h("tbody");
      for (const u of utxos.slice(0, 50)) {
        const txid = u.txid || u.outpoint || "";
        const vout = u.vout ?? (u.outpoint ? String(u.outpoint).split(":")[1] : "");
        tb.append(h("tr", null,
          h("td", { class: "hash" }, txid ? h("a", { href: "#/tx/" + txid, text: fmt.short(txid, 18), title: txid }) : "—"),
          h("td", { text: String(vout ?? "—") }),
          h("td", { text: u.amount_display || u.display || (u.amount_atoms ? atomsToOru(u.amount_atoms) + " ORU" : "—") }),
          h("td", { text: u.status || u.spendable ? String(u.status || (u.spendable ? "spendable" : "—")) : "—" })));
      }
      t.append(tb); tbl.append(t); root.append(tbl);
    } else {
      root.append(h("p", { class: "muted", text: "No unspent ORU outputs." }));
    }

    // transaction history
    const items = th.items || [];
    root.append(h("h2", { class: "sec", text: "TRANSACTION HISTORY" + (th.total ? " (" + th.total + ")" : "") }));
    if (items.length) {
      const tbl = h("div", { class: "tblwrap" });
      const t = h("table", { class: "tbl" });
      t.append(h("thead", null, h("tr", null, h("th", { text: "TXID" }), h("th", { text: "BLOCK" }), h("th", { text: "DIRECTION" }), h("th", { text: "VALUE" }))));
      const tb = h("tbody");
      for (const it of items) {
        tb.append(h("tr", null,
          h("td", { class: "hash" }, h("a", { href: "#/tx/" + (it.txid || ""), text: fmt.short(it.txid || "", 18) })),
          h("td", null, it.block_height ? h("a", { href: "#/block/" + it.block_height, text: "#" + it.block_height }) : "—"),
          h("td", { text: String(it.direction || it.role || "—") }),
          h("td", { text: String(it.value_display || it.amount_display || it.value || "—") })));
      }
      t.append(tb); tbl.append(t); root.append(tbl);
    } else {
      root.append(h("p", { class: "muted", text: "No transactions recorded for this address yet." }));
    }
    app.replaceChildren(root);
  }

  async function pageSearch(q) {
    title("Search");
    const root = h("div", { class: "wrap" });
    root.append(h("h1", { class: "eyebrow", text: "SEARCH" }));
    root.append(searchForm());

    if (!q) {
      root.append(h("p", { class: "muted", text: "Enter a block height, block hash, transaction id or an rg1q… address." }));
      app.replaceChildren(root);
      return;
    }
    root.append(h("p", { class: "muted", text: "query: " + q }));
    const res = h("div", { class: "grid g2" });
    root.append(res);
    app.replaceChildren(root);

    const isNum = /^\d+$/.test(q);
    const isHex64 = /^[0-9a-fA-F]{64}$/.test(q);
    const isAddr = /^(tr?g1|rg1)/.test(q);

    if (isNum) { location.hash = "#/block/" + q; return; }
    if (isAddr) { location.hash = "#/address/" + q; return; }
    if (isHex64) {
      // try tx first, then block hash
      try {
        await api("/tx/" + q);
        location.hash = "#/tx/" + q;
        return;
      } catch (e) {
        try {
          await api("/block/" + q);
          location.hash = "#/block/" + q;
          return;
        } catch (e2) {
          res.replaceChildren(h("div", { class: "state" }, h("h2", { text: "No match" }), h("p", { text: "That 64-hex string is neither a known transaction nor a block hash." })));
          return;
        }
      }
    }
    res.replaceChildren(h("div", { class: "state" }, h("h2", { text: "Unrecognized query" }),
      h("p", { text: "Try: a block height (e.g. 1150), a 64-char hash, or an address starting with rg1q." })));
  }

  async function pageAddressLookup() {
    title("Address lookup");
    const root = h("div", { class: "wrap" });
    root.append(h("h1", { class: "eyebrow", text: "ADDRESS LOOKUP" }));
    root.append(h("p", { class: "muted", text: "Paste any rg1q… address to see balances, UTXOs, received mining payouts and convergence activity." }));
    root.append(searchForm());
    root.append(panel("TIP", h("p", { class: "muted", text: "Mining payouts appear as coinbase UTXOs paid directly to the miner's rg1q address — RIGOR has no pools, so every reward address is also the miner." })));
    app.replaceChildren(root);
  }

  async function pageStats() {
    title("Stats");
    const [st, blocks] = await Promise.all([api("/status"), api("/blocks?limit=100")]);
    const es = st.economic_snapshot || {};
    const list = (blocks.blocks || []).slice().reverse(); // oldest → newest
    const root = h("div", { class: "wrap" });
    root.append(breadcrumbs([{ text: "Home", href: "#/" }, { text: "Stats" }]));
    root.append(h("h1", { class: "eyebrow", text: "NETWORK STATS" }));

    const s = h("div", { class: "grid g4" });
    s.append(
      stat("TIP", fmt.int(es.tip_height)),
      stat("TX IN LAST 100", fmt.int(list.reduce((a, b) => a + Number(b.tx_count || 0), 0))),
      stat("ORU MINTED LAST 100", (list.reduce((a, b) => a + Number((b.oru_minted_atoms || "0").replace?.call ? 0 : 0), 0), fmt.int(list.length * 128)) + " ORU", "128 ORU per block"),
      stat("RES MINTS LAST 100", fmt.int((es.res_mint_count_last_100 ?? "—"))));
    root.append(s);

    root.append(h("h2", { class: "sec", text: "TRANSACTIONS PER BLOCK (LAST " + list.length + ")" }));
    const c1 = h("canvas", { class: "chart" });
    root.append(c1);
    drawChart(c1, list.map((b) => Number(b.tx_count || 0)), "#4af6a3", "tx");

    root.append(h("h2", { class: "sec", text: "CONVERGENCE BURN PER BLOCK" }));
    const c2 = h("canvas", { class: "chart" });
    root.append(c2);
    drawChart(c2, list.map((b) => Number(atomsNum(b.converge_burn_atoms)) / 1e8), "#ffd166", "ORU burned");

    root.append(panel("SUPPLY SNAPSHOT", kvGrid({
      circulating_spendable: es.oru_circulating_spendable_display,
      coinbase_issued_total: es.oru_coinbase_total_display,
      immature_coinbase: es.oru_immature_coinbase_display,
      convergence_burned_lifetime: es.oru_burned_lifetime_display,
      res_minted_total: es.res_minted_total_display,
      subsidy: es.oru_subsidy_schedule_display
    })));

    app.replaceChildren(root);
  }

  function atomsNum(a) { try { return Number(BigInt(a || "0")); } catch (e) { return 0; } }

  function drawChart(canvas, series, color, unit) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 800;
    const hgt = 220;
    canvas.width = w * dpr; canvas.height = hgt * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, hgt);
    const max = Math.max(...series, 1);
    const n = series.length || 1;
    const pad = 24;
    // grid
    ctx.strokeStyle = "#17352a"; ctx.fillStyle = "#3f5c50"; ctx.font = "10px monospace";
    for (let i = 0; i <= 4; i++) {
      const y = pad + (hgt - 2 * pad) * i / 4;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      ctx.fillText((max * (1 - i / 4)).toPrecision(3), 2, y - 3);
    }
    // line
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath();
    series.forEach((v, i) => {
      const x = (i / (n - 1 || 1)) * (w - 8) + 4;
      const y = hgt - pad - (v / max) * (hgt - 2 * pad);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
    // fill
    ctx.globalAlpha = 0.12; ctx.fillStyle = color; ctx.beginPath();
    series.forEach((v, i) => {
      const x = (i / (n - 1 || 1)) * (w - 8) + 4;
      const y = hgt - pad - (v / max) * (hgt - 2 * pad);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.lineTo(w - 4, hgt - pad); ctx.lineTo(4, hgt - pad); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    const head = h("div", { class: "chart-head" }, h("span", null, h("span", { class: "sw", style: "background:" + color }), unit + " per block, oldest → newest"));
    canvas.after(head);
  }

  async function pageNetwork() {
    title("Network & API");
    const st = await api("/status");
    const ci = st.chain_identity || {};
    const ma = st.mining_activity || {};
    const root = h("div", { class: "wrap" });
    root.append(breadcrumbs([{ text: "Home", href: "#/" }, { text: "Network" }]));
    root.append(h("h1", { class: "eyebrow", text: "NETWORK" }));

    root.append(panel("CHAIN IDENTITY", kvGrid({
      chain: ci.chain_name,
      product: ci.product,
      codename: ci.codename,
      network: ci.network,
      genesis_hash: ci.genesis_hash
    })));
    root.append(panel("LIVE NODE STATE", kvGrid({
      connections: ma.connections,
      mempool_tx: ma.mempool_tx_count,
      note: ma.availability_note
    })));

    root.append(h("h2", { class: "sec", text: "PUBLIC API ENDPOINTS" }));
    const eps = [
      ["/api/status", "Chain identity, health, monetary snapshot, mining state"],
      ["/api/blocks?limit=N", "Most recent blocks (up to N)"],
      ["/api/block/{height|hash}", "Full block header and consensus data"],
      ["/api/tx/{txid}", "Transaction metadata and raw hex"],
      ["/api/address/{addr}", "Balances, UTXOs, history, convergence activity"]
    ];
    const tbl = h("div", { class: "tblwrap" });
    const t = h("table", { class: "tbl" });
    t.append(h("thead", null, h("tr", null, h("th", { text: "ENDPOINT" }), h("th", { text: "RETURNS" }))));
    const tb = h("tbody");
    for (const [e, d] of eps) {
      tb.append(h("tr", null,
        h("td", { class: "hash" }, h("a", { href: e, target: "_blank", rel: "noopener", text: e })),
        h("td", { text: d })));
    }
    t.append(tb); tbl.append(t);
    root.append(tbl);
    root.append(h("p", { class: "muted", text: "This explorer reads the same public API as the official explorer, through a thin read-only proxy (no keys, no writes). It is an independent community tool, not operated by the RIGOR project." }));
    app.replaceChildren(root);
  }

  /* ---------- router ---------- */
  const routes = [
    [/^#?\/?$/, () => pageHome()],
    [/^#\/blocks$/, () => pageBlocks()],
    [/^#\/block\/(.+)$/, (m) => pageBlock(decodeURIComponent(m[1]))],
    [/^#\/tx\/(.+)$/, (m) => pageTx(decodeURIComponent(m[1]))],
    [/^#\/address$/, () => pageAddressLookup()],
    [/^#\/address\/(.+)$/, (m) => pageAddress(decodeURIComponent(m[1]))],
    [/^#\/search(?:\/(.+))?$/, (m) => pageSearch(m[1] ? decodeURIComponent(m[1]) : "")],
    [/^#\/stats$/, () => pageStats()],
    [/^#\/network$/, () => pageNetwork()]
  ];

  let routeToken = 0;
  async function routeTo(hash, isRefresh) {
    const token = ++routeToken;
    if (!isRefresh) {
      app.replaceChildren(h("div", { class: "wrap loading" },
        h("span", { class: "skel" }), h("span", { class: "skel" }), h("span", { class: "skel" })));
    }
    const raw = (hash || "#/").split("?")[0];
    for (const [re, fn] of routes) {
      const m = raw.match(re);
      if (m) {
        // highlight nav
        const name = raw === "#/" || raw === "#" ? "home" : raw.replace(/^#\//, "").split("/")[0];
        document.querySelectorAll("[data-nav]").forEach((a) => {
          a.classList.toggle("active", a.dataset.nav === name);
        });
        try {
          await fn(m);
        } catch (err) {
          if (token === routeToken) errorState(err, "#/");
        }
        return;
      }
    }
    app.replaceChildren(h("div", { class: "wrap" }, h("div", { class: "state" },
      h("div", { class: "big", text: "404" }), h("h2", { text: "Unknown route" }),
      h("p", null, h("a", { href: "#/", text: "← back home" })))));
  }

  window.addEventListener("hashchange", () => routeTo(location.hash));
  window.addEventListener("DOMContentLoaded", () => {
    // mobile menu
    const burger = $("#burger");
    burger.addEventListener("click", () => {
      const menu = $("#menu");
      const open = menu.classList.toggle("open");
      burger.setAttribute("aria-expanded", String(open));
    });
    routeTo(location.hash);
    startPolling();
  });
})();
