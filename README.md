# Statefall

Real-time browser strategy hosted at [WorldRTS.com](https://www.worldrts.com) on WordPress.

- `game/` — local development game 1.10.23: Vite application with a browser-free Phase D engine, bounded Phase D2 relay proof, and bounded Phase E1-E11 renderer slices; Canvas remains the production/default renderer while development-only `pixi-hybrid` owns terrain through support actors.
- `plugin/statefall-scores/` — repository plugin version 1.10.7: leaderboard, profiles, saves and replays, nations and flags, trophies, reports, admin tools, and immutable manifest-based game releases.
- `tools/` — direct-engine harness, determinism proof, replay checker, opening benchmark, release builders, and browser/Playwright trailer capture.
- `sandbox/` — localhost-only WordPress 7.1 / PHP 8.4 integration environment restored from an authorized site backup.
- `docs/` — current status and findings, release runbook and record template, graphics modernization plan, historical website handoff, and multiplayer plan.

Production is live and public at game 1.10.7/plugin 1.10.6, installed and verified on 14 September 2026. Local game 1.10.23 build `2026-09-18-phase-e11-pixi-support-actors` adds the bounded repair-truck, spy-plane, and interceptor block after E10 commit `3d40023`. Development Pixi owns it only when every prerequisite through map labels is owned; E11-only failure keeps valid Pixi labels and restores the complete Canvas support block. Floating text and all later effects/labels remain Canvas-owned. Plugin remains 1.10.7 and the simulation baseline remains 1.10.8. Repository versions do not prove deployment without a release record. See `docs/current-status.md`, `docs/phase-e-progress.md`, and `docs/build-a-release.md`.

Working rules: bump every changed component, verify the game's `REQUIRES_PLUGIN` requirement, and run the applicable release gates. Game and plugin version numbers do not need to match when only one component changes.

## Local testing

Requirements: Node.js 22.12 or newer within the 22.x line. Node 24 on Windows is currently excluded because local simulation runs have been unstable; CI and the supported development runtime use Node 22. From the repository root:

```powershell
npm ci
npm run dev
npm run syntax
npm test
```

`npm test` runs camera/viewport/pre-structure/structure/naval/warship/projectile/missile/aircraft/map-label/support-actor contracts, browser-free direct-engine/system contracts, the Phase D2 relay proof, old-versus-extracted parity, reduced-grid map and mode smoke simulations, same-page restart/replay checks, and production-size cold determinism. Development game 1.10.23 retains the approved 1.10.8 hashes in `tests/fixtures/simulation-baselines-v1.10.8.json`; see `docs/testing-baselines.md`.

Run `npm run build:release` to reproducibly produce `dist/`, schema-1 `dist/release.json`, and the exact game ZIP under `.artifacts/`. Run `npm run bench` for the longer Super hard opening benchmark.

Run `.\sandbox\start.ps1`, `.\sandbox\verify.ps1`, and `.\sandbox\stop.ps1 -DockerDesktop` for local WordPress/plugin integration testing. Docker must also be running before `npm run verify:artifacts`. See `sandbox/README.md` for isolation and reset details.
