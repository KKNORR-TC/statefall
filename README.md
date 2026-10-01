# Statefall

Real-time browser strategy hosted at [WorldRTS.com](https://www.worldrts.com) on WordPress.

- `game/` — deployed game 1.10.62: tactical pause, illustrated field guide, authored audio and classic Canvas artwork. Pixi remains a development renderer.
- `plugin/statefall-scores/` — deployed plugin version 1.10.10: leaderboard, profiles, saves and replays, nations and flags, trophies, reports, admin tools, and immutable manifest-based game releases.
- `tools/` — direct-engine harness, determinism proof, replay checker, opening benchmark, release builders, and browser/Playwright trailer capture.
- `sandbox/` — localhost-only WordPress 7.1 / PHP 8.4 integration environment restored from an authorized site backup.
- `docs/` — current status and findings, release runbook and record template, graphics modernization plan, historical website handoff, and multiplayer plan.

Game 1.10.62 with plugin 1.10.10 is live and passed local qualification and production acceptance. GitHub main was synchronized with all accumulated source and release history at `f8c1ade`; later documentation commits record the completed deployment. Simulation baseline remains 1.10.8. See [current status](docs/current-status.md), [release record](docs/release-record-1.10.62.md), and the [release runbook](docs/build-a-release.md). GitHub contains source; WordPress database/uploads backups are separate.

Working rules: bump every changed component, verify the game's `REQUIRES_PLUGIN` requirement, and run the applicable release gates. Game and plugin version numbers do not need to match when only one component changes.

Next campaign: [First Command tutorial design](docs/tutorial-campaign-design.md) and [interactive opening preview](prototypes/tutorial-campaign/README.md). Nine chapters cover every roster entry; this is a design/prototype deliverable, not part of the deployed game.

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
