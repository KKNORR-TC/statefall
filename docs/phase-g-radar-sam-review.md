# Phase G Air-Defense Structures - Prototype Translation Candidate 01

Current status (28 September 2026): this document retains its specific review evidence and pending human decision. The later classic production candidate is documented in [the release record](release-record-1.10.48.md); this earlier candidate is not the current release identity.

Status: **Pending human review**

Reviewer: **Unassigned**

No row in `docs/unit-art-review.md` is approved by this implementation or evidence package. General Unit Direction 02 approval remains direction-only.

The earlier legacy-glyph motion probe received changes requested because its circular bases did not match Unit Direction 02. Its screenshots are superseded and are not approval evidence for this candidate.

## Bounded Scope

- Replaces the legacy circular `radar`, `lradar`, and `sam` glyphs with a shared charcoal/navy/ivory air-defense family derived from Unit Direction 02.
- Gives `radar` the illustrated compact rectangular station, recessed equipment bay, side module, raised mast, dish support, and limited faction-color IFF panel.
- Treats `lradar` as an explicitly labeled production extrapolation with a broader array and distinct footprint; the prototype did not illustrate this unit separately.
- Gives `sam` a separate launcher/tracker silhouette with launcher rails rather than reusing the radar station unchanged.
- Attaches the presentation-only rotating dish line to each structure's own mast geometry.
- Derives phase only from the stable structure tile and renderer presentation time.
- Quantizes live motion to at most 30 presentation updates per second with a 6.8-second rotation period.
- Freezes the dish for reduced motion, low quality, and suppressed SAM sites.
- Omits the separate dish stroke below `1.2` zoom while retaining each new structure's distinct static silhouette.
- Places the dish above the static base and below suppression, linked, and cooldown overlays.
- Uses the same authored base source for Canvas and Pixi, plus one bounded vector primitive per visible eligible structure; it does not allocate animated textures.
- Leaves simulation state, commands, hitboxes, targeting, fog authority, replay, multiplayer, and the SAM-network model unchanged.

This slice seeks review only for the normal/reduced-motion air-defense base family and dish treatment. It does not complete capture/destruction states, interceptor launch art, the SAM-network overlay, or any other Phase G row.

## Review Evidence

- Start here: `.artifacts/phase-g-radar-sam-review/review-start-here.png` - isolated high-resolution renders from the exact production drawing function, reduced-motion comparison, and clean native map scale.
- Gameplay and zoom context: `.artifacts/phase-g-radar-sam-review/review-context.png` - secondary integration evidence only; unrelated legacy units and terrain are not candidate art.
- Manifest: `.artifacts/phase-g-radar-sam-review/manifest.json`
- Approved general-language reference: `.artifacts/phase-g-radar-sam-review/prototype-direction-reference.png`
- Normal Pixi frames: `.artifacts/phase-g-radar-sam-review/pixi-normal-close-frame-a.png` and `pixi-normal-close-frame-b.png`
- Reduced motion: `.artifacts/phase-g-radar-sam-review/pixi-reduced-close.png`
- Canvas fallback: `.artifacts/phase-g-radar-sam-review/canvas-normal-close.png` and `canvas-reduced-close.png`
- Quality: `.artifacts/phase-g-radar-sam-review/pixi-medium-quality.png` and `pixi-low-quality-static.png`
- Mid zoom: `.artifacts/phase-g-radar-sam-review/pixi-mid-zoom.png`
- Strategic zoom: `.artifacts/phase-g-radar-sam-review/pixi-strategic-static-silhouette.png`

The manifest is bound to a SHA-256 candidate-source manifest covering tracked and untracked repository source, records `Pending human review`, distinguishes the `lradar` extrapolation, names no reviewer, and records that no goldens were updated.

## Verification

- `npm run syntax`: passed.
- `npm run test:rendering-contract`: passed.
- Focused normal/reduced-motion Phase G browser scope: 7 passed, 3 intentional project skips.
- `npm run test:renderer-independence`: passed.
- `npm run determinism`: passed with identical final digest and all 85 commands applied in both runs.
- `npm run test:prototype`: passed.

The configured full browser/golden matrix has not been accepted for this candidate. The dense late-game golden remains unchanged pending a named visual decision; a visual difference is not an approval and must not be accepted automatically.

## Decision Needed

Review `review-start-here.png` and record separate named decisions for `radar`, `lradar`, `sam`, and the shared ambient-dish treatment:

- `Approved`: accept only the named row/treatment and authorize its affected golden/evidence updates.
- `Changes requested`: record exact visual changes and regenerate this package.
- `Pending`: make no source or golden acceptance change.

Even if this candidate is approved, the affected register rows remain incomplete until their other listed state evidence is separately reviewed.
