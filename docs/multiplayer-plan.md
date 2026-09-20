# Statefall - Multiplayer Project Plan

_Status updated 20 September 2026. Phase D game 1.10.11 is committed locally at `16aec35`. Game 1.10.12 build `2026-09-18-phase-d2-lockstep-proof` remains the historical minimal Phase D2 technical gate committed at `91b156a`; current local development is game 1.10.32. Plugin remains 1.10.7 and production remains game 1.10.7/plugin 1.10.6. Product multiplayer work remains out of scope._

This phase status concerns multiplayer only; it is not a statement of overall site readiness or production release approval. See `docs/current-status.md` for current operational status and open findings.

## 1. The design in one paragraph

Deterministic lockstep with a thin relay. Every client runs the identical simulation from the same seed; only **commands** travel (attack here, build that, propose a pact), stamped with the tick they execute on. A small WebSocket relay orders and broadcasts them; it never simulates anything. Bandwidth is tiny, cheating is limited to what the command set allows, and the existing engine stays as it is. An authoritative server simulating the map was rejected: it would mean re-implementing the game server-side and paying CPU per match.

## 2. What is already done (Phase 0 — shipped in game 1.5.0–1.6.2)

The historical behaviors below remain supported, but simulation authority now lives behind `game/src/sim/engine.mjs`; `game/src/legacy-game.js` is the Canvas/UI/controller adapter. Coverage is described by the direct-engine, compatibility, replay, browser, and parity suites.

**Determinism**
- The simulation runs on the tick clock only (`tickN`, `simMs = tickN × TICK`, TICK = 100 ms). No `performance.now()` / `Date.now()` inside anything that affects state. Bot build cooldowns, bot think cadence and the Risky-start draft timer all moved to ticks.
- The counted Mulberry32 simulation RNG is per engine; browser-only audio/UI randomness is separate. Compatibility visual descriptors still consume historical deterministic draws inside the engine to preserve approved replay counts, but renderer/event cadence never consumes them. Changing those draws requires a future versioned behavior change.
- Ships and aircraft carry stable ids (`id: ++uidSeq`); structures are addressed by tile; areas by id; players by id.

**Command layer** (`game/src/sim/command-router.mjs` and `deterministic-runtime.mjs`)
- The command log records every player action as `{t, k, a}` with optional acting seat `p`.
- Engine entry points accept click, menu, and simple commands with all issue-time context and optional actor identity; deterministic executors resolve the actor rather than relying on browser UI state. Bots do not enter the human command log.
- `stateHash()` every 100 ticks (owner grid sample + troops/gold/tiles per player + ships + attacks + counts). Recorded in `CMD.hashes`; a replay compares and reports the first divergence.
- `replayFile()` records settings and commands plus periodic and final legacy hash, canonical digest, RNG draw count, command count, and replay cursor evidence. `applySettings()` restores the start card from it; `loadReplayFile(f, 'watch' | 'resume')`.
- Replay driver in `tick()`: applies commands whose `t <= tickN` before advancing. Watch and resume both require the exact recorded target tick and verify final evidence before completion/takeover; post-end continuation is a serialized command.
- `replayCatchUp(target, label, onDone)` runs the sim silently in animation-frame slices behind a progress bar (sounds, notices, log, banners suppressed by `SAVES.catchup`), then waits for Play now / Watch.

**Saves and replays on the site** (plugin ≥ 1.6.0)
- Table `wp_statefall_saves` (user, kind save|replay, slot, seed, map, country, cls, diff, result, tick, game_version, size, data JSON). Limits: 10 saves (Autosave slot never dropped), 20 replays, 96 KB each.
- REST under `/wp-json/statefall/v1/saves` — GET list, GET/DELETE/POST(rename) `/saves/{id}`, POST create/update (`bySlot` for Autosave).
- Game: autosave every 30 s (logged in), Save & quit on the pause modal, automatic replay of every finished match, Games & replays modal, `/play/?load=<id>&mode=resume|watch`. Logged-out users get a register/login card. No browser storage.

