# Statefall 1.10.54 — classic motion testing patch

28 September 2026. Ken approved the reviewed animation study and explicitly requested integration and the game ZIP only. Source base b037e7d; the local patch commit contains this record. No production installation is authorized by this handoff.

Game 1.10.54; build 2026-09-28-classic-motion; required plugin 1.10.9, unchanged. Simulation baseline remains 1.10.8.

Package: statefall-release-1.10.54.zip
SHA-256: 9d0fd5485cf3719ac6c1ac6d945027edb02612340bdca9abf32dd19401410355

## Changes

Integrates the reviewed procedural effects for the game's buildings, ships, aircraft and support units, including upgraded buildings. The 40-card study and gameplay share the effect painter. Window activity, apron lights, command-building signals, defensive perimeter responses and aircraft navigation lights use the approved revisions. Naval gun attachments follow eight artwork headings; aircraft wingtip positions are cached from their actual artwork. The carrier roster entry is the troop transport aircraft, not a naval aircraft carrier.

Activity uses existing presentation observations: firing cooldown changes, damage, dispatch, repair and cargo approach. Ambient activity uses a separate visual clock. Existing wakes, bombs and projectiles are retained. Effects stop while paused, honor reduced motion, skip hidden/offscreen actors and strategic zoom, and do not change simulation rules or RNG. No new bitmap assets are added.

## Focused checks

- Syntax and motion state checks passed: initial observation, action detection, cooldown, pause, rewind and 320 heading anchor samples.
- Three focused Chromium tests passed: animation roster and visibility guards, map-edge clipping and full-view tree coverage. Animation cases cover 20 building types, eight ship types across eight headings, four aircraft types across eight headings and four logistics/support variants.
- Three production-build Chromium tests passed: module/asset loading and close-up match rendering, loading input guards and startup retry.
- Exact ZIP: all 53 manifest payload sizes and hashes match; extracted package starts standard and end-game matches and renders close-up terrain without page errors or failed requests. Screenshots inspected. These startup screenshots do not constitute an exhaustive action-animation review.
- User replay 91WI5P matches 2806 ticks, 57 commands, 28 checkpoints; final digest 584b5cbd. Private recording contents are not committed.
- Informational local effects-only draw profile: 200 visible buildings, 1920 x 1080, scale 6, 180 samples; median 0.4 ms, p95 1 ms, maximum 2 ms. This excludes full-game frame/GPU/network time and is not performance qualification.

The full suite, full performance qualification and Docker/WordPress installation suite were not run, following Ken's debug/testing instruction. This is a focused testing patch, not a new production GO. Docker was not started. No push or live deployment occurred. The exact checked ZIP was copied unchanged to working releases.

Observed tooling notices: Vite's existing large-chunk advisory; Node's module-type inference notice during replay; Playwright color-environment notices. Focused browser checks reported no application errors.

## Installation

Keep plugin 1.10.9 and the current backup. Upload statefall-release-1.10.54.zip through Statefall → Game package. Clear relevant caches, then inspect close-up building activity, turning ships and aircraft navigation lights in live play. Check pause, fog and reduced-motion behavior. The review scene remains available locally for comparison. Live confirmation is pending; rollback remains available through the previous immutable game release.
