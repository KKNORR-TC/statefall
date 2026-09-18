# Statefall

Real-time browser strategy hosted at [WorldRTS.com](https://www.worldrts.com) on WordPress.

- `game/` — local development game 1.10.14: Vite application with a browser-free Phase D engine, bounded Phase D2 relay proof, and bounded Phase E1/E2 renderer slices; Canvas remains the production/default renderer while development-only `pixi-hybrid` owns the terrain raster and structure base icons.
- `plugin/statefall-scores/` — repository plugin version 1.10.7: leaderboard, profiles, saves and replays, nations and flags, trophies, reports, admin tools, and immutable manifest-based game releases.
- `tools/` — direct-engine harness, determinism proof, replay checker, opening benchmark, release builders, and browser/Playwright trailer capture.
- `sandbox/` — localhost-only WordPress 7.1 / PHP 8.4 integration environment restored from an authorized site backup.
- `docs/` — current status and findings, release runbook and record template, graphics modernization plan, historical website handoff, and multiplayer plan.

Production is live and public at game 1.10.7/plugin 1.10.6, installed and verified on 14 September 2026. Local game 1.10.14 build `2026-09-18-phase-e2-pixi-structures` adds the bounded E2 structure-base migration committed at `78564c2`, without a production release or handoff; E1 commits `4361ad7`/`e5c4228` remain the prior milestone, plugin remains 1.10.7, and the simulation baseline remains 1.10.8. Repository versions do not prove deployment without a release record. See `docs/current-status.md`, `docs/phase-e-progress.md`, and `docs/build-a-release.md`.

Working rules: bump every changed component, verify the game's `REQUIRES_PLUGIN` requirement, and run the applicable release gates. Game and plugin version numbers do not need to match when only one component changes.

## Local testing

Requirements: Node.js 22.12 or newer within the 22.x line. Node 24 on Windows is currently excluded because local simulation runs have been unstable; CI and the supported development runtime use Node 22. From the repository root:

```powershell
npm ci
npm run dev
npm run syntax
npm test
```

`npm test` runs camera/viewport/structure-layer contracts, browser-free direct-engine/system contracts, the Phase D2 relay proof, old-versus-extracted parity, reduced-grid map and mode smoke simulations, same-page restart/replay checks, and production-size cold determinism. Development game 1.10.14 retains the approved 1.10.8 hashes in `tests/fixtures/simulation-baselines-v1.10.8.json`; see `docs/testing-baselines.md`.

Run `npm run build:release` to reproducibly produce `dist/`, schema-1 `dist/release.json`, and the exact game ZIP under `.artifacts/`. Run `npm run bench` for the longer Super hard opening benchmark.

Run `.\sandbox\start.ps1`, `.\sandbox\verify.ps1`, and `.\sandbox\stop.ps1 -DockerDesktop` for local WordPress/plugin integration testing. Docker must also be running before `npm run verify:artifacts`. See `sandbox/README.md` for isolation and reset details.
