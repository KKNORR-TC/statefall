# Phase E Progress

_Development record for game/package 1.10.16, build `2026-09-18-phase-e4-pixi-structure-scene`, on 18 September 2026. Baseline `5e753d8`; E3 commit `6b5438e`; E2 commits `78564c2`/`3b4b7bd`; E1 commits `4361ad7`/`e5c4228`. This is not a release, handoff, production change, Phase E completion, or final-art approval._

## E4 Implemented Slice

- Extended the pure renderer-neutral pre-structure model into a complete structure scene. It consumes detached presentation, camera, viewport, fog, quality, reduced-motion, and supplied presentation time and imports no Pixi, DOM, timer, or simulation authority.
- Every tile-keyed bounded Pixi entry is one `Container` whose actual children follow the neutral model literally: optional pre graphics, base, pop graphics, level mark, upgrade graphics, airfield label, airfield arc, ship arc, ship label, suppression graphics, linked graphics, and cooldown graphics. A building takes the legacy early-continue path of optional pre graphics, base, building arc, and optional building label. Entries are appended in legacy structure-array order, so overlap no longer crosses two canvases.
- Post-base ownership includes building, upgrade, airfield queue, ship queue, and cooldown progress arcs; building/airfield/ship countdown and queue labels; pop and linked rings; level labels; suppressed X marks; and all remaining structure-only marks. Fronts and routes remain two fixed global `Graphics` objects before the entries.
- The active E3 `compositingConflictFallback` path and overlap rejection are removed. Diagnostics retain only an inactive zero-valued compatibility field. Canvas retains mobile entities, effects, later labels, alerts, selection, UI, and input.
- Hard limits are 65,536 conceptual primitives, 131,072 emitted Graphics segments, 4,096 live/512 idle structure entries, 36,864 live/2,048 idle graphics chunks, 512 generated base textures, and 8,192 live/1,024 idle canvas-raster label sprite/textures. Labels use measured Canvas `actualBoundingBox*` metrics, center alignment, and alphabetic-baseline offsets. Level III intentionally rasterizes `strokeText('II')` before `fillText('III')`. E4 instantiates no Pixi `Text`; diagnostics separately report active/idle label resources, exact label-canvas source bytes, unknown GPU bytes, and the known-unused Pixi text cache as zero references, textures, and bytes.
- Ownership remains atomic. Model, primitive, segment, Graphics, entry, sprite, texture, text-cap, text-resource, source, or context failure clears Pixi ownership before returning false; the same render call executes the complete legacy Canvas pre-structure and structure sequence. A later valid frame retries normally.

## Compatibility

- The default Canvas path and its normalized screenshot goldens are unchanged. Production uses the Canvas factory, ignores renderer selection, and contains no reachable Pixi scene graph or Pixi JavaScript chunk.
- Camera coordinates remain shared CSS pixels and Canvas/Pixi use the same capped-DPR viewport. Structure entries retain the E3 stroke/radius/source-texture bounds for culling, including generated-texture fringe at high zoom.
- Fog hides the same structure entries and zoom thresholds remain `0.9` for structures and `1.2` for structure labels/airfield queue arcs. Quality changes route dash density only. Reduced motion freezes the existing front, shield, marker, and route/focus phases without hiding gameplay information.
- Input remains on the unchanged Canvas/DOM path. Rendering does not mutate canonical bytes, simulation hash, RNG, command log, replay cursor, or tick. Plugin 1.10.7 and `SIMULATION_BASELINE_VERSION='1.10.8'` are unchanged.

## Test Evidence

- Pure contracts cover every pre/post primitive and label, legacy ordering, progress clamping, zoom/fog culling, quality/reduced motion, exact segment accounting, and primitive/segment/text cap boundaries.
- Focused Chromium covers actual child order without conflict fallback, all post-base semantic classes, alphabetic-baseline labels, offscreen bases with visible ranges, countdown churn, cap-one constructor failure/recovery for every pool type, texture/primitive/segment/source failure, real dense state, all 12 maps and 9 major modes, context loss, BFCache recreation, reset, camera movement, and canonical/hash/RNG/tick purity.
- The full desktop/reduced/source-built browser matrix passed 91 tests with 143 intentional project-selection skips. This includes Chromium, Firefox, and WebKit Canvas behavior, normalized Canvas goldens, cross-browser canonical digest, D2 browser relay, lifecycle/context failure, reduced motion, and source/built contracts.
- DPR 1, 1.5, and 2 cover alignment, targeting, culling, rasterized source-texture fringe, baseline positions, level III's mismatched stroke/fill layers, and overlapping queue-label/arc pixels in both Canvas and Pixi.
- The 1,800-frame churn test changes structure count, build/completion, type, capture color, queue state, progress, and countdown strings while alternating visible/offscreen camera samples. This fixture plateaued at 11 entry records, 23 graphics chunks, 17 label texture/sprite resources, and 27 generated base textures; Pixi text-cache references/textures remained zero. Raw `performance.memory` samples are recorded as advisory only because browser GC timing does not justify a heap-growth assertion.
- `npm test` passed direct/system contracts, D2 relay core, old-versus-extracted parity, replay checks, all restart modes, renderer independence, and determinism. Approved hashes remain `bc43ad4e` / `509ad7e54aa2`, with 85/85 commands and `DETERMINISTIC ✓`.
- Production build reproducibility matched all 24 outputs. The manifest has 23 files, the application bundle is 721.12 kB minified / 235.86 kB gzip, and release-manifest SHA-256 is `88914d42f05acc5e279791218a16e3b9e588311917d5b39bcae2181466eb7f97`. Browser performance measured desktop frame p95 at 0.7 ms and mobile emulation at 0.5 ms with 250,679 B transfer; no established ceiling regressed.

## Remaining Phase E Work

- Port later dynamic entity/effect layers only after this ownership and recovery boundary remains stable. Ships, transports, aircraft, missiles, projectiles, combat effects, later labels, alerts, and selection remain Canvas-owned.
- Define the broader atlas/loading policy before replacing generated legacy structure textures. Later particles, lighting, trails, and resolution controls remain open.
- Expand sustained physical-browser/GPU and long-session recovery coverage. Complete the full Phase E playability gate before Phase F terrain/world art.
- Keep Phase F terrain/world art and Phase G entity art separate. E4 reuses existing primitives/icons and grants no final-art approval.
