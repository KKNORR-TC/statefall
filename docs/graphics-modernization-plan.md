# Statefall Graphics Modernization Plan

_Updated 15 September 2026. Phases 0, A, and B are complete in repository game 1.10.8/plugin 1.10.7._

## 1. Goal

Replace the current monolithic Canvas presentation with a significantly richer, scalable graphics system while preserving Statefall's rules, deterministic command/replay model, saved games, and deployment integrations.

The target is an illustrated strategic command-map aesthetic: tactile terrain, clear national ownership, animated military pieces, readable combat, restrained lighting, and a polished operational interface. The game should remain recognizable as Statefall rather than becoming a different game or a generic 3D RTS.

Success means a player immediately sees a generational visual improvement, while the same seed, settings, and commands still produce the same simulation result.

## 2. Adopted Direction

- Multi-file web application built with Vite.
- JavaScript ES modules initially; do not combine the renderer migration with a TypeScript conversion.
- PixiJS using WebGL for the map, entities, effects, and compositing.
- DOM UI retained initially, then restyled after the map renderer is stable.
- Authored image assets, texture atlases, shaders, fonts, and audio may ship as separate files.
- Fixed 100 ms simulation ticks remain independent from rendering.
- Rendering interpolates between simulation snapshots for smooth motion.
- WordPress deploys complete immutable release directories and selects one active release.
- The full Statefall game is desktop-first. Mobile compatibility is an optional future track and must not reduce desktop depth, information density, controls, or performance.
- Saves, scores, identity, audio policy, lifecycle, and navigation pass through a platform adapter rather than being embedded in simulation or rendering code.
- YouTube Playables compatibility remains a portability guardrail, not a current deliverable or a blocker to normal progress.

Full 3D is not part of this plan. It would multiply art, camera, interaction, performance, and browser compatibility work without improving the strategic game proportionally.

## 3. Visual Language

### Terrain and map

- Layered water with restrained movement, depth variation, coast foam, and wakes.
- Terrain texture and relief that remain subordinate to ownership and unit information.
- Distinct coastlines, rivers, borders, contested fronts, selected areas, and fog of war.
- National color overlays use controlled opacity and blend modes rather than replacing terrain.
- Zoom levels reveal detail progressively: strategic color blocks when distant, terrain and local effects when close.

### Units and structures

- Illustrated silhouettes or compact military miniatures with a consistent scale and viewing angle.
- Texture-atlas animations for aircraft, ships, flags, structures, damage states, and selected high-value actions.
- Stable visual identity by simulation id; display objects never become simulation identities.
- Selection, health, orders, range, and allegiance remain readable under heavy action.

### Combat and atmosphere

- Better shell trails, muzzle flashes, explosions, smoke, fire, debris, wakes, interceptions, and bombardment.
- Restrained bloom, color grading, impact shake, and camera emphasis rather than constant spectacle.
- Effects scale by zoom and quality setting and never obscure required tactical information.
- Reduced-motion mode disables shake, large flashes, and unnecessary ambient movement.

### Interface

- Keep the information architecture familiar during the renderer migration.
- Restyle the start card, sidebar, diplomacy notices, context menus, tooltips, pause flow, saves, and credits as one coherent command interface.
- Use a deliberate type system, spacing scale, icon family, and state colors.
- Make desktop layouts robust across normal monitor sizes and DPI settings. Narrow-screen experiments may inform a future mobile-specific experience but are not a release gate for the full game.

## 4. Non-Goals

- Do not redesign game balance, AI, economy, combat rules, map generation, or diplomacy as part of graphics work.
- Do not change replay command semantics without a separately reviewed format version.
- Do not replace the WordPress account, save, replay, leaderboard, or profile systems.
- Do not port the whole UI to PixiJS. DOM remains preferable for forms, text, accessibility, and responsive panels.
- Do not rewrite all systems at once or delete the legacy renderer before replacement layers pass parity checks.
- Do not build complete multiplayer before graphics modernization. Prove only the highest-risk two-client lockstep path after engine extraction and before the full renderer investment.
- Do not add the YouTube Playables SDK, certification work, ads, or a YouTube release phase without platform access and a separate approval decision.

## 5. Architecture

The simulation must become a renderer-independent engine. A target layout is:

```text
game/
  index.html
  src/
    main.js
    styles.css
    config/
      game-config.js
      maps.js
      units.js
      countries.js
    sim/
      engine.js
      state.js
      rng.js
      commands.js
      replay.js
      map-generation.js
      systems/
    rendering/
      renderer.js
      camera.js
      assets.js
      terrain-layer.js
      ownership-layer.js
      entity-layers.js
      effects-layer.js
      overlay-layer.js
    input/
      controller.js
      context-menu.js
    ui/
      hud.js
      start-card.js
      overlays.js
    integration/
      platform.js
      local-platform.js
      wordpress-platform.js
    audio/
      audio.js
      music.js
  assets-src/
  public/
```

The exact number of modules may remain smaller where splitting provides no useful boundary.

A future YouTube adapter can implement the platform contract if a port is approved. Do not add a placeholder module or load the YouTube SDK before then.

### Engine contract

The engine should expose a narrow API comparable to:

```js
const engine = createEngine(settings);
engine.tick();
engine.issue(command);
engine.loadReplay(replay);
engine.snapshot();
engine.stateHash();
```

