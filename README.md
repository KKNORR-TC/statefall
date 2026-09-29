# Statefall

Real-time browser strategy hosted at [WorldRTS.com](https://www.worldrts.com) on WordPress.

- `game/` — qualified game 1.10.57: deterministic simulation, classic Canvas artwork, continuous silo flight, and rotating loading-screen images. Pixi remains a development renderer.
- `plugin/statefall-scores/` — repository plugin version 1.10.9: leaderboard, profiles, saves and replays, nations and flags, trophies, reports, admin tools, and immutable manifest-based game releases.
- `tools/` — direct-engine harness, determinism proof, replay checker, opening benchmark, release builders, and browser/Playwright trailer capture.
- `sandbox/` — localhost-only WordPress 7.1 / PHP 8.4 integration environment restored from an authorized site backup.
- `docs/` — current status and findings, release runbook and record template, graphics modernization plan, historical website handoff, and multiplayer plan.

Game 1.10.57 with plugin 1.10.9 is qualified for manual handoff. The release record documents local verification, the corrected WebKit test, and segmented reruns. The currently installed production version has not been reverified, and no deployment is claimed. Simulation baseline remains 1.10.8. See [current status](docs/current-status.md), [release record](docs/release-record-1.10.57.md), and [installation instructions](docs/installation-handoff-1.10.57.md).

Working rules: bump every changed component, verify the game's `REQUIRES_PLUGIN` requirement, and run the applicable release gates. Game and plugin version numbers do not need to match when only one component changes.

## Local testing

Requirements: Node.js 22.12 or newer within the 22.x line. Node 24 on Windows is currently excluded because local simulation runs have been unstable; CI and the supported development runtime use Node 22. From the repository root:

```powershell
npm ci
npm run dev
npm run syntax
npm test
```

`npm test` runs atlas and renderer-layer contracts, browser-free engine/system contracts, the Phase D2 proof, parity, map/mode smoke, restart/replay, and production-size determinism. `npm run test:terrain-raster` runs the F2 exact-byte/cache fixture. Game 1.10.57 retains the approved 1.10.8 simulation hashes; see `docs/testing-baselines.md`.

Run `npm run build:release` to reproducibly produce `dist/`, schema-1 `dist/release.json`, and the exact game ZIP under `.artifacts/`. Run `npm run bench` for the longer Super hard opening benchmark.

Run `.\sandbox\start.ps1`, `.\sandbox\verify.ps1`, and `.\sandbox\stop.ps1 -DockerDesktop` for local WordPress/plugin integration testing. Docker must also be running before `npm run verify:artifacts`. See `sandbox/README.md` for isolation and reset details.
