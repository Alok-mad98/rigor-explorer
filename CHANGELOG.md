# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-10-26

### Added

- Retro desktop shell: boot screen, teal desktop, draggable beveled windows, taskbar with Start menu, tray with live chain LED and clock.
- My Computer (Overview) window: tip height, difficulty, estimated hashrate, peers, mempool, and the full monetary state of the chain.
- Blocks window: the last 100 blocks with age, time, tx count, ORU minted, convergence burn and RES minted; auto-refresh every 30 seconds.
- Block detail window: complete header (hash, previous, bits, merkle root, Opus hash), reward and consensus panels.
- Transaction detail window: summary fields plus the full raw hex in a notepad-style terminal.
- Address lookup window: balances, lifetime received/spent, UTXO list, transaction history, convergence activity and RES mints.
- Find window: single-box search that resolves heights, 64-hex hashes (transaction or block) and rg1q… addresses.
- Statistics window: per-block transactions and convergence-burn charts, with window summaries.
- Chain Visualizer 3D: the last 24 blocks as a rotating phosphor-green chain built with Three.js; drag to orbit, click a cube to open the block.
- Rust backend (`worker/`): Cloudflare Worker proxying the public chain API with CORS and edge caching, plus a server-side `/api/resolve` endpoint.
- Rust core (`core/`): WebAssembly module used by the frontend for query classification, exact 128-bit atom→ORU math and block-window summaries, with a JavaScript fallback.
