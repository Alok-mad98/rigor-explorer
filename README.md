# RIGOR Explorer — Every Block, Every Transaction, in the Open

**A read-only explorer for the RIGOR mainnet. Search a height, a block hash, a transaction id or an `rg1q…` address and see the whole story: blocks, rewards, UTXOs, mining payouts, convergence activity and burns — in a terminal-styled interface that stays out of your way.**

*Live at: https://rigor-explorer.pages.dev*

---

## Table of Contents

- [The Story (plain English)](#the-story-plain-english)
- [What you can do](#what-you-can-do)
- [How it works](#how-it-works)
- [The API behind it](#the-api-behind-it)
- [Deployment (Cloudflare Pages)](#deployment-cloudflare-pages)
- [Security: no credentials, anywhere](#security-no-credentials-anywhere)
- [Run it locally](#run-it-locally)
- [Repository layout](#repository-layout)
- [Disclaimer](#disclaimer)

---

## The Story (plain English)

[RIGOR](https://www.rigorchain.com/) is a Bitcoin-inspired, proof-of-work UTXO chain with **two native monetary roles**: **ORU** (the transaction and mining asset, 128 ORU per block forever) and **RES** (a scarce asset that can only be minted by *destroying* ORU through a mechanism called **Convergence**).

Every chain needs a window. The official explorer exists, but as a community we wanted a second window with a different personality: the terminal feel of the RIGOR website itself, combined with the deep mechanics a modern explorer should have — live status, per-block stats, address flows, UTXO breakdowns, raw transaction data and instant search.

So this is that window. It reads **only** the public chain API, caches nothing sensitive, stores nothing, and writes nothing. If the node says it, you can check it — the explorer's job is to show it.

> **What this is not:** it is not a wallet, not a mining pool dashboard, not operated by the RIGOR project, and it never asks for keys. It is a read-only pane of glass onto the chain.

---

## What you can do

| Feature | What it shows |
| --- | --- |
| **Overview** | Live tip height, difficulty, estimated hashrate, peers, mempool, monetary state (ORU circulating, burns, RES stats), latest blocks |
| **Blocks** | The last 100 blocks with age, time, tx count, ORU minted, convergence burn |
| **Block detail** | Full header: hash, previous hash, bits, merkle root, Opus hash, minted/burned, consensus fingerprint status |
| **Transaction detail** | Tx metadata (block, index, coinbase flag, version, locktime) plus the full raw hex |
| **Address detail** | ORU/RES balances, lifetime received/spent, UTXO list with spendability, transaction history, **Convergence activity** (mints, winner/candidate roles) and **RES minted via this address** |
| **Mining payouts** | RIGOR has no pools — every block reward is a coinbase UTXO paid directly to the miner's own `rg1q…` address. The address page makes those payouts visible (total received, spendable UTXOs, history) |
| **Search** | Type anything: a number → block, a 64-char hash → transaction or block, an `rg1q…` string → address |
| **Stats** | Per-block charts (transactions, convergence burns) computed in your browser from chain data |
| **Network & API** | Chain identity, live node state, and the full public API surface |

**Live updates:** the header pill polls the chain every 12 seconds. When a new block lands, the Overview, Blocks and Stats pages refresh themselves — the pill reads `LIVE · HEIGHT n`.

---

## How it works

```
  your browser
      │  (static SPA — vanilla JS, no build step, no trackers)
      ▼
  rigor-explorer.pages.dev  ──►  /functions  (Cloudflare Pages Functions)
      │                            thin read-only proxy:
      │                            adds CORS + 5s edge cache, no keys
      ▼
  explorer.rigorchain.com/api  (the public RIGOR chain API)
```

- **No build step.** Plain HTML/CSS/JS. Clone it, open it, or deploy it as-is.
- **No trackers, no analytics, no cookies.** The only network calls are to the chain API through the proxy.
- **Hash routing** (`#/blocks`, `#/address/rg1q…`) so every view is linkable.

The design is a nod to the RIGOR website's own desktop/BIOS aesthetic — monospace, phosphor green on black, scanlines — combined with the information architecture a serious explorer needs.

---

## The API behind it

This explorer speaks the same public API as the official RIGOR explorer:

| Endpoint | Returns |
| --- | --- |
| `GET /api/status` | Chain identity, block health, monetary snapshot, mining state |
| `GET /api/blocks?limit=N` | Most recent N blocks |
| `GET /api/block/{height\|hash}` | Full block header + consensus data |
| `GET /api/tx/{txid}` | Transaction metadata + raw hex |
| `GET /api/address/{addr}` | Balances, UTXOs, history, Convergence activity |

A search endpoint does not exist upstream, so search is implemented client-side with strict pattern matching (height / 64-hex / bech32 address) — no guessing, no fuzzy magic.

---

## Deployment (Cloudflare Pages)

The site is a static bundle plus one Pages Function, so it deploys to Cloudflare Pages in one command:

```bash
npx wrangler pages deploy . --project-name=rigor-explorer
```

- **Production URL:** `https://rigor-explorer.pages.dev`
- Every push to the connected branch redeploys automatically if you connect the repo in the Cloudflare dashboard.
- The `functions/api/[[route]].js` handler is picked up automatically by Pages — no build configuration needed.

> Note: Cloudflare Pages subdomains cannot contain dots (`.`), so the URL is
> `rigor-explorer.pages.dev` rather than `rigor.explorer.pages.dev`.

---

## Security: no credentials, anywhere

- **There are no secrets in this project.** The upstream API is public and read-only; the proxy adds caching and CORS, nothing else.
- `.gitignore` blocks `.env*` files so nothing accidental can be committed.
- No API keys, tokens, cookies or identifiers are embedded in the client or the functions.
- The site is **read-only** end to end: no POSTs to the chain, no transaction relaying, no wallet connections.

If you fork this, keep it that way.

---

## Run it locally

```bash
# any static server works; the /api path needs the proxy:
npx wrangler pages dev .          # recommended: serves site + functions
# or, API-less quick look:
python -m http.server 8080        # static pages will show API errors
```

Then open `http://localhost:8788` (wrangler) or `http://localhost:8080` (static).

---

## Repository layout

```
index.html                  shell: nav, status pill, footer
assets/site.css             terminal/BIOS theme
assets/app.js               SPA: router, pages, search, charts, live polling
functions/api/[[route]].js  read-only proxy to the public chain API
README.md                   this file
LICENSE                     MIT
```

---

## Disclaimer

Independent community tooling. **Not affiliated with, endorsed by, or operated by the RIGOR project.** Data comes from the public chain API and may lag the chain tip by a few seconds. Nothing here is financial advice; RIGOR's ORU and RES are experimental assets on a young network — treat them accordingly.
