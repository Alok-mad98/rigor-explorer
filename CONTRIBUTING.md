# Contributing

Thanks for looking under the hood. Contributions are welcome — this is a small, focused project and it should stay that way.

## What this project is (and is not)

This explorer is **read-only**. It reads the public RIGOR chain API and displays it. That boundary is a feature:

- do not add wallets, transaction signing, key handling or anything that takes custody
- do not add accounts, analytics, trackers or third-party scripts
- do not add credentials of any kind; the `.env` pattern does not exist here on purpose

## Development setup

```bash
# frontend
cd web
npm install
npm run dev        # vite dev server; API calls go to the live Rust worker

# backend (Rust) — requires the wasm32-unknown-unknown target
cd worker
cargo check --target wasm32-unknown-unknown

# frontend core (Rust -> WASM)
cd core
cargo check --target wasm32-unknown-unknown
```

## Before you open a pull request

- `npm run build` in `web/` must pass
- `cargo check --target wasm32-unknown-unknown` must pass in `worker/` and `core/`
- `cargo fmt` must leave no diffs in either crate
- no secrets, tokens or keys anywhere in the diff (`.gitignore` already blocks `.env*`)
- if you changed the worker or the core, rebuild the committed generated bindings so deploy still works without a Rust toolchain

## Commit style

Short imperative subject lines (`Add mempool window`, `Fix tray LED flicker`). One logical change per commit.

## Reporting issues

Include: the URL you were on, the window you had open, what you expected, and what the tray LED showed. Screenshots of retro desktops are always appreciated.
