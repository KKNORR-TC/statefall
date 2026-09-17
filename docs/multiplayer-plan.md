# Statefall - Multiplayer Project Plan

_Status reconciled 17 September 2026. Local recovered repository game 1.10.9/plugin 1.10.7 is preserved at `97dcc76`; production remains game 1.10.7/plugin 1.10.6. Graphics modernization Phase C is complete; engine extraction has not started. A minimal two-client proof is scheduled after engine extraction and before the full graphics migration._

This phase status concerns multiplayer only; it is not a statement of overall site readiness or production release approval. See `docs/current-status.md` for current operational status and open findings.

## 1. The design in one paragraph

Deterministic lockstep with a thin relay. Every client runs the identical simulation from the same seed; only **commands** travel (attack here, build that, propose a pact), stamped with the tick they execute on. A small WebSocket relay orders and broadcasts them; it never simulates anything. Bandwidth is tiny, cheating is limited to what the command set allows, and the existing engine stays as it is. An authoritative server simulating the map was rejected: it would mean re-implementing the game server-side and paying CPU per match.

## 2. What is already done (Phase 0 — shipped in game 1.5.0–1.6.2)

Everything below remains in `game/src/legacy-game.js`, loaded by the Vite entry at `game/index.html`, and is covered to the extent described by the repository's headless tests.

**Determinism**
- The simulation runs on the tick clock only (`tickN`, `simMs = tickN × TICK`, TICK = 100 ms). No `performance.now()` / `Date.now()` inside anything that affects state. Bot build cooldowns, bot think cadence and the Risky-start draft timer all moved to ticks.
- Two random generators: `srand` (mulberry32, seeded from the match seed) for everything in the sim; the browser's `Math.random` for audio, effects, notices, the jukebox, credit quotes. Helpers: `rnd/pick` = sim, `urnd/upick` = UI. Map noise is seeded (`Float32Array.from(…, () => srand())`).
- Ships and aircraft carry stable ids (`id: ++uidSeq`); structures are addressed by tile; areas by id; players by id.

**Command layer** (search `// command layer` in `game/src/legacy-game.js`)
- `CMD.log` — every player action as `{t: tick, k: kind, a: args}`.
- Entry points: `issueClick(t, env)` (map clicks, with `env = {ratio, pick, build}` captured at issue time), `issueMenu(d, t, selIds, siteT, ratioV, aidGold, aidTroops)` (all right-click menu actions via `menuAction()`), `issue(kind, …args)` (focus slider, airAuto/logAuto/autoFire toggles, recall/recallAll, sat, accept/decline proposals, decShare/decWar).
- `applySimple`, `replayApply`, `menuAction(d,t,sel,site,ratioV,aidGold,aidTroops)` and `clickTile(t, env)` are the deterministic executors. Bots never log.
- `stateHash()` every 100 ticks (owner grid sample + troops/gold/tiles per player + ships + attacks + counts). Recorded in `CMD.hashes`; a replay compares and reports the first divergence.
- `replayFile()` → `{v, game, seed, settings, cmds, hashes, result, tick, when}`. `applySettings()` restores the start card from it; `loadReplayFile(f, 'watch' | 'resume')`.
- Replay driver in `tick()`: applies commands whose `t <= tickN` before advancing. `REPLAY = {on, cmds, i, speed, resume, toTick, hashes, mismatch}`.
- `replayCatchUp(target, label, onDone)` runs the sim silently in animation-frame slices behind a progress bar (sounds, notices, log, banners suppressed by `SAVES.catchup`), then waits for Play now / Watch.

**Saves and replays on the site** (plugin ≥ 1.6.0)
- Table `wp_statefall_saves` (user, kind save|replay, slot, seed, map, country, cls, diff, result, tick, game_version, size, data JSON). Limits: 10 saves (Autosave slot never dropped), 20 replays, 96 KB each.
- REST under `/wp-json/statefall/v1/saves` — GET list, GET/DELETE/POST(rename) `/saves/{id}`, POST create/update (`bySlot` for Autosave).
- Game: autosave every 30 s (logged in), Save & quit on the pause modal, automatic replay of every finished match, Games & replays modal, `/play/?load=<id>&mode=resume|watch`. Logged-out users get a register/login card. No browser storage.

**Proof harness** (repository `tools/` and `tests/`)
- `tools/harness.js` temporarily rewrites/evaluates the legacy module for node-canvas and exposes `S` (simulation internals); it is also used for trailers. This test-only bridge remains until Phase D extracts an importable engine and is not used by release builds.
- `tools/determinism.js` plays a scripted match through the command layer, replays it cold, and compares hashes. Run `npm run determinism`; set `SEED`, `DIFF`, `GAR`, `QUICK`, and `TICKS` as environment variables when needed.
- `tools/replaycheck.js <file.state>` replays a real player's file and reports the first diverging tick. This is how the `click env` bug fixed in 1.6.1 was found.

**Known limitation:** a replay is tied to the game version it was recorded on. A balance change can make an old save diverge; the loader warns. The site keeps the previous five game packages (Game package → Previous versions), so a save could be resumed on the build it was made with if that ever matters.