`snapshot()` is a read-only presentation view. The renderer may retain interpolation history and visual state, but it must not mutate engine state.

### Renderer contract

The renderer owns PixiJS, camera state, animation clocks, particles, display-object pooling, and visual random noise. It receives snapshots and dirty/version signals from the engine.

Initial layer order:

1. Water and terrain raster.
2. Ownership, borders, rivers, fronts, and fog.
3. Orders, logistics, ranges, and links.
4. Structures and ground markers.
5. Ships, aircraft, transports, and projectiles.
6. Combat and ambient effects.
7. Labels, alerts, selection, and build overlays.

The first Pixi implementation should keep terrain as a generated texture from the existing typed-array raster. It must not create one display object per map tile.

## 6. Determinism Rules

These are release blockers, not preferences.

- Preserve the exact simulation subsystem order in `tick()` until an intentional simulation release changes it.
- Replay commands are applied at the same point relative to tick advancement as today.
- Simulation uses only the seeded simulation RNG and tick-derived time.
- Rendering, particles, audio, interface animation, and camera use separate visual randomness and wall-clock time.
- Remove visual-effect creation from the simulation RNG before changing effect counts.
- Fix seeded randomness inside `sort` comparators before claiming cross-browser determinism.
- Rendering at 30, 60, 120, or zero frames per second must produce identical simulation hashes.
- No module under `src/sim/` may import PixiJS, DOM APIs, Web Audio, `performance.now()`, `Date.now()`, or unseeded `Math.random()`.
- Renderer objects are keyed by stable simulation ids or tile ids; simulation state never stores Pixi objects.
- Existing replay files remain readable unless a format migration is explicitly designed and tested.

## 7. WordPress Deployment Model

The current installer replaces mutable files under `uploads/statefall/`, rewrites selected HTML asset references, and backs up only `index.html`, `howto/`, and `VERSION.txt`. That is unsafe for hashed multi-file builds because rollback could restore HTML whose JS, CSS, or textures no longer exist.

Before the first split build ships, move to complete immutable releases:

```text
uploads/statefall/
  releases/
    1.11.0-build-id/
      index.html
      release.json
      assets/
      howto/
      flags.js
  audio/
  cards/
```

WordPress stores an active-release pointer. Installation extracts and validates a complete staging directory, renames it into its immutable final directory, and only then changes the pointer. Rollback changes the pointer to another complete release. Retain at least the latest five releases and never prune the active release.

### Release manifest

Every game package must contain `release.json` with:

- Manifest schema version.
- Game version and build id.
- Minimum plugin version.
- HTML entry path.
- Shared flags path.
- File list, sizes, and SHA-256 hashes.

Package validation must use the manifest instead of scraping minified HTML. It must reject path traversal, duplicate normalized paths, unexpected executable files, excessive file count or extracted size, invalid hashes, missing entries, and unsupported schemas.

### Runtime configuration and assets

- Vite emits hashed assets with a controlled asset-base placeholder or manifest-driven entry list.
- `/play/` injects WordPress configuration as escaped `application/json`, not executable inline user data.
- `/play/` HTML remains private and uncached because it contains identity and a REST nonce.
- Hashed assets receive one-year immutable caching.
- Release metadata is short-lived or revalidated.
- Plugin pages that use `flags.js` resolve it through the active release or a separately versioned stable plugin asset.
- Deploy the compatible plugin before activating the first multi-file game package.

## 8. Platform Portability Guardrail

YouTube Playables is not a requirement for this modernization and must not delay WorldRTS releases. The architecture should merely avoid choices that would make a later port unnecessarily expensive.

### Shared platform contract

Define a small platform interface for:

- Initial readiness and fatal-error reporting.
- Save/load and save-size reporting.
- Score submission.
- Player identity and capabilities.
- Audio permission and changes.
- Pause/resume lifecycle.
- Locale.
- Navigation and permitted external actions.

WordPress, local development, and any future YouTube build implement that contract. The engine and renderer must not call WordPress REST APIs, inspect `window.STATEFALL_WP`, or depend on platform-specific identity directly.

### Guardrails to retain now

- Keep the application a single-page web app with relative internal asset paths.
- Keep simulation, renderer, and UI usable when WordPress services are unavailable.
- Keep platform-neutral input commands, pause/resume, bounded memory, relative assets, and bundle reporting in normal acceptance gates without requiring touch parity.
- Keep save serialization platform-neutral, versioned, and compact.
- Do not place external links, login assumptions, or sharing behavior inside core game flows; platforms decide which actions are available.
- Do not assume multiplayer exists on every platform. Under current YouTube rules, external relay calls are not allowed, so a future YouTube adapter would expose single-player capabilities unless those rules change.

### Deferred YouTube work

Do not load the SDK or run certification work now. If access and product approval arrive later, the separate port would add SDK readiness, cloud save/load, score, audio, pause/resume, localization, bundle certification, and YouTube-specific UI policy checks behind the existing adapter.

A future mobile/YouTube offering may be a separately designed **Statefall Light** experience that attracts players to the full desktop game. It may simplify presentation, session length, or available systems without redefining the desktop product. No such simplification belongs in the current modernization scope.

