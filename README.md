# Statefall

Real-time browser strategy hosted at [WorldRTS.com](https://www.worldrts.com) on WordPress.

- `game/` — local candidate game 1.10.11: Vite application with a browser-free Phase D engine; the Canvas/UI/controller adapter remains in the legacy module.
- `plugin/statefall-scores/` — repository plugin version 1.10.7: leaderboard, profiles, saves and replays, nations and flags, trophies, reports, admin tools, and immutable manifest-based game releases.
- `tools/` — direct-engine harness, determinism proof, replay checker, opening benchmark, release builders, and browser/Playwright trailer capture.
- `sandbox/` — localhost-only WordPress 7.1 / PHP 8.4 integration environment restored from an authorized site backup.
- `docs/` — current status and findings, release runbook and record template, graphics modernization plan, historical website handoff, and multiplayer plan.

Production is live and public at game 1.10.7/plugin 1.10.6, installed and verified on 14 September 2026. Local candidate game 1.10.11 has a certified-complete Phase D technical architecture with no critical or high defects after final static review, but remains administratively NO-GO because its worktree is dirty/uncommitted at HEAD `ad301888827571e57514766c9892f12943197d05` and review, commit, and handoff authorization are pending. Repository versions do not prove deployment without a release record. The authorized 12 September snapshot remains the pre-release WordPress 7.1/PHP 8.4 baseline. See `docs/current-status.md`, `docs/production-baseline-2026-09-12.md`, and `docs/build-a-release.md`.

Working rules: bump every changed component, verify the game's `REQUIRES_PLUGIN` requirement, and run the applicable release gates. Game and plugin version numbers do not need to match when only one component changes.

## Local testing

Requirements: Node.js 22.12 or newer within the 22.x line. Node 24 on Windows is currently excluded because local simulation runs have been unstable; CI and the supported development runtime use Node 22. From the repository root:

```powershell
npm ci
npm run dev
npm run syntax
npm test
```

`npm test` runs browser-free direct-engine/system contracts, old-versus-extracted parity, reduced-grid map and mode smoke simulations, same-page restart/replay checks used by credits, and a production-size cold deterministic replay. Candidate 1.10.11 explicitly retains the approved 1.10.8 hashes in `tests/fixtures/simulation-baselines-v1.10.8.json`; see `docs/testing-baselines.md`. Optional environment variables for `tools/determinism.js` are `SEED`, `DIFF`, `TICKS`, `GAR`, and `QUICK`.

Run `npm run build:release` to reproducibly produce `dist/`, schema-1 `dist/release.json`, and the exact game ZIP under `.artifacts/`. Run `npm run bench` for the longer Super hard opening benchmark.

Run `.\sandbox\start.ps1`, `.\sandbox\verify.ps1`, and `.\sandbox\stop.ps1 -DockerDesktop` for local WordPress/plugin integration testing. Docker must also be running before `npm run verify:artifacts`. See `sandbox/README.md` for isolation and reset details.
