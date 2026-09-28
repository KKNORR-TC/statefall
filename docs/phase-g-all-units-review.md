# Phase G Complete Unit Static Identity Candidate 01

Current status (28 September 2026): this document retains its specific review evidence and pending human decision. The later classic production candidate is documented in [the release record](release-record-1.10.48.md); this earlier candidate is not the current release identity.

Status: **Pending human review**

Reviewer: **Unassigned**

General Unit Direction 02 authorizes this production translation but does not approve any row. Every row in `docs/unit-art-review.md` remains pending and requires row-specific state evidence and a named human decision.

## Scope

- Applies the charcoal/navy/ivory material palette, brass functional accents, restrained outlines, and limited faction-color IFF panels across all shipped static structure and mobile-unit identities.
- Covers 20 structures, 8 combat ships, 3 logistics hulls, 4 aircraft including the spy plane, the repair truck, and the defensive interceptor.
- Uses direct prototype language for radar/SAM, bastion, destroyer, submarine, fighter, bomber, repair support, and interceptor categories.
- Labels every category without a direct illustrated exemplar as a family extrapolation.
- Keeps all presentation changes outside simulation state and preserves existing Canvas/Pixi model ownership.

This candidate is static-identity evidence only. Action, motion, selected/targeted, damage, disabled, destruction, transition, faction-color, zoom, quality, reduced-motion, and dense-gameplay matrices remain required before any row can be approved.

## Evidence

- Start here: `.artifacts/phase-g-all-units-review/review-start-here.png`
- Manifest: `.artifacts/phase-g-all-units-review/manifest.json`
- Isolated source images: `.artifacts/phase-g-all-units-review/assets/`

No goldens were updated, and no review status changed.

## Verification

- Syntax validation passed.
- Rendering contracts passed across structures, naval logistics, warships, projectiles, missiles, aircraft, support actors, effects, overlays, and bounded renderer resources.
- Isolated all-unit browser evidence passed in Chromium desktop.
- Renderer-independence and deterministic-simulation gates passed after the final candidate regeneration.
