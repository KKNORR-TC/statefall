# Statefall

Real-time browser strategy hosted at [WorldRTS.com](https://www.worldrts.com) on WordPress.

- `game/` — local development game 1.10.32: Vite application with a browser-free Phase D engine, bounded Phase D2 relay proof, technically complete local Phase E renderer foundation, and locally approved Phase F2 high-resolution terrain; Canvas remains production/default.
- `plugin/statefall-scores/` — repository plugin version 1.10.7: leaderboard, profiles, saves and replays, nations and flags, trophies, reports, admin tools, and immutable manifest-based game releases.
- `tools/` — direct-engine harness, determinism proof, replay checker, opening benchmark, release builders, and browser/Playwright trailer capture.
- `sandbox/` — localhost-only WordPress 7.1 / PHP 8.4 integration environment restored from an authorized site backup.
- `docs/` — current status and findings, release runbook and record template, graphics modernization plan, historical website handoff, and multiplayer plan.

Production is live and public at game 1.10.7/plugin 1.10.6. Phase E is committed at `d0c92fb`; `27a2389` is the reviewed F2 candidate baseline. Ken approved local game 1.10.32 build `2026-09-20-phase-f2-high-resolution-terrain` as the final in-game F2 terrain on 2026-09-20 by stating `approved proceed`, and the terrain-affected Canvas goldens are accepted. The old 1x F1 candidate is superseded/changes requested. No unit art, Phase G row, package, release, handoff, deployment, or production change is approved. Canvas remains production/default; plugin remains 1.10.7 and simulation baseline remains 1.10.8. See `docs/phase-f1-review.md`.

Working rules: bump every changed component, verify the game's `REQUIRES_PLUGIN` requirement, and run the applicable release gates. Game and plugin version numbers do not need to match when only one component changes.

## Local testing

Requirements: Node.js 22.12 or newer within the 22.x line. Node 24 on Windows is currently excluded because local simulation runs have been unstable; CI and the supported development runtime use Node 22. From the repository root:

```powershell
npm ci
npm run dev
npm run syntax
npm test
```

`npm test` runs atlas and renderer-layer contracts, browser-free engine/system contracts, the Phase D2 proof, parity, map/mode smoke, restart/replay, and production-size determinism. `npm run test:terrain-raster` runs the F2 exact-byte/cache fixture. Development game 1.10.32 retains the approved 1.10.8 simulation hashes; see `docs/testing-baselines.md`.

Run `npm run build:release` to reproducibly produce `dist/`, schema-1 `dist/release.json`, and the exact game ZIP under `.artifacts/`. Run `npm run bench` for the longer Super hard opening benchmark.

Run `.\sandbox\start.ps1`, `.\sandbox\verify.ps1`, and `.\sandbox\stop.ps1 -DockerDesktop` for local WordPress/plugin integration testing. Docker must also be running before `npm run verify:artifacts`. See `sandbox/README.md` for isolation and reset details.
