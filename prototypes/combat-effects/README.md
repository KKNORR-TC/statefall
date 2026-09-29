# SAM sequence review — 28 September 2026

Ken locked the silo after the final upward hatch adjustment. `silo-approved-lock.json` records exact SHA-256 hashes of its painter and artwork; both remain unchanged during SAM work. The approved silo remains accessible through Review → Silo — locked.

SAM local preview: one missile loads from the rear, the rail assembly turns continuously along the shortest azimuth to the selected bearing, settles, ignites and launches exactly one missile. The foundation stays stationary. Rail, missile, fins and exhaust are projected from shared three-dimensional coordinates; no flat sprite is spun or flipped. One missile occupies the center rail and all rails are empty after launch. The eight target presets allow inspection around the full circle. Exhaust copies the silo's cached procedural texture method without modifying its approved painter.

This is a review-only model, not a production SAM integration. Targets and firing are staged. Mapping target acquisition and compressed animation timing to actual interceptors remains future integration work after visual acceptance. Existing gameplay and the installable ZIP are unchanged.

## Artwork

`sam-base-v1.png` was generated with the built-in image-generation tool using the earlier SAM screenshot as a style reference. Exact prompt is saved in `sam-art-prompt.txt`. The stationary foundation supplies detailed material; rotating geometry and missile are rendered in Canvas with face shading and a sampled surface texture.

## Focused checks

Silo lock hashes verified unchanged. Checked 32 target bearings for load-before-turn, shortest continuous rotation, alignment before ignition and empty state after one launch. Browser checked east, south, west and northwest; screenshots inspected. Review selection, reduced motion and page-error checks passed. No full suite, release package or deployment.

## SAM approval

Ken approved the reviewed SAM with “lock that.” Artwork and animation module are recorded in `sam-approved-lock.json`. Both SAM and silo hashes were verified at lock time. No visual changes or production deployment were made by this approval-recording step.

## Production integration checkpoint

The approved silo and SAM are integrated in testing package 1.10.55. Runtime SAM adaptation lives in game/src/rendering/classic-sam-sequence.mjs; locked prototype files remain unchanged. See docs/release-record-1.10.55.md for compressed gameplay timing and focused checks. Mushroom cloud remains review-only.