Current reference requirements are maintained by Google at [YouTube Playables](https://developers.google.com/youtube/gaming/playables), [SDK integration](https://developers.google.com/youtube/gaming/playables/reference/getting_started), and [certification](https://developers.google.com/youtube/gaming/playables/certification/requirements). Recheck them when a port is actually scheduled.

## 9. Delivery Phases

Each phase should be independently reviewable. Do not begin a later phase while its prerequisite gate is failing.

### Phase 0: Strengthen the test oracle (complete)

- Make every source transformation in the legacy Node harness assert that its target exists exactly once. A missed transformation must fail, not silently run different settings.
- Expand syntax checks to every executable test, tool, and release builder.
- Add a reusable authoritative-state invariant checker and run it periodically in every simulation.
- Add a versioned canonical serializer and SHA-256 digest covering all rule-relevant state, stable ids, references, queues, diplomacy, garrisons, structures, units, projectiles, end state, and simulation RNG state/count.
- Retain the legacy replay hash for compatibility, but do not use it as the only release oracle.
- Make replay verification validate its input, require all commands and checkpoints, reach the intended tick, and exit nonzero on any divergence or command error.
- Commit a sanitized replay fixture corpus spanning maps, modes, command families, saves, end states, and historical supported versions.
- Add Playwright coverage for the current Canvas game in Chromium, Firefox, and WebKit before changing its architecture.
- Create one top-level verification command and CI-required checks so tested source and released source cannot drift unnoticed.

Gate: the current Canvas build passes invariants, canonical digest replay checks, strict replay verification, and the initial cross-browser suite. No Vite modularization or engine extraction begins before this gate passes.

Status: PASS for repository game 1.10.8. The approved simulation and visual references are recorded in `docs/testing-baselines.md`.

### Phase A: Baseline and visual prototype (complete)

- Capture reference screenshots and representative replays for all maps, modes, zoom levels, and major unit classes.
- Record current performance on named desktop hardware. Mobile emulation may be recorded as advisory evidence.
- Add browser coverage for launch, resize, pan, zoom, click targeting, context actions, and replay playback.
- Produce a small art-direction board and one representative vertical slice: terrain, ownership, one structure, one ship, one aircraft, and one combat event.
- Confirm asset licensing and retain source files separately from generated atlases.

Gate: approve the illustrated command-map direction and demonstrate the vertical slice at acceptable readability and performance.

Status: PASS on 15 September 2026. Ken approved the overall direction after reviewing the prototype on the host display; automated desktop DPR, map, mode, dense-action, replay, visual, and performance evidence is indexed in `docs/phase-a-evidence.md`. Unit art remains unapproved and reserved for Phase G.

### Phase B: Deployment foundation

- Add manifest-based packages and strict ZIP validation to the plugin.
- Add immutable release directories, atomic activation, complete rollback, retention, and health reporting.
- Replace broad HTML asset rewriting with a controlled asset-base mechanism.
- Add sandbox tests for install, failed install, activation, cache paths, rollback, and pruning.
- Keep legacy single-file package support only if required for existing rollback artifacts; otherwise explicitly retire it.

Gate: a synthetic multi-file package can install, activate, roll back, and reinstall without missing or mixed assets.

Status: PASS on 15 September 2026 in repository plugin 1.10.7. Deterministic exact ZIPs, malicious fixtures, disposable WordPress installation, immutable staging/activation/rollback/retention, legacy root compatibility, health/admin paths, and runtime MIME/cache behavior pass `npm run verify:artifacts`. Production is unchanged; this status is the repository phase gate, not deployment approval.

### Phase C: Modular build without visual change

- Add Vite and a development server.
- Split static data, styles, platform integration, audio, and utility code into ES modules.
- Preserve the existing renderer and gameplay behavior.
- Replace release tools that scrape/evaluate inline HTML with direct module imports.
- Produce `dist/` and the release manifest through one reproducible build command.

Gate: visual behavior is materially unchanged, all existing tests pass, and the built app works directly and through the WordPress sandbox.

### Phase D: Simulation/presentation boundary

- Wrap mutable simulation state in an engine instance.
- Extract seeded RNG, commands, replay, map generation, and tick systems without reordering behavior.
- Convert the Node harness to import the engine rather than rewriting/evaluating HTML.
- Move visual effects and presentation-only state out of simulation collections.
- Replace simulation calls to drawing code with dirty/version signals.
- Add snapshot interpolation data without changing authoritative state.

Gate: old and extracted engines produce identical checkpoint and final canonical digests for the same replay corpus. Tests run without DOM, Canvas, or PixiJS.

### Phase D2: Minimal multiplayer architecture proof

- Use the extracted engine and legacy Canvas renderer to run one two-human match through a thin relay.
- Replace the single-human `me` assumption with acting-seat identity only where the proof requires it.
- Carry seat ids on commands and verify ordered execution at both clients.
- Exchange canonical checkpoint digests and surface a deliberate desync.
- Disconnect and reconnect one client by replaying the retained room command log.
- Complete one match and produce one valid replay containing both human seats.
- Keep lobby polish, public rooms, chat, spectators, ranked results, and final multiplayer UI out of this proof.

Gate: two independent clients complete the same match with identical canonical digests, and reconnect returns a client to the canonical room state. Resolve structural engine/command issues before beginning the full Pixi renderer.

### Phase E: Pixi renderer foundation

- Add PixiJS behind a renderer interface and a development-only renderer switch.
- Implement DPR-aware sizing, camera transforms, viewport culling, resize focus preservation, and precise mouse/pointer input. Keep input commands abstract enough for a future touch adapter.
- Port the existing terrain/ownership raster as textures first.
- Establish texture loading, atlases, object pooling, quality levels, and diagnostics.
- Keep the legacy renderer available for comparison until parity is reached.

Gate: every map and mode is playable through Pixi with correct targeting, fog, borders, selection, and stable simulation hashes.

### Phase F: Terrain and world art

- Implement the approved water, coastline, relief, terrain texture, rivers, ownership, border, and fog treatments.
- Add zoom-dependent detail and cached/dirty layer updates.
- Ensure political readability under every national color combination.
- Tune color-blind distinguishability and high-contrast overlays.

Gate: approved screenshot matrix across supported desktop sizes and DPI settings, with no loss of gameplay information.

### Phase G: Units, structures, and combat

- Introduce atlased art for every structure, ship, aircraft, projectile, transport, and state variation.
- Add interpolation, heading animation, wakes, damage, recoil, launch, landing, and destruction states.
- Replace legacy particles with renderer-owned pooled effects.
- Add restrained lighting, weather/ambient effects, and camera feedback.
- Scale density and effects through quality and reduced-motion settings.
- Use `docs/unit-art-review.md` as the authoritative Phase G review register. Reconcile it with the current game roster before review begins and add a row whenever an entity or render category is added.
- Review art unit by unit, not as a single montage or general art-direction approval. For each row, capture deterministic comparison scenes for every applicable normal, selected/targeted, damaged/disabled, building/upgrading, action/motion, and destruction state; all representative faction colors; and strategic, mid, and close zoom levels.
- Present each row to a named human reviewer with its evidence links. Record `Pending`, `Changes requested`, or `Approved`, the reviewer, and actionable notes; automation, implementation completion, silence, or approval of the overall illustrated command-map direction does not approve a row.
- Revise every row with requested changes and repeat its applicable state/color/zoom review. Keep superseded evidence identifiable rather than silently replacing the review history.

Gate: every current row in `docs/unit-art-review.md` is reconciled to the shipped roster and explicitly marked `Approved` by a named human reviewer; requested changes are resolved; every gameplay entity and action has a clear visual representation across its applicable states, faction colors, and zoom levels; and large battles remain within performance budgets without obscuring commands. Any pending, unassigned, missing, or newly added row keeps Phase G open.

### Phase H: Interface modernization

- Apply the command-interface visual system to the HUD, start flow, menus, diplomacy, notices, pause, saves/replays, credits, and onboarding.
- Add keyboard focus, semantic labels, desktop DPI handling, and responsive desktop panel modes.
- Preserve familiar task locations unless usability testing supports a change.

Gate: complete keyboard flow for primary menus and approved desktop interaction tests across supported monitor sizes and DPI settings.

### Phase I: Stabilization and release

- Remove the legacy renderer only after parity, replay, performance, and visual gates pass.
- Run full Node, browser, PHP, sandbox, package, rollback, security, and production-size determinism suites.
- Test anonymous and authenticated `/play/`, old save/replay loading, long sessions, hidden-tab recovery, and nonce expiry.
- Build a release candidate, inspect all archive paths/hashes, and perform a staged production rollout with a complete restore point.

Gate: release record is GO and production smoke verification passes before the release is declared complete.

### Deferred product track: Statefall Landings

Statefall Landings is a future tactical mode for contested ocean invasions. It is recorded here so the engine, renderer, input, save, replay, and multiplayer boundaries do not make it unnecessarily difficult later. It is not part of the graphics release gate and implementation is not yet approved.

#### Intended experience

- When an ocean invasion establishes a contested beachhead, the campaign can transition into a short real-time ground battle inspired by the control feel of classic Red Alert.
- The attacker brings a campaign-derived force aboard transports, assigns its available units among landing craft, deploys waves, and controls individual units or groups ashore.
- The defender begins with campaign-derived troops, prepared positions, and static defenses.
- Infantry, armor, anti-armor, artillery, engineers, and defenses form a compact counter system rather than a second full technology tree.
- The result returns to the strategic campaign as a beachhead, repelled landing, survivor totals, losses, retreat state, and possible follow-up capacity.

#### Strategic integrity

- Campaign force strength and composition determine tactical deployment budgets, reserves, landing-craft capacity, and defender preparation.
- Overwhelming strategic force should produce an overwhelming tactical advantage; comparable forces should reward execution; an understrength attack should require exceptional play and favorable circumstances.
- The tactical layer must not erase investment, logistics, fleet composition, coastal defense, or losses already determined by the campaign.
- Unit counts may be represented at tactical scale rather than one tactical object per strategic troop, but conversion rules must be explicit, stable, and testable.

#### Architectural allowance

- Treat Landings as a separate deterministic simulation mode with its own seeded RNG stream derived from campaign seed plus operation id.
- Never consume or reorder the strategic simulation RNG while the tactical mode runs.
- Use a separate tactical command log for deployment, selection, grouping, movement, and attacks, linked to the parent campaign replay.
- Support a clean lifecycle: snapshot/suspend campaign, start tactical mode, save/replay tactical state, apply a validated outcome, then resume campaign.
- Let renderers switch world scenes without placing Pixi objects or input events in simulation state.
- Keep the platform save format able to contain a suspended campaign and active tactical operation without knowing their rendering implementation.
- In multiplayer, the architecture may allow attacker and defender control plus spectators, but the strategic room must not advance inconsistently while a tactical battle is active.

#### Tentative roadmap placement

- Preserve the mode/lifecycle boundaries during Phase D engine extraction.
- Use lessons from the Phase D2 multiplayer proof for tactical ownership, command routing, pause, spectators, and reconnect.
- Revisit a narrow Landings vertical slice after Phase E establishes Pixi rendering, camera, selection, grouping, input abstraction, and deterministic browser fixtures.
- Limit any first slice to one beach, a small representative unit roster, landing craft, generated defenses, simple enemy AI, and outcome transfer back to a test campaign.
- Full production development follows a separate approval decision and should not block completion of the main graphics modernization release.

#### Decisions intentionally deferred

- Whether Landings is a campaign option, separate mode, automatic event, or player-selected resolution.
- Which invasions trigger a battle and how repeated transport waves join one operation.
- Whether auto-resolve is always offered.
- When loadouts become committed and whether landing-craft assignments can change near shore.
- Tactical battle duration, map scale, unit roster, support abilities, retreat, reinforcement, and loss-conversion rules.
- How multiplayer participants, nonparticipants, spectators, pause voting, disconnects, and time limits behave.
- Whether the mode needs a touch-specific control scheme or remains primarily a desktop feature.

These decisions belong to the vertical-slice design review, when engine, multiplayer, renderer, and input constraints are measurable rather than speculative.

## 10. Performance Budgets

Initial budgets, to be validated in Phase A:

- 60 fps target at 1440x900 on a representative current desktop during normal play.
- Mobile-emulated measurements are advisory only unless a separate mobile or Statefall Light project is approved.
- No simulation slowdown when visual quality is reduced or rendering is paused.
- DPR capped by quality tier to avoid excessive render-target size.
- Viewport culling for dynamic entities and bounded pools for transient effects.
- Terrain/ownership textures update only when their source state changes.
- Avoid per-frame full-map scans and per-frame nested scans across unrelated entity collections.
- Set a compressed initial-download budget after the vertical slice; every large texture, font, and audio addition must be visible in a build report.

Quality tiers should control resolution scale, particles, trails, lighting, water detail, ambient effects, and post-processing without changing simulation state.

## 11. Testing and Release Gates

### Current assessment

The existing suite is valuable but is not sufficient to protect the modernization work by itself.

| Existing check | What it currently proves | Important limitation |
|---|---|---|
| `tests/smoke.js` | Ten reduced-grid scenarios survive 300 ticks with basic finite state. | Partial maps/modes, weak invariants, rendering disabled. |
| `tests/restart-replay.js` | Standard, fog, and garrison commands replay in the same process. | Few command families, reduced grid, incomplete state hash. |
| `tools/determinism.js` | One production-grid replay repeats under one Node/V8 build. | Same engine/process, one main scenario, no browser comparison or rendering cadence. |
| `tests/security.js` | Focused replay-name normalization remains present. | Does not execute the vulnerable flow in a real DOM/browser. |
| `tools/replaycheck.js` | Helps a developer inspect a replay. | Does not currently fail the process reliably on divergence or malformed input. |
| `tools/harness.js` | Runs the monolithic game quickly under Node stubs. | Rewrites exact source strings, stubs timers/DOM, bypasses rendering, and cannot survive modules unchanged. |
| `sandbox/verify.ps1` | PHP syntax, public routes, one admin nonce session, and basic save CRUD. | Tests mounted source, not installable ZIPs; mostly positive paths. |
| `sandbox/security-regression.ps1` | Focused save/replay quota, migration, sanitization, and bot-record regressions. | Separately invoked and incomplete for auth, lifecycle, package, and failure paths. |
| Manual screenshots/release checks | A human inspected selected views and production behavior. | No committed baseline, repeatability, browser matrix, or automatic failure signal. |

The current suite can continue as a fast smoke layer, but passing it must not be described as full renderer, browser, package, rollback, or cross-engine proof.

### Stability policy

- Test the exact production artifacts, not only source directories mounted into a sandbox.
- Every bug fixed during modernization receives a regression test at the lowest useful layer.
- Existing coverage remains active until replacement coverage proves the same behavior. Harness migration is additive first and subtractive last.
- A missing fixture, skipped checkpoint, swallowed exception, failed asset request, browser console error, or incomplete command log fails verification.
- Simulation tests use explicit seeds and deterministic command fixtures. Visual tests freeze presentation time and visual randomness where comparison requires it.
- Test-only APIs are enabled only in development/test builds and are excluded from production output.
- Hash equality is supported by invariants and structured snapshot diagnostics; it is not the sole assertion.
- Performance gates run on named stable hardware. Software-rendered CI remains useful for correctness but does not certify frame rate.
- Release records identify the source commit, built artifacts, fixture revision, browser projects, canonical digest version, visual baseline revision, and performance report.

### Test architecture

#### Fast simulation layer

Keep the existing Node scripts while the game remains monolithic. Add:

- `assertStateInvariants(engine)` at setup and regular tick intervals.
- Strict expected-match helpers for every temporary legacy-harness source transformation.
- Table-driven coverage for every map and individual mode, then selected pairwise combinations.
- Command-family scenarios for structures/upgrades, ships/orders, transports, aircraft, missiles, diplomacy, aid, automation, garrisons, pause, draft, and stale/invalid ids.
- Actual victory, defeat, overrun, spectate, keep-playing, credits, final replay, and post-end save/resume paths.
- A controllable scheduler for timers and animation frames instead of callbacks that never run.
- Separate-process cold replay comparisons so process globals cannot conceal state leakage.

When ES modules exist in Phase D, move engine unit and contract tests to Vitest or an equivalent module-aware runner. The extracted engine must run without DOM, Canvas, PixiJS, Web Audio, or network access. Keep a temporary compatibility facade for tools until all callers migrate.

#### Authoritative state oracle

Create a stable serializer for all simulation-authoritative state. It must include at least:

- Tick, settings, seed, seeded RNG internal state, and draw count.
- Players, ownership, troops, economy, diplomacy, proposals, teams, and end/freeplay state.
- Garrisons, areas, structures, queues, cooldowns, upgrades, and references.
- Attacks, transports, ships, aircraft, missiles, projectiles, automation, and stable ids.
- Replay cursor, command application state, and other state that can change future simulation output.

Serialize in a documented stable order and produce a versioned SHA-256 digest. Keep structured snapshots available on failure so the first differing path can be reported. Do not silently change a digest schema; increment its version and update fixtures deliberately.

#### Invariant harness

At regular checkpoints assert:

- All numeric authoritative values are finite and within valid ranges.
- Owner/player/entity references are valid and stable ids are unique.
- Player tile totals exactly match ownership data.
- Entities and tile references are in bounds.
- Structure occupancy, queues, area totals, and collections are internally consistent.
- Removed entities are not retained by authoritative references.
- End-state, replay cursor, and command-consumption relationships are valid.

These assertions should run in smoke tests, replay fixtures, benchmarks, and browser-driven simulations. Expensive invariants may run less frequently in long scenarios but remain mandatory at start, checkpoints, and completion.

#### Replay corpus

Store sanitized, versioned fixtures under `tests/fixtures/replays/`. Each fixture records its schema, originating game version, seed, complete settings, commands, checkpoints, expected final digest, expected result, important entity/event counts, and named screenshot moments.

The corpus must cover:

- Every map and each mode, including meaningful combinations such as fog plus garrisons and team games.
- Every deterministic command family and each unit/structure class.
- Early, mid, late, and dense end-game states.
- Victory, defeat, overrun, spectate, keep-playing, save/resume, replay takeover, and restart.
- Historical save/replay versions that remain supported.
- Malformed, truncated, oversized, unknown-version, and adversarial files.
- The seeded-sort tie case and every future determinism regression.

`tools/replaycheck.js` becomes a strict verifier with a useful usage error and nonzero exit status for schema errors, missing checkpoints, command exceptions, unapplied commands, failure to reach the target tick, digest mismatch, or replay mismatch. A separate diagnostic mode may print detailed differences without weakening verification mode.

#### Renderer-independence harness

Replay identical fixtures and compare canonical digests under:

- No renderer.
- Legacy Canvas renderer.
- Pixi renderer while both exist.
- Fixed 15, 30, 60, and 120 fps schedules.
- Irregular, burst, paused, and hidden-tab schedules.
- Different wall-clock origins, resize sequences, DPR values, quality levels, and reduced-motion settings.

All runs must produce identical authoritative digests. Presentation collections and object pools must remain bounded even when rendering pauses or resumes.

#### Browser harness

Playwright is the browser solution for the current Windows development environment. Most browser tests run against a local static server and do not require Docker. Add before modularization:

- `@playwright/test` and repository-owned browser configuration.
- A small local static server that serves the current game and fails cleanly on missing files.
- `tests/browser/` suites for launch, maps/modes, camera, targeting, pointer input, desktop layout, replay, WordPress behavior, accessibility, visual regression, context loss, and performance scenes.
- Browser binaries managed by Playwright rather than relying on whichever system browser happens to be installed.
- A localhost/test-build bridge exposed as `window.__STATEFALL_TEST__` for readiness, fixed settings, simulation stepping, visual-clock control, fixture loading, camera transforms, canonical digest, and renderer diagnostics.

While the monolithic build remains, the bridge may be dormant unless a value installed by Playwright before page load explicitly enables test mode. It must expose no production mutation path. Once Vite exists, include it only in development/test builds.

Required projects on normal change verification:

- Chromium desktop at 1440x900, DPR 1.
- Firefox desktop at 1280x720.
- WebKit desktop at 1280x720.
- Chromium with reduced motion.

Advisory scripts retain Chromium and WebKit mobile emulation, but failures do not block the full desktop game. A future mobile project defines its own physical Android/iOS qualification matrix. Release qualification for the full game additionally includes current Windows Chrome/Edge and Firefox ESR where supported.

Treat page errors, console errors, unhandled rejections, failed required requests, missing assets, and test timeouts as failures. Retain trace, screenshot, and video artifacts on failure.

Fast browser tests intercept the platform boundary with deterministic local fixtures for anonymous, authenticated, offline, expired-session, and error responses. A smaller Playwright project runs against the Docker WordPress sandbox only for real cookie/nonce, persistence, package, MIME, and cache integration; it follows the mandatory startup and shutdown lifecycle in `AGENTS.md`.

Browser scenarios include:

- Anonymous and authenticated startup, asset completion, REST success/failure, offline behavior, malformed responses, stale nonce, and long-lived tabs.
- Camera pan/zoom, resize, DPR, world/screen coordinate round trips, click targeting, context actions, pointer capture, and cancellation.
- Start/settings, pause, saves/replays, replay speed/takeover, credits, victory/defeat, notices, and error states.
- WebGL startup, disabled/unsupported WebGL behavior, context loss, and renderer recovery without simulation loss.
- Keyboard flow, focus management, responsive overflow, reduced motion, and automated accessibility checks.

The test bridge supports deterministic setup and diagnostics, but real pointer, keyboard, resize, and public UI tests must still exercise the public interface.

#### Visual regression harness

Use Playwright screenshots with presentation time, visual randomness, fonts, fixture state, camera, and viewport fixed. Chromium is the primary pixel-baseline project. Firefox and WebKit emphasize functional rendering and semantic assertions; add engine-specific image baselines only where they provide stable value. Do not hide missing entities behind a broad whole-image tolerance.

The baseline matrix includes:

- Start/settings, map overview, strategic/mid/close zoom, and every map family.
- Ownership adjacency, borders, fog, garrisons, selection, build overlays, ranges, and context menus at viewport edges.
- Every structure/unit class and dense fleets, aircraft, missiles, shields, bombardment, and maximum effects.
- Replay, pause, save, error, divergence, victory, and credits states.
- Supported desktop dimensions, DPR 1/2, quality tiers, and reduced motion. Portrait/mobile references are advisory.

Semantic assertions accompany screenshots: no horizontal document overflow, no required control outside the viewport, context menus remain visible, target coordinates map to the expected tile, and tactical states remain distinguishable.

#### Performance harness

Drive fixed replay/scene fixtures in a real browser and record startup/resource timing, frame-time distribution, long tasks, heap trend, display-object/pool counts, draw calls, texture count, and texture-memory estimates.

Required scenes include cold start, normal mid-game, full-map zoom, dense fleet combat, aircraft/bombardment/particle stress, fog/radar overlap, rapid pan/zoom, resize/orientation, accelerated replay, hidden-tab recovery, context loss, and a repeated long-session soak.

Initial gates:

- Desktop normal scene: target 60 fps, p95 frame time at or below 16.7 ms and p99 at or below 33 ms on named reference hardware.
- Mobile normal scene: minimum 30 fps with p95 at or below 33.3 ms and no sustained repeated stalls on named reference hardware.
- No unbounded heap, texture, display-object, or transient-pool growth across repeated fixtures.
- Build output reports compressed JS, CSS, texture, font, audio, and initial-download sizes.

Final memory and download limits are set from Phase A measurements rather than guessed before representative assets exist.

#### WordPress and package harness

Retain the fast mounted-source sandbox, but add a disposable writable WordPress environment that installs the exact built ZIPs using WordPress's upgrader path or WP-CLI.

Automate:

- Fresh plugin install/activation, upgrade from supported production versions, deactivate/reactivate, failed upgrade, and data preservation.
- Game package install, manifest/hash validation, activation, complete rollback, reinstall, retention, and pruning.
- Valid package plus corrupt ZIP, missing asset, wrong hash, duplicate/case-colliding path, traversal, absolute path, forbidden executable/dotfile, excessive file count/size/depth, and interrupted staging fixtures.
- Rollback with warm caches and verification that every active HTML, JS, CSS, texture, font, flags, and how-to asset belongs to one release.
- Correct MIME and cache headers for private `/play/` HTML, release metadata, and immutable hashed assets.
- Anonymous, subscriber, second-user, and administrator authorization; missing/invalid/expired nonce; cross-user object access; malformed methods and payloads.
- Database migration from fresh and supported historical schemas, non-default table prefix, concurrent Autosave/save/score operations, and injected filesystem/database failures.
- Leaderboard, profile, scores, saves, replay, credits, flags, music, reports, moderation, and how-to behavior against installed artifacts.

The package that passes this harness is the package handed off. Rebuilding or manually rezipping after verification invalidates the result and requires rerunning artifact checks.

### Phase-by-phase test deliverables

| Phase | Required harness work before its gate can pass |
|---|---|
| 0 | Strict legacy harness, complete syntax coverage, invariants, canonical digest, strict replay verifier, initial corpus, Playwright Canvas suite, top-level verification command, CI. |
| A | Committed Canvas screenshots, replay scenes, interaction baseline, named-hardware performance report, vertical-slice acceptance scenes. |
| B | Exact-ZIP install/upgrade tests, malicious package fixtures, atomic activation failure tests, complete rollback, retention, MIME/cache, and warm-cache checks. |
| C | Vite dev and production-build browser suites, no failed chunks, source-versus-built behavior, reproducible manifest/archive, and bundle report. |
| D | Direct engine unit/contracts, old-versus-extracted corpus comparison, fresh-process isolation, import-boundary checks, renderer-cadence independence. |
| D2 | Two real clients through the relay, seat-tagged commands, canonical digest exchange, deliberate desync detection, disconnect/reconnect catch-up, and a complete two-human replay. |
| E | Dual Canvas/Pixi projects, camera/coordinate/input/DPR tests, WebGL capability/context recovery, renderer purity, and Pixi diagnostics. |
| F | Terrain/fog/border screenshot matrix, ownership-color readability, dirty-layer behavior, map-update and viewport performance. |
| G | Reconciled unit-art register; per-row state/faction-color/zoom evidence and named human approval; every entity/action scene; animation/effect screenshots; pool/culling limits; stress performance; reduced-motion and quality-tier behavior. |
| H | Desktop overflow/DPI, keyboard flow, focus/dialog behavior, axe checks, reduced motion, forced colors, and manual accessibility record. |
| I | Full exact-artifact suite, complete browser/device matrix, old saves/replays, long-session/hidden-tab/nonce tests, production-like rollback, and signed release evidence. |
| Landings prototype, if approved | Tactical command/replay determinism, strategic-to-tactical force conversion, outcome conservation, suspend/save/resume, AI scenarios, selection/group input, multiplayer ownership, and campaign return. |

### Verification commands and CI

Create stable top-level commands as the harnesses arrive:

- `verify:fast`: syntax, unit, invariants, smoke, command scenarios, restart/replay, and canonical determinism.
- `verify:browser`: required Playwright browser projects and visual checks.
- `verify:sandbox`: PHP, REST, database, security, auth, and mounted-source checks.
- `verify:artifacts`: build exact ZIPs, inspect manifests/hashes, install them, activate, roll back, and run artifact-backed smoke checks.
- `verify:release`: all applicable suites plus performance/device evidence required by the release record.

CI must run fast and browser checks for every change and artifact/sandbox checks for release candidates. Node 22 and the current supported Node line should be represented. Local Docker-backed browser or artifact runs follow `AGENTS.md`: start only when needed and always finish with `.\sandbox\stop.ps1 -DockerDesktop`. No release is GO with skipped required jobs, changed fixtures without review, unexplained screenshot updates, or a dirty/rebuilt artifact after verification.

### Accessibility gates

- Automated accessibility scans must report no serious or critical violations.
- Primary menus and documented map commands require a keyboard-operable path with visible focus.
- Dialogs trap and restore focus; important notices and replay divergence are announced.
- Reduced motion disables camera shake, large flashes, and unnecessary ambient animation.
- Manual release checks cover keyboard-only use, Windows screen reader, ownership/selection color distinction, and supported desktop display configurations.
- An accessible name on the Pixi canvas alone is not sufficient; provide keyboard camera/selection commands and a meaningful selection/status summary.

## 12. Release Readiness Rule

Graphics modernization Phase A is complete with automated Canvas map/mode/input baselines, desktop DPR and performance evidence, dense action and replay scenes, advisory mobile emulation, and an approved high-level visual direction. Unit graphics remain explicitly unapproved until Phase G. Phase B artifact installation and rollback gates have passed; no multi-file production candidate ships without continuing to pass them.

The release safety rule is: the candidate must pass simulation invariants and canonical replay digests, required real-browser projects, exact-artifact WordPress installation/rollback, visual review, and performance budgets. A green legacy `npm test` alone is not release approval.

## 13. Main Risks and Controls

| Risk | Control |
|---|---|
| Refactor changes simulation behavior | Extract incrementally and require replay hash equality at every phase. |
| Visual code consumes simulation randomness | Separate RNG ownership before graphics changes. |
| Pixi migration becomes a full rewrite | Replace one renderer layer at a time behind an interface. |
| New art reduces strategic readability | Approve a vertical slice and test every national color/zoom combination. |
| Multi-file rollback restores missing chunks | Use immutable complete release directories and pointer rollback. |
| Mobile GPU or memory limits | DPR cap, atlases, culling, pooling, quality tiers, and measured budgets. |
| Tooling migration loses test coverage | Import the engine directly and retain the current harness facade until callers migrate. |
| Old saves or replays diverge | Preserve command semantics and maintain a representative replay corpus. |
| Asset licensing becomes unclear | Track source, author, license, and generated outputs in an asset inventory. |
| Scope expands into gameplay redesign | Treat gameplay changes as separate proposals and releases. |

## 14. Decisions Before Implementation

The following are adopted unless deliberately revised:

- Art direction: illustrated strategic command map.
- Renderer: PixiJS/WebGL, not full 3D.
- Build: Vite with JavaScript ES modules.
- UI: DOM first; Pixi owns the world view.
- Migration: incremental renderer replacement, not a ground-up rewrite.
- Deployment: immutable complete releases with a manifest and active pointer.
- Compatibility: preserve current replay and save semantics.
- Platform portability: keep Playables possible through a generic platform contract, but do not implement its SDK or certification now.
- Product priority: protect the full desktop game's complexity. Mobile is optional and may become a separate Statefall Light product rather than a constrained version of the desktop game.
- Multiplayer sequencing: prove two-client lockstep after engine extraction; do not finish multiplayer before visual modernization.

Decisions still requiring a concrete prototype or measurement:

- Exact unit illustration style and animation density.
- Supported browser/version matrix and whether a non-WebGL fallback is required.
- Final asset download and texture-memory budgets.
- Whether legacy Canvas remains available as a low-quality renderer after launch.
- Whether shared flags remain in each game release or become a versioned plugin asset.

## 15. Immediate Work Order

1. Begin Phase C Vite modularization and introduce the Local/WordPress platform boundary on the completed Phase B deployment foundation.
2. Preserve the Phase B exact-artifact suite as a required gate for every subsequent package change.
3. Extract the deterministic engine, then complete the Phase D2 two-client multiplayer proof using the legacy renderer.
4. Resolve issues found by the multiplayer proof before beginning the full Pixi terrain and entity migration.
5. At the Phase E gate, review the deferred Statefall Landings decisions and decide whether to authorize its narrow vertical slice.

No production graphics package should be built until Phases B through D pass their gates.
