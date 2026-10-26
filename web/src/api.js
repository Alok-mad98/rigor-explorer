// API client + Rust/WASM core loader.
// The backend is a Rust Cloudflare Worker (rigor-explorer-api).
// The core logic crate (Rust -> WASM, /core) is loaded here; if WASM
// is unavailable the equivalent JS fallback keeps everything working.

export const API_BASE = "https://rigor-explorer-api.arechampionw.workers.dev/api";

export async function api(path) {
  const res = await fetch(API_BASE + "/" + String(path).replace(/^\/+/, ""), {
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.text()).slice(0, 200); } catch (_) {}
    const e = new Error("API " + res.status + (detail ? " — " + detail : ""));
    e.status = res.status;
    throw e;
  }
  return res.json();
}

/* ---------------- rust/wasm core ---------------- */
let core = null;
let coreReady = (async () => {
  try {
    const mod = await import("./wasm/explorer_core.js");
    await mod.default();
    core = mod;
  } catch (e) {
    console.warn("wasm core unavailable, using JS fallback", e);
  }
})();

export async function waitCore() { await coreReady; return core; }

export function coreVersion() {
  return core ? core.version() : "js-fallback";
}

/** Classify a search query. Returns {kind, value}. */
export function classify(q) {
  q = String(q || "").trim();
  if (core && core.classify_query) {
    try { return JSON.parse(core.classify_query(q)); } catch (_) {}
  }
  if (!q) return { kind: "empty", value: "" };
  if (/^\d{1,12}$/.test(q)) return { kind: "height", value: q };
  if (/^0x[0-9a-fA-F]{64}$/.test(q)) return { kind: "hex64", value: q.slice(2).toLowerCase() };
  if (/^[0-9a-fA-F]{64}$/.test(q)) return { kind: "hex64", value: q.toLowerCase() };
  if (/^(rg1|trg1)/.test(q)) return { kind: "address", value: q };
  return { kind: "unknown", value: q };
}

/** Format chain atoms (1e8) as a decimal amount string. */
export function atoms(str, unit) {
  unit = unit || "ORU";
  if (core && core.format_atoms) {
    try { return core.format_atoms(String(str || "0"), unit, 8); } catch (_) {}
  }
  try {
    const a = BigInt(String(str || "0"));
    const neg = a < 0n;
    const abs = neg ? -a : a;
    let out;
    if (abs < 100000000n) {
      out = "0." + abs.toString().padStart(8, "0");
    } else {
      const s = abs.toString();
      out = s.slice(0, -8) + "." + s.slice(-8);
    }
    out = out.replace(/0+$/, "").replace(/\.$/, "");
    if (out === "" || out === "0") out = "0";
    return (neg ? "-" : "") + out + " " + unit;
  } catch (_) { return "0 " + unit; }
}

/** Window summaries computed in Rust (JSON string) or JS fallback (object). */
export function summarize(blocksJson, statusJson) {
  if (core && core.summarize) {
    try { return JSON.parse(core.summarize(blocksJson, statusJson)); } catch (_) {}
  }
  return null; // callers fall back to inline computation
}

/* ---------------- formatting helpers ---------------- */
export const fmt = {
  int: (n) => Number(n || 0).toLocaleString("en-US"),
  num: (n, d) => Number(n || 0).toFixed(d == null ? 2 : d),
  age(unix) {
    const t = Number(unix);
    if (!t) return "—";
    const s = Math.max(0, Math.floor(Date.now() / 1000 - t));
    if (s < 60) return s + "s";
    if (s < 3600) return Math.floor(s / 60) + "m";
    if (s < 86400) return Math.floor(s / 3600) + "h";
    return Math.floor(s / 86400) + "d";
  },
  utc(unix) {
    const t = Number(unix);
    if (!t) return "—";
    return new Date(t * 1000).toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
  },
  short(s, n) {
    s = String(s || "");
    n = n || 14;
    if (s.length <= n) return s;
    const half = Math.max(3, Math.floor(n / 2) - 1);
    return s.slice(0, n - half - 1) + "…" + s.slice(-half);
  },
};
