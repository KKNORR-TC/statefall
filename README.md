# Statefall

Real-time strategy in one HTML file, hosted at [WorldRTS.com](https://www.worldrts.com) on WordPress.

- `game/index.html` — repository game version 1.10.8. Release packages are built from it with `tools/build-howto.js` and `tools/build-flags.js`.
- `plugin/statefall-scores/` — repository plugin version 1.10.7: leaderboard, profiles, saves and replays, nations and flags, trophies, reports, admin tools, and immutable manifest-based game releases.
- `tools/` — headless harness, determinism proof, replay checker, opening benchmark, release builders, trailer renderers (Node + `canvas`).
- `sandbox/` — localhost-only WordPress 7.1 / PHP 8.4 integration environment restored from an authorized site backup.
- `docs/` — current status and findings, release runbook and record template, graphics modernization plan, historical website handoff, and multiplayer plan.

Production is live and public at game 1.10.7/plugin 1.10.6, installed and verified on 14 September 2026. The repository game is 1.10.8; repository versions do not prove deployment without a release record. The authorized 12 September snapshot remains the pre-release WordPress 7.1/PHP 8.4 baseline. See `docs/current-status.md`, `docs/production-baseline-2026-09-12.md`, and `docs/build-a-release.md`.

Working rules: bump every changed component, verify the game's `REQUIRES_PLUGIN` requirement, and run the applicable release gates. Game and plugin version numbers do not need to match when only one component changes.

## Local testing

Requirements: Node.js 22.x. Node 24 on Windows is currently excluded because local simulation runs have been unstable; CI and the supported development runtime use Node 22. From the repository root:

```powershell
npm install
npm run syntax
npm test
```

`npm test` runs reduced-grid map and mode smoke simulations, same-page restart/replay checks used by credits, and a production-size cold deterministic replay. Approved game 1.10.8 hashes are recorded in `tests/fixtures/simulation-baselines-v1.10.8.json`; see `docs/testing-baselines.md`. Tests use `game/index.html` by default; set `GAME` to exercise another game file. Optional environment variables for `tools/determinism.js` are `SEED`, `DIFF`, `TICKS`, `GAR`, and `QUICK`.

Run `npm run bench` for the longer Super hard opening benchmark. Run `npm run release:assets` to generate the how-to pages and site flag renderer under `pkg/`.

Run `.\sandbox\start.ps1`, `.\sandbox\verify.ps1`, and `.\sandbox\stop.ps1` for local WordPress/plugin integration testing. See `sandbox/README.md` for isolation and reset details.
