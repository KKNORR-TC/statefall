# Local comprehensive qualification

Run from the authoritative repository with Node 22.12–22.x. No production services, accounts, Docker containers, or deployments are used.

## Simulation coverage

- `node tools/qualification/matrix.js --resume --jobs=4 --ticks=300`
  runs all 12 maps × six difficulties × 16 named mode profiles (1,152 cases), records real commands, checks invariants and tick progress, then verifies canonical replay bytes, RNG draw counts and command cursors.
- `node tools/qualification/soak-matrix.js --jobs=2 --ticks=6000`
  runs every map/difficulty plus a second endgame seed per map (84 campaigns). The second-seed campaigns continue past ordinary victory/defeat into free play or spectating; total victory may finish earlier. Each campaign records its actual duration, endings, actor peaks and replay result.
- `node tools/qualification/unit-campaign.js islands_m hard`
  builds all 20 structures, upgrades the port and airfield, launches all eight naval combat classes, both transports, all three aircraft and a spy plane, refits a battleship, and launches a missile through normal commands. It verifies 2,100 ticks and exact replay. Other verified fixtures use `random supereasy` and `world normal`.
- Existing `npm run verify:fast` adds subsystem regressions, command/security boundaries, multiplayer relay and recovery, historical replay corpus, reset/isolation, and determinism.

- `node tools/qualification/summarize.js` audits every expected case against the current simulation fingerprint and exits nonzero until both matrices and all three roster replays pass.

Use `--filter=atoll-impossible-SOAK5B --jobs=1 --progress` on the soak runner to isolate a case. Add `--profile` to capture a CPU profile; the watchdog budget remains unchanged. Slow ticks retain their tick number and actor counts. Use `--exclude=case-id,case-id` to avoid duplicating cases already running in isolated workers.

Reports live in `docs/evidence/comprehensive/`. Matrix and soak JSONL logs retain earlier revisions. Only entries with the current simulation fingerprint qualify the current source. Resume skips passing cases for that fingerprint only. Wall-clock CPU timings from concurrent runs are diagnostic, not browser frame-rate measurements.

## Browser and artwork coverage

Start the local Vite server on port 4173.

- `node tools/qualification/roster-art.js`: 16 mobile classes × eight headings, blends, all 20 buildings, team colors, upright-camera and bounded-memory checks; writes visual galleries.
- `node tools/qualification/roster-cache-stress.js`: 256 mixed units from eight countries; verifies that the warmed working set stays cached under 64 MiB instead of repeatedly rebuilding.
- `node tools/qualification/roster-replay-browser.js`: replays the complete-roster island campaign in Chromium, Firefox and WebKit; checks divergence, load errors and rendering purity.
- `node tools/qualification/late-game-browser.js [replay.json]`: resumes a recorded 6,000-tick dense campaign (Atoll by default), checks exact browser replay, then measures another 12 seconds of live medium-zoom play. Final cases include Atoll, Europe, Africa and Middle East. Progress and timeout diagnostics are retained; optional `--profile` writes an ignored CPU profile. Run after simulation workers finish.
- `node tools/qualification/sprite-culling-browser.js`: pixel-identical culling against an uncropped reference for all 16 mobile classes and 20 structures, at viewport edges, DPR 1/1.5 and rotated transforms in three browser engines.
- `node tools/qualification/catchup-timer-browser.js`: deterministically interleaves the ordinary timer with replay catch-up and checks that only catch-up advances ticks, then verifies exact replay and an enabled Play now action.
- `node tests/presentation-step-clock.js`: equivalent elapsed lifetimes across 10–144 Hz, bounded long-gap catch-up, exact batched effect movement/emission and zero-step purity.
- `node tools/qualification/front-path-browser.js`: compares implicit and explicit polygon closure pixel-for-pixel in three browsers and times a 147,908-tile fragmented front.
- `node tools/qualification/classic-worker-browser.js`: compares worker terrain with the main renderer at DPR 1 and 1.5, verifies full-resolution composited attack fronts and exact offscreen-particle culling, and tests the unsupported-browser fallback. Firefox terrain is pixel-identical; Chromium OffscreenCanvas sampling has a reviewed mean channel tolerance of 2/255 and maximum 64/255.
- `node tests/classic-terrain-client.js`: copied inputs, bounded queue and diagnostics, camera coverage, reset races, worker errors/timeouts and teardown.
- `node tests/checkpoint-origins.js`: retired attack/transport origin acceptance and atomic malformed-origin rejection.
- `node tests/area-labels.js`: compares batched sidebar labels to the original reference and asserts linear region lookup counts for 5,000 areas.
- `npm run test:browser`: existing desktop, reduced-motion, source and built module contracts.
- `npm run test:desktop-scale`: DPR 1, 1.5 and 2.
- The `tools/classic-*-review.js` and `tools/classic-*-performance.js` scripts exercise real menus, ship orders, fog, credits, camera motion and attacking play.

Run performance probes without concurrent simulation jobs. Run the densest Africa and Middle East second-seed campaigns with `--jobs=1 --filter=<case-id>` after other CPU-heavy workers finish; their full record/replay check retains the same 360-second watchdog. Interrupted broad runs resume from current-fingerprint passing cases. Do not edit source while browser suites run: Vite reloads destroy their test contexts. Preserve failing artifacts, diagnose the cause, and rerun without widening ceilings.

## Scope and interpretation

This is a finite regression matrix, not proof that every seed, binary-option combination, hardware configuration, or arbitrary action sequence is bug-free. Named profiles and actual simulated durations are explicit in the evidence. Classic art is included in the current production candidate; development previews still use ?art=classic. A production release still needs the separate release and Docker artifact gates in `docs/build-a-release.md`.

The portable math implementation preserves historical Node/V8/fdlibm results across browser engines. Its source notice and upstream V8 license are retained; exact-output tests cover over 530,000 numeric cases plus full cross-browser roster replay. Historical replay baselines were not regenerated to accept the fix.
