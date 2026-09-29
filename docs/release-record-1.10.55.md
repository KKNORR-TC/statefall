# Statefall 1.10.55 — silo and SAM testing patch

28 September 2026. Ken locked both prototype visuals and requested integration into the game ZIP. Source base: 2faea2e; the local checkpoint containing this record captures the patch. Game 1.10.55 / build 2026-09-28-silo-sam / required plugin 1.10.9 (unchanged). Simulation baseline remains 1.10.8.

Package: statefall-release-1.10.55.zip
SHA-256: 4bc66341b0acf423e4a9fa3fa8c4218a027c8c49e454c4f483b2a9a513f9654a

## Included

Approved layered silo artwork: closed hatch, opening doors, missile elevation, ignition, liftoff and closing. Approved SAM foundation and projected launcher: loading, target-bearing rotation, one missile and textured ignition/exhaust. The locked review source/assets retain their recorded hashes. Runtime SAM adaptations preserve the bearing through reload and use a time-based aiming response.

Gameplay timing is compressed from the review sequence. Silo launch uses approximately 0.64 seconds before reset; native ballistic flight is visually delayed by five ticks and catches up at the original arrival time. SAM acquisition/loading occurs ahead of firing; native interceptors provide the flight projectile while the launcher shows its discharge and reload. Gameplay cooldowns, hit timing, damage, RNG and simulation modules are unchanged. Reduced motion shows static launchers. Pause and fog guards remain active.

The mushroom-cloud effect remains an unapproved local prototype and is not imported by the production game.

## Focused validation

- Syntax passed.
- Three Chromium tests passed: motion roster/visibility/state purity; ordered silo phases; runtime SAM 32 bearings across six phases, reload aim, pause, fog and state purity.
- Headless renderer/event-delivery independence passed. No new replay run is claimed.
- Exact ZIP: all 56 manifest payload sizes and SHA-256 values verified; extracted standard and end-game matches start and render close-up views without page errors or failed requests. Standard screenshot inspected. These are startup/render smoke checks, not an exhaustive live combat review.
- Both approved artwork lock manifests verified unchanged.

Full suite, performance qualification and Docker/WordPress installation checks deferred under Ken's debug-patch instruction. This is a testing patch, not a new production GO. Docker was not started. No push, upload or live deployment performed. Tooling notices: existing Vite large-chunk advisory, Node module-type inference notice, Playwright color-environment notices.

## Installation and review

Keep plugin 1.10.9. Upload the game ZIP through Statefall → Game package, not WordPress's plugin installer. Keep the current backup and previous immutable release available for rollback. After installation, clear relevant caches and inspect silo/SAM firing at close zoom, multiple target bearings, pause, fog and reduced motion. Full live combat visual acceptance remains pending.
