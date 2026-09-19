# Phase E Progress

_Development record for game/package 1.10.17, build `2026-09-18-phase-e5-pixi-naval-logistics`, on 18 September 2026. E4 is `c4dee5d`; E3 is `6b5438e`; E2 is `78564c2`/`3b4b7bd`; E1 is `4361ad7`/`e5c4228`. This is not a release, handoff, production change, Phase E completion, or final-art approval._

## E5 Implemented Slice

- Migrated only legacy `legacy-game.js` former lines 1132-1147. Complete structures remain first; each transport follows array order as route, wake, hull, optional heavy HP, and zoom-gated troop label; merchants follow as wake then hull/cargo; boarding lines are last. Canvas warships and every later layer remain above the Pixi canvas.
- The pure renderer-neutral model receives detached camera, viewport, visibility, owner color, path, wake, and entity presentation. It preserves stepped `shipPosition` coordinates, path sampling at `0, 8, 16... < pos` plus the current center, legacy fog visibility, heavy `1.35` hull/HP scaling, zoom `>=1.2`, center/alphabetic labels, and boarding visibility without submarine detection. The pre-naval reset supplies miter/butt; transport `drawShip` rounds its hull only inside save/restore; merchant therefore inherits miter. Any earlier visible transport or merchant with at least two wake points changes the global cap to round before boarding, even when all wake geometry is viewport-culled. The neutral model derives that state before culling and the later Canvas handoff consumes the same predicate.
- Complete route, wake, hull, HP, label, cargo, and boarding bounds use the shared one-CSS-pixel antialias margin. Conservative culling retains routes, wakes, and boarding lines crossing the viewport even when their entity center is offscreen.
- Hard reject-not-truncate limits cover 4,096 entities/containers, 131,072 path points, 131,072 wake points, 131,072 primitives, 262,144 emitted Graphics segments, 16,384 Graphics resources, and 4,096 raster labels. Idle pools are bounded at 512 containers, 2,048 Graphics, and 512 labels.
- Non-ID collections use renderer-side WeakMap object identities and a deterministic same-frame occurrence/order key. Reorder, removal, and compaction do not bind an old resource to a different source object.
- Hulls remain development vector primitives; there are no generated hull textures or Pixi `Text` objects. Diagnostics report exact raster-label source bytes, zero generated hull texture references, pool live/idle/create/reuse/destroy counts, total/visible/culled category counts, path/wake/primitive/segment counts, and unknown GPU bytes.
- Ownership is atomic. Resources are reserved before painting. Partially painted Graphics/labels are explicitly discarded and removed from live accounting; containers and normal releases return to idle only after complete reset. The same transactional rule now covers the existing structure path. If structures are unowned, or naval model/cap/container/Graphics/label/source/context work fails, naval logistics clears its Pixi scene and the complete Canvas naval prefix renders in the same frame. A naval-only failure does not revoke valid Pixi structures because Canvas naval rendering follows structures in legacy order. Every valid later frame retries.

## Compatibility

- Default and production rendering remain Canvas-only. Input/hit testing stays on the unchanged Canvas/controller path and the Pixi canvas remains non-interactive.
- Rendering writes no simulation state and consumes no RNG or clock authority. Plugin 1.10.7 and `SIMULATION_BASELINE_VERSION='1.10.8'` are unchanged.
- E4 behavior and limits remain intact. E5 grants no final-art approval and adds no atlas policy.

## Evidence

- Pure contracts cover exact order/geometry/style, route sampling, fog input, zoom, normal/heavy HP, crossing bounds, caps and cap-minus-one boundaries, invalid sources, immutability, and repeat determinism without RNG/clock/state access.
- Focused Chromium semantic/pixel tests cover normal and heavy transports, route, wake, HP, troop count, merchant cargo, boarding, and an overlapping retained Canvas warship. Invalid paint plus container/Graphics/label constructor and fail-after-mutation paths produce same-frame full Canvas fallback, leave no dirty idle or phantom live slot, and recover with exact children and no ghost geometry. Reset, BFCache recreation, context-loss teardown, and WeakMap identity churn are E5-specific assertions.
- Dedicated DPR 1, 1.5, and 2 tests retain CSS-pixel alignment and targeted pixels for hulls, routes/wakes, labels, cargo, and boarding, including a Canvas-derived miter-only merchant bow region and paired butt/round boarding-dash endpoint comparisons.
- A labeled synthetic 1,800-frame naval churn changes create/remove/reorder, heavy/HP/troop/color/heading, wake, and visibility. Resources plateau at 23 containers, 77 Graphics, and 23 labels; generated hull texture references stay zero. Local synchronous CPU/render-submission p95 is 4.0 ms and p99 is 12.1 ms, under 16.7/33 ms; these are not GPU, compositor, display-presentation, or input-latency measurements. Heap samples are advisory and GPU bytes are unknown because the browser/Pixi stack exposes no reliable allocation total.
- Real simulation naval behavior remains covered by `tests/naval.js`; the focused renderer fixture is synthetic because it must force simultaneous normal/heavy/merchant/boarding overlap states without simulation writes.
- The full browser matrix passes 96 tests with 166 intentional project-selection skips. The corrected focused naval file passes 11 primary-project tests with one DPR-project selection skip, and the expanded separate DPR matrix passes 21/21. Canvas normalized goldens, D2 browser relay, source/built contracts, context loss, BFCache, reduced motion, every map/mode smoke, and production Pixi exclusion remain green. Production reproducibility matches all 24 outputs with release-manifest SHA-256 `671463e58fb5e99e12ab1f61ecee51b953afa47979dd9ea6932ccdd4897d1648`. The Canvas production performance reference measured desktop/mobile frame p95 at 0.6/0.5 ms, transfer 252,157 B, and advisory heap 5,401,612/5,436,360 B.

## Remaining Phase E Work

- Migrate warships, projectiles, aircraft, and later labels/effects in bounded ordered slices.
- Define atlas/loading policy and complete sustained physical-GPU, hardware, and long-session qualification.
- Complete every-map/mode playability and final Phase E gate before Phase F terrain/world art. Phase G entity art remains separate.
