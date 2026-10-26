import React, { useState, useEffect, useCallback, useRef } from "react";
import Window from "./Window.jsx";
import Overview from "./pages/Overview.jsx";
import Blocks from "./pages/Blocks.jsx";
import BlockPage from "./pages/Block.jsx";
import TxPage from "./pages/Tx.jsx";
import AddressPage from "./pages/Address.jsx";
import SearchPage from "./pages/Search.jsx";
import StatsPage from "./pages/Stats.jsx";
import NetworkPage from "./pages/Network.jsx";
import ChainScene from "./ChainScene.jsx";
import { api } from "./api.js";

const BOOT_LINES = [
  "RIGOR EXPLORER BIOS v1.0 — community build",
  "Network: RIGOR MAINNET",
  "",
  "Initializing system...... OK",
  "Checking protocol....... OK",
  "Loading Rust core....... OK",
  "Starting explorer....... OK",
  "",
];

const ICONS = [
  { kind: "overview", label: "My Computer", glyph: "pc" },
  { kind: "blocks", label: "Blocks", glyph: "blocks" },
  { kind: "chain3d", label: "Chain 3D", glyph: "cube" },
  { kind: "search", label: "Find", glyph: "find" },
  { kind: "address", label: "Address Book", glyph: "addr" },
  { kind: "stats", label: "Statistics", glyph: "chart" },
  { kind: "network", label: "Network", glyph: "net" },
];

function Glyph({ name }) {
  const common = { width: 34, height: 34, viewBox: "0 0 24 24", style: { display: "block" } };
  if (name === "pc")
    return (
      <svg {...common}>
        <rect x="2" y="3" width="20" height="13" fill="#c0c0c0" stroke="#000" />
        <rect x="4" y="5" width="16" height="9" fill="#006666" />
        <rect x="6" y="18" width="12" height="2" fill="#808080" stroke="#000" />
        <rect x="3" y="20" width="18" height="2" fill="#c0c0c0" stroke="#000" />
      </svg>
    );
  if (name === "blocks")
    return (
      <svg {...common}>
        <rect x="3" y="4" width="8" height="8" fill="#c0c0c0" stroke="#000" />
        <rect x="13" y="4" width="8" height="8" fill="#808080" stroke="#000" />
        <rect x="8" y="13" width="8" height="8" fill="#000080" stroke="#000" />
      </svg>
    );
  if (name === "cube")
    return (
      <svg {...common}>
        <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill="#006666" stroke="#000" />
        <polyline points="3,7 12,12 21,7" stroke="#000" fill="none" />
        <line x1="12" y1="12" x2="12" y2="22" stroke="#000" />
      </svg>
    );
  if (name === "find")
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="7" fill="#fff" stroke="#000" strokeWidth="2" />
        <line x1="15" y1="15" x2="22" y2="22" stroke="#000" strokeWidth="3" />
      </svg>
    );
  if (name === "addr")
    return (
      <svg {...common}>
        <rect x="3" y="2" width="18" height="20" fill="#dfdfdf" stroke="#000" />
        <rect x="6" y="6" width="12" height="2" fill="#808080" />
        <rect x="6" y="10" width="12" height="2" fill="#808080" />
        <rect x="6" y="14" width="8" height="2" fill="#808080" />
      </svg>
    );
  if (name === "chart")
    return (
      <svg {...common}>
        <rect x="2" y="2" width="20" height="20" fill="#fff" stroke="#000" />
        <rect x="5" y="12" width="3" height="7" fill="#000080" />
        <rect x="10" y="8" width="3" height="11" fill="#000080" />
        <rect x="15" y="5" width="3" height="14" fill="#000080" />
      </svg>
    );
  return (
    <svg {...common}>
      <rect x="2" y="4" width="20" height="14" fill="#c0c0c0" stroke="#000" />
      <rect x="4" y="6" width="16" height="10" fill="#006666" />
      <line x1="6" y1="9" x2="18" y2="9" stroke="#33ff99" />
      <line x1="6" y1="12" x2="15" y2="12" stroke="#33ff99" />
      <line x1="6" y1="15" x2="17" y2="15" stroke="#33ff99" />
    </svg>
  );
}

