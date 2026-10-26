# RIGOR Explorer 98 — Every Block, Every Transaction, in the Open

**A retro-desktop explorer for the RIGOR mainnet.** Boot into a classic teal desktop, open `My Computer`, drag windows around, watch the chain in 3D — and look up any block, transaction or address: balances, UTXOs, mining payouts, convergence activity and burns, read straight from the chain.

**Live:** https://rigor-explorer.pages.dev
**Backend (Rust):** https://rigor-explorer-api.arechampionw.workers.dev/health

---

## Table of Contents

- [Why it looks like 1995](#why-it-looks-like-1995)
- [The stack: Rust at both ends](#the-stack-rust-at-both-ends)
- [What you can do](#what-you-can-do)
- [How it works](#how-it-works)
- [Build and deploy](#build-and-deploy)
- [Security: no credentials, anywhere](#security-no-credentials-anywhere)
- [Repository layout](#repository-layout)
- [Disclaimer](#disclaimer)

---

## Why it looks like 1995

The RIGOR website presents itself as a retro desktop OS — beveled windows, navy title bars, a taskbar with a Start menu. This explorer takes that visual language seriously and turns the *explorer itself* into a small operating system: boot screen, desktop icons, draggable windows, a tray with a live chain LED and a clock. The information architecture inside the windows — live status pill, smart search, per-block detail, address flows — is what a modern explorer should do. Old computer on the outside, current data on the inside.

## The stack: Rust at both ends

| Layer | Technology | What it does |
| --- | --- | --- |
| **Backend** | Rust → WebAssembly, [workers-rs](https://github.com/cloudflare/workers-rs) on Cloudflare Workers | Read-only proxy of the public chain API with CORS and edge caching, plus a `/api/resolve` endpoint that classifies any search query (height, 64-hex, address) server-side |
| **Frontend core** | Rust → WebAssembly (`core/`) | Query classification, exact atom→ORU math on `u128` (no floating point anywhere near money), and window summaries over the last 100 blocks. The React app loads it at startup and falls back to a JS implementation if WASM is unavailable |
| **Frontend** | React 18 + Vite + Three.js | The desktop shell, window manager, taskbar, all data windows, and a 3D chain visualizer (drag to rotate, click a cube to open that block) |

## What you can do

- **Overview (My Computer)** — tip height, difficulty, estimated hashrate, peers, mempool, the full monetary state (ORU circulating, immature coinbase, convergence burns, fee burns, RES stats)
- **Blocks** — the last 100 blocks: age, time, tx count, ORU minted, convergence burn, RES minted
- **Block detail** — full header (hash, previous, bits, merkle root, Opus hash) plus reward and consensus panels
- **Transaction detail** — summary plus the complete raw hex in a notepad-style terminal
- **Address lookup** — balances, lifetime received/spent, UTXO list, transaction history, convergence activity (mints, winner/candidate roles)
- **Mining payouts, explained** — RIGOR has no pools: every block reward is a coinbase UTXO paid directly to the miner's own `rg1q…` address. The address window makes those payouts visible
- **Chain Visualizer 3D** — the last 24 blocks as a rotating phosphor-green chain; the tip pulses; click any cube to open the block
- **Find** — paste anything: a number opens a block, a 64-hex string resolves to a transaction or block, an `rg1q…` string opens the address
- **Statistics** — transactions and convergence burns per block, drawn as charts, with window summaries computed in Rust/WASM
- **Network Neighborhood** — chain identity, live node state, and the API surface

The tray LED polls the chain every 12 seconds: green when connected, red when the API is unreachable.

## How it works

```
React + Three.js (Vite build)                Rust core (WASM)
        └── explorer logic: classify, 128-bit atom math ──┘
                    │
                    ▼  HTTPS, read-only, CORS
        rigor-explorer-api.<subdomain>.workers.dev
                    │  Rust Cloudflare Worker
                    ▼
        explorer.rigorchain.com/api  (the official public chain API)
```

No accounts, no database, no writes. The whole system is a pane of glass over the public chain API.

## Build and deploy

Frontend:

```bash
cd web
npm install
npm run build
npx wrangler pages deploy dist --project-name=rigor-explorer
```

Backend worker (Rust):

```bash
cd worker
cargo build --lib --release --target wasm32-unknown-unknown
wasm-bindgen target/wasm32-unknown-unknown/release/rigor_explorer_api.wasm \
  --out-dir generated --target bundler
npx wrangler deploy
```

Frontend core (Rust → WASM, consumed by the React app):

```bash
cd core
cargo build --release --target wasm32-unknown-unknown
wasm-bindgen target/wasm32-unknown-unknown/release/explorer_core.wasm \
  --out-dir ../web/src/wasm --target web
```

The worker's generated bindings are committed so `wrangler deploy` works without a Rust toolchain; rebuild them with the commands above after changing `worker/src/lib.rs`.

## Security: no credentials, anywhere

- The upstream chain API is public and read-only; the Rust worker adds caching and CORS, nothing else
- No API keys, tokens or secrets exist in this repository, the worker, or the client bundle
- `.gitignore` blocks every `.env*` file
- The site never asks for keys and cannot sign or relay anything

## Repository layout

```
web/      React + Vite + Three.js frontend (desktop shell, windows, pages, 3D scene)
core/     Rust crate compiled to WASM: query classification, atom math, summaries
worker/   Rust Cloudflare Worker: API proxy + /api/resolve
```

## Disclaimer

Independent community tooling. Not affiliated with, endorsed by, or operated by the RIGOR project. Data comes from the public chain API and may lag the tip by a few seconds. Nothing here is financial advice; ORU and RES are experimental assets on a young network.