## 2b. Determinism log (what broke and how it was found)

Every divergence so far was found by replaying the player's `.state` file with `tools/replaycheck.js` and reading the first differing checkpoint. Keep doing that; it works.

| Cause | Symptom | Fix (game version) |
|---|---|---|
| Map clicks logged without their context (build/pick mode, slider) | replay attacks where a building was placed | 1.6.1 |
| Noise buffer filled from the sim RNG (96k draws) on first explosion sound | bots diverge ~0:10 | 1.6.4 |
| Generative music on the sim RNG | slow drift whenever it played | 1.6.4 |
| Bot aggression used tick clock minus wall-clock start | bots diverge ~0:20 | 1.6.5 |
| Replays re-posted scores at match end | duplicate score rows | 1.6.7 |
| Fleet Move/Blockade used the live ship selection, not the recorded ids | replays diverge right after fleet orders | 1.10.4 |
| Open: one random draw differs late (6CHYVM at 18:10), unexplained | landing force ends a tick early | 1.10.5 adds random-draw counts + full-tile hash to checkpoints |

Rules that came out of it: the sim reads only `tickN/simMs` and `srand`; UI/audio/effects use `Math.random`/`urnd`/`upick`; every player action goes through `issue*` and carries ids, never live UI state; anything that runs only when a human is present must not touch sim state or `srand`.

## 3. Phase 1 — Relay and lobby (next)

Sequencing note: first implement only the relay/lockstep/reconnect architecture proof defined as Phase D2 in `docs/graphics-modernization-plan.md`, using the extracted engine and legacy renderer. Complete lobby, chat, public rooms, and production hosting after that proof; they are not prerequisites for beginning the visual migration.

**Relay** (Node, ~300 lines, separate host — WP Engine cannot run sockets)
- Rooms: create/join/leave, up to N human seats + bots filling the rest, host controls.
- Tick clock: the relay is the metronome. Turn length 200 ms (2 ticks). Commands received during turn T are broadcast for execution at turn T+2. Clients that fall behind stall the room ("waiting for Ken…") rather than desync.
- Holds the full command log per room for reconnects and for the final replay.
- Identity: WordPress issues a short-lived signed token at `GET /wp-json/statefall/v1/mp-token` (user id, display name, avatar, expiry, HMAC with the site key). The relay verifies it; no second login.
- Hosting: Fly.io free tier or a $6 VPS; domain `mp.worldrts.com`. One small instance handles hundreds of rooms.

**Lobby** (in the game's start card)
- Create room: settings, map, seed, bot fill, invite link `/play/?room=ABCD`. Ready-up; host starts.
- Join room: seat list with names/flags, chat line.
- Later: public room list on the site (`[statefall_rooms]`).

## 4. Phase 2 — Two humans, lockstep

- `me` becomes "my seat"; humans are seats in `players` with `kind: 'human'`. UI code that assumes one human needs a pass: sidebar owner, notices, invasion cards, credits STARRING, score posting (both post; the server records one match with two players).
- Commands carry a seat id; `applySimple`/`menuAction` take the acting player instead of `me`. (Most executors already take `p`; the wrappers hard-code `me` today.)
- Desync: hashes exchanged every 100 ticks; on mismatch the relay declares the majority canonical and the odd client reloads from the room's command log (this is `replayCatchUp` pointed at the relay's log).
- Pause: vote, 30 s max; disconnect: 60 s grace with the room stalled, then the seat becomes a bot.

## 5. Phase 3 — Being human to each other

- Human diplomacy: proposals become commands with an accept window; the notice cards are the UI.
- Chat and map pings; surrender; spectator seats; "watch live" link.
- Reconnect: rejoin replays the log at high speed (progress bar), then resumes.

## 6. Phase 4 — Ranked

- Results signed with all clients' hashes; multiplayer classes on the board ("Duel", "Free-for-all 4"); profile win/loss; credits for multiplayer with both players' quotes; shareable replays from the room log.

## 7. Open decisions (recorded from discussion)

- Launch with 2–4 humans + bots; 10 humans later if the lobby UX holds up.
- Turn delay 200 ms (invisible at this game's pace); 100 ms optional later.
- Relay host: Fly.io unless Ken prefers a VPS. Needs DNS for `mp.worldrts.com`.

## 8. Where the files are

- Game source: Vite application under `game/` (repository: 1.10.9; production: 1.10.7).
- Plugin source: `plugin/statefall-scores/` (current: 1.10.7).
- Tests and build tools: `tests/`, `tools/`, `package.json`, and `package-lock.json`. Run commands from the repository root.
- Release procedure: `docs/build-a-release.md`.

## 9. Working conventions

- Every changed component receives the appropriate version and changelog update; package names match their embedded versions.
- Plugin modules load through a guarded loader; a syntax error in a module is reported as an admin notice, never a white screen. Kill switch: `define('STATEFALL_DISABLED', true)`.
- Static files are served from `/wp-content/uploads/statefall/…` (WP Engine does not route static extensions through WordPress).
- Any determinism-relevant change must pass `npm test` before release.
