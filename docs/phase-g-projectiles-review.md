# Phase G Projectile Flight Identity Candidate 01

Current status (28 September 2026): this document retains its specific review evidence and pending human decision. The later classic production candidate is documented in [the release record](release-record-1.10.48.md); this earlier candidate is not the current release identity.

Status: **Pending human review**

Reviewer: **Unassigned**

General Unit Direction 02 authorizes this production translation but does not approve any row. All nine projectile rows in `docs/unit-art-review.md` remain pending and require row-specific state evidence and a named human decision.

## Scope

- Covers strategic and cruise missiles, naval barrage rockets, heavy artillery shells, shared surface gun shells, torpedoes, defensive interceptors, air-to-air missiles, and aircraft bombs.
- Uses the real shipped projectile, missile, support-actor, and global-effects drawing paths on detached terrain-free canvases.
- Shows production vector geometry at 2x inspection scale so small in-game bodies and trails remain reviewable.
- Labels the defensive interceptor as prototype-directed and the other rows as family extrapolations.
- Keeps all presentation work outside canonical simulation state.

This candidate is representative in-flight identity evidence only. Launch, impact, interception, origin-specific gunfire, dense combat, zoom, quality, reduced-motion, and Canvas/Pixi comparison matrices remain required before any row can be approved.

## Evidence

- Start here: `.artifacts/phase-g-projectiles-review/review-start-here.png`
- Manifest: `.artifacts/phase-g-projectiles-review/manifest.json`
- Isolated source images: `.artifacts/phase-g-projectiles-review/assets/`

No goldens were updated, and no review status changed.

## Verification

- Syntax validation passed.
- Rendering contracts passed across the complete retained model suite.
- Isolated nine-row browser evidence passed in Chromium desktop.
- Renderer-independence and deterministic-simulation gates passed.
