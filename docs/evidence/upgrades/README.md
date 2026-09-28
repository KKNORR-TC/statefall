# Upgrade audit and tier artwork — 1.10.47

Completed 28 September 2026. This is a targeted follow-up to the earlier comprehensive qualification, not a rerun of its 1,152-case matrix.

## Actual upgrade paths

| Upgrade | Cost | Time | Result |
| --- | ---: | ---: | --- |
| Port I → II | 500 gold | 60 game seconds | Shore guns, heavy transports, nearby submarine-base construction and battleship refits |
| Airfield I → II | 600 gold | 90 game seconds | Six hangar slots, light shield, troop aircraft |
| Bastion I → II | 200 gold | 30 game seconds | 24-tile defensive range |
| Bastion II → III | 400 gold | 60 game seconds | 32-tile defensive range |
| Battleship missile refit | 400 gold | 30 game seconds; next simulation step in instant mode | Cruise missiles; requires a completed owned level II port within 34 tiles |

Building upgrade timers remain active in instant-build mode. Upgrades require ownership, sufficient gold, a completed structure, no pending upgrade, and a tier below the maximum. Heavy transports are automatic for qualifying embarkations; in garrison mode the upgraded port must serve the origin area. Troop aircraft and submarines are separate unlocked unit classes, not arbitrary level-II versions of every unit.

## Fixes

- An instant refit at simulation tick zero previously stored the zero/no-refit sentinel after charging gold. Accepted refits now have a positive deadline and complete on the next simulation step.
- Airfield map labels now display six hangar slots after upgrading, in both Canvas and hybrid presentation data.
- Bastion III text uses the matching III outline.
- Refit menus and notifications show the actual instant-mode timing.
- Clicking a friendly ship's center over water can select its orders even when the upgraded port's raised artwork overlaps it.

## Artwork

[Side-by-side art sheet](art-tiers.png): separate generated transparent sprites for armed port II, expanded airfield II, bastion II and bastion III. Blue identification panels retain team recoloring; completed tiers choose their matching image and picking bounds. Construction and incomplete upgrades retain their current tier. Refitted battleships gain camera-upright deck launcher cells that turn with the hull; heavy transports already have a separate directional atlas. Classic artwork remains opt-in development presentation.

## Verification

- Full fast regression suite and determinism check passed; historical record/replay oracle matched.
- Expanded structure tests cover both instant settings, ownership, funds, construction and duplicate-upgrade rejection, exact completion deadlines, gun/shield capacity, fort ranges and maximum tiers.
- Expanded air/naval tests cover troop-aircraft gating, hangar capacity, normal/heavy transports and refit completion.
- Router regression reproduced the tick-zero refit failure before the fix and now covers normal/instant deadlines, duplicate charging and command replay equivalence.
- Real-menu browser audit upgrades port II, airfield II, bastion II/III, buys a troop aircraft, refits a battleship and checks rendering purity.
- Submarine upgrade/build flow passes Chromium, Firefox and WebKit. Existing naval menus pass classic and standard art.
- Tier-art review verifies distinct variants, selectable upgraded structures and refit differences at five headings.
- Attacking-play performance gate passed: medium zoom 1,185 frames / 20.01 seconds, 200 ticks; large 2200×1200 DPR 1.5 view 665 frames / 12 seconds, 120 ticks.
- Two builds reproduce all 25 files exactly. Build logs accompany this report.

No push, deployment, production access or Docker release packaging.