**Proof harness** (repository `tools/` and `tests/`)
- `tools/harness.js` directly imports `createEngine()` and exposes a synchronous compatibility facade for existing Node tools. It does not rewrite/evaluate application source or render. Trailer capture uses the browser/Playwright path against an isolated capture build.
- `tools/determinism.js` plays a scripted match through the command layer, replays it cold, and compares hashes. Run `npm run determinism`; set `SEED`, `DIFF`, `GAR`, `QUICK`, and `TICKS` as environment variables when needed.
- `tools/replaycheck.js <file.state>` replays a real player's file and reports the first diverging tick. This is how the `click env` bug fixed in 1.6.1 was found.

**Phase D prerequisites now available**
- Independent browser-free engine instances with isolated setup, state, RNG, commands/replay, and all world systems.
- Seat-tagged command issue and replay application, detached/frozen replay API results, read-only snapshots/presentation views, canonical hash/checkpoint exchange data, and strict full-state checkpoint/restore; the final audit found no production authority return leaks.
- Immutable ordered event queues and presentation ports so UI/audio/controller failures or delivery cadence do not mutate simulation authority.
- Interleaved-engine isolation and old-versus-extracted parity evidence across 7 scenarios, plus the 85/85-command production determinism run.
- Full checkpoints use `statefall-engine-checkpoint/v2` with canonical-compatibility label metadata. V1 is rejected because it cannot reconstruct exact canonical bytes between label-refresh cadences.
- Post-end continuation serialization and resume divergence are closed in candidate 1.10.11; they are not current high findings.

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

Rules that came out of it: simulation reads only deterministic tick time and engine RNG; renderer/audio/UI cadence must not consume engine RNG; every player action goes through the command router with captured context and acting identity rather than live UI state. Historical compatibility descriptor draws are the explicit exception inside the engine and remain fixed until a versioned behavior change.

## 3. Phase 1 — Relay and lobby (next)

Sequencing note: first implement only the relay/lockstep/reconnect architecture proof defined as Phase D2 in `docs/graphics-modernization-plan.md`, using the extracted engine and legacy renderer. Complete lobby, chat, public rooms, and production hosting after that proof; they are not prerequisites for beginning the visual migration.

The browser-free relay authority plus a localhost WebSocket wrapper and two isolated Chromium clients complete the bounded 1.10.12 technical proof. It covers seat/generation authorization, ready-gated start, server-only turns, deterministic total ordering, lifecycle/outcome/checkpoint/final consensus, unresolved replacement recovery, both surrender directions, normalized winners, immutable completion, shared strict replay export, two fresh imports, official replaycheck, desync, and transport bounds. Production authentication, room secrets/ownership, WordPress tokens, general N-human/bot outcomes, disconnect-to-bot, pause voting, lobby/chat/public rooms, multiplayer UI, hosting, abuse controls, observability, persistence, and ranked results remain subsequent product work. See `docs/phase-d2-relay-core.md`.

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
- Desync: every required seat reports normalized batch outcomes and exact checkpoint evidence. This slice has no majority-authority shortcut; any mismatch is terminal and retained as structured evidence.
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

- Game source: Vite application under `game/` (local development: 1.10.32; production: 1.10.7). The 1.10.12 references above describe the historical D2 proof.
- Plugin source: `plugin/statefall-scores/` (current: 1.10.7).
- Tests and build tools: `tests/`, `tools/`, `package.json`, and `package-lock.json`. Run commands from the repository root.
- Release procedure: `docs/build-a-release.md`.

## 9. Working conventions

- Every changed component receives the appropriate version and changelog update; package names match their embedded versions.
- Plugin modules load through a guarded loader; a syntax error in a module is reported as an admin notice, never a white screen. Kill switch: `define('STATEFALL_DISABLED', true)`.
- Static files are served from `/wp-content/uploads/statefall/…` (WP Engine does not route static extensions through WordPress).
- Any determinism-relevant change must pass `npm test` before release.
