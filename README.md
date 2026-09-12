# Statefall

Real-time strategy in one HTML file, hosted at [WorldRTS.com](https://www.worldrts.com) on WordPress.

- `game/index.html` — the game (current: 1.10.5). Release packages are built from it with `tools/build-howto.js` and `tools/build-flags.js`.
- `plugin/statefall-scores/` — the WordPress plugin (current: 1.10.4): leaderboard, profiles, saves and replays, nations and flags, trophies, reports, admin tools.
- `tools/` — headless harness, determinism proof, replay checker, opening benchmark, release builders, trailer renderers (Node + `canvas`).
- `docs/` — multiplayer plan and determinism log, website handoff, how to build a release.

Working rules: every release bumps the version in the game and the plugin; anything touching the simulation must pass `tools/determinism.js` before it ships.