const TITLES = {
  overview: "My Computer — RIGOR Mainnet",
  blocks: "C:\\RIGOR\\BLOCKS",
  chain3d: "Chain Visualizer 3D",
  search: "Find: RIGOR Chain",
  address: "Address Lookup",
  stats: "Statistics",
  network: "Network Neighborhood",
  block: (p) => "Block #" + p.id,
  tx: (p) => "Transaction",
  addr: (p) => "Address",
};

const PAGES = {
  overview: Overview,
  blocks: Blocks,
  block: BlockPage,
  tx: TxPage,
  address: AddressPage,
  addr: AddressPage,
  search: SearchPage,
  stats: StatsPage,
  network: NetworkPage,
  chain3d: ChainScene,
};

export default function App() {
  const [booted, setBooted] = useState(false);
  const [lines, setLines] = useState(0);
  const [wins, setWins] = useState([]);
  const [zTop, setZTop] = useState(100);
  const [focused, setFocused] = useState(null);
  const [startOpen, setStartOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [clock, setClock] = useState("");
  const [chain, setChain] = useState({ ok: false, height: null });
  const seq = useRef(1);

  // boot animation
  useEffect(() => {
    if (booted) return;
    if (lines < BOOT_LINES.length) {
      const t = setTimeout(() => setLines((l) => l + 1), 180);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setBooted(true), 700);
    return () => clearTimeout(t);
  }, [lines, booted]);

  // clock
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    };
    tick();
    const i = setInterval(tick, 15000);
    return () => clearInterval(i);
  }, []);

  // chain status poll (tray LED + height)
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const st = await api("status");
        if (alive) setChain({ ok: true, height: st.economic_snapshot ? st.economic_snapshot.tip_height : null });
      } catch (e) {
        if (alive) setChain({ ok: false, height: null });
      }
    };
    poll();
    const i = setInterval(poll, 12000);
    return () => { alive = false; clearInterval(i); };
  }, []);

  const openWin = useCallback((kind, props, status) => {
    setWins((ws) => {
      const id = kind === "overview" || kind === "blocks" || kind === "search" || kind === "stats" || kind === "network" || kind === "chain3d" || kind === "address"
        ? kind : kind + ":" + String(props && props.id);
      const existing = ws.find((w) => w.id === id);
      setZTop((z) => z + 1);
      if (existing) {
        return ws.map((w) => w.id === id ? { ...w, min: false, z: zTop + 1 } : w);
      }
      const n = ws.length;
      const titleFn = TITLES[kind];
      const title = typeof titleFn === "function" ? titleFn(props || {}) : titleFn;
      return [...ws, {
        id, kind, props: props || {},
        title, status: status || "",
        x: 40 + (n % 7) * 26, y: 26 + (n % 7) * 24,
        w: Math.min(880, Math.max(560, Math.floor(window.innerWidth * 0.62))),
        h: Math.min(620, Math.max(420, Math.floor(window.innerHeight * 0.62))),
        z: zTop + 1, min: false, max: false,
      }];
    });
    setFocused(kind === "block" || kind === "tx" || kind === "addr"
      ? kind + ":" + String(props && props.id) : kind);
    setStartOpen(false);
  }, [zTop]);

  const closeWin = (id) => setWins((ws) => ws.filter((w) => w.id !== id));
  const minWin = (id) => setWins((ws) => ws.map((w) => w.id === id ? { ...w, min: true } : w));
  const maxWin = (id) => setWins((ws) => ws.map((w) => w.id === id ? { ...w, max: !w.max } : w));
  const focusWin = (id) => {
    setZTop((z) => z + 1);
    setFocused(id);
    setWins((ws) => ws.map((w) => w.id === id ? { ...w, z: zTop + 1, min: false } : w));
  };

  // open hash routes like #/block/123
  useEffect(() => {
    if (!booted) return;
    const route = location.hash.replace(/^#\/?/, "").split("/");
    if (route[0]) {
      const kindMap = { block: "block", tx: "tx", address: "addr", blocks: "blocks", search: "search", stats: "stats", network: "network", home: "overview" };
      const k = kindMap[route[0]];
      if (k) openWin(k, route[1] ? { id: decodeURIComponent(route[1]) } : {});
    } else {
      openWin("overview");
    }
  }, [booted]); // eslint-disable-line

  if (!booted) {
    return (
      <div className="boot" onClick={() => setBooted(true)}>
        {BOOT_LINES.slice(0, lines).map((l, i) => (
          <div key={i} className={l.includes("OK") ? "ok-line" : ""}>{l}</div>
        ))}
        {lines >= BOOT_LINES.length && (
          <div>C:\RIGOR\EXPLORER&gt;<span className="cursor">&nbsp;</span></div>
        )}
        {lines >= BOOT_LINES.length && <span className="press">[ click anywhere to continue ]</span>}
      </div>
    );
  }

  const startItems = [
    { label: "My Computer (Overview)", act: () => openWin("overview") },
    { label: "Blocks", act: () => openWin("blocks") },
    { label: "Chain Visualizer 3D", act: () => openWin("chain3d") },
    { label: "Find (Search)", act: () => openWin("search") },
    { label: "Address Lookup", act: () => openWin("address") },
    { label: "Statistics", act: () => openWin("stats") },
    { label: "Network Neighborhood", act: () => openWin("network") },
  ];

  return (
    <div className="desktop-root" onClick={() => { setStartOpen(false); setSelected(null); }}>
      <div className="desktop-surface">
        <div className="desktop-icons">
          <div className="desktop-col">
            {ICONS.map((ic) => (
              <div key={ic.kind}
                className={"dicon" + (selected === ic.kind ? " selected" : "")}
                onClick={(e) => { e.stopPropagation(); setSelected(ic.kind); }}
                onDoubleClick={() => openWin(ic.kind)}
                onTouchEnd={(e) => { e.stopPropagation(); openWin(ic.kind); }}>
                <div className="dicon-glyph"><Glyph name={ic.glyph} /></div>
                <div className="dicon-label">{ic.label}</div>
              </div>
            ))}
          </div>
        </div>

        {wins.map((w) => {
          const Page = PAGES[w.kind];
          return (
            <Window key={w.id} win={w} focused={focused === w.id}
              onFocus={focusWin} onClose={closeWin} onMin={minWin} onMax={maxWin}>
              <Page {...w.props} openWin={openWin} closeWin={() => closeWin(w.id)} setStatus={(s) => setWins((ws) => ws.map((x) => x.id === w.id ? { ...x, status: s } : x))} />
            </Window>
          );
        })}
      </div>

      {startOpen && (
        <div className="start-menu" onClick={(e) => e.stopPropagation()}>
          <div className="start-side">RIGOR 98</div>
          <div className="start-items">
            {startItems.map((it) => (
              <button key={it.label} className="sitem" onClick={it.act}>
                <span style={{ width: 20, textAlign: "center" }}>▪</span>{it.label}
              </button>
            ))}
            <div className="ssep" />
            <button className="sitem" onClick={() => window.open("https://www.rigorchain.com/", "_blank")}>
              <span style={{ width: 20, textAlign: "center" }}>↗</span>rigorchain.com
            </button>
            <button className="sitem" onClick={() => window.open("https://explorer.rigorchain.com/", "_blank")}>
              <span style={{ width: 20, textAlign: "center" }}>↗</span>Official Explorer
            </button>
            <button className="sitem" onClick={() => window.open("https://github.com/rigorchain/rigorchain", "_blank")}>
              <span style={{ width: 20, textAlign: "center" }}>↗</span>Source Code
            </button>
          </div>
        </div>
      )}

      <div className="taskbar" onClick={(e) => e.stopPropagation()}>
        <button className={"start-btn" + (startOpen ? " open" : "")} onClick={() => setStartOpen((s) => !s)}>
          <svg className="start-logo" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#006666" stroke="#000"/><text x="4" y="12" font-size="10" font-family="monospace" fill="#fff">R</text></svg>
          <span>Start</span>
        </button>
        <div className="task-btns">
          {wins.map((w) => (
            <button key={w.id}
              className={"taskb" + (focused === w.id && !w.min ? " active" : "")}
              onClick={() => (focused === w.id && !w.min ? minWin(w.id) : focusWin(w.id))}>
              <span style={{ width: 12, textAlign: "center" }}>▪</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.title}</span>
            </button>
          ))}
        </div>
        <div className="tray">
          <span className={"led " + (chain.ok ? "ok" : "bad")} title={chain.ok ? "Connected — RIGOR mainnet" : "Cannot reach chain API"} />
          <span className="mono" title="Tip height">H:{chain.height != null ? chain.height : "…"}</span>
          <span>{clock}</span>
        </div>
      </div>
    </div>
  );
}
