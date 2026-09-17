# Phase A Evidence Index and Art-Direction Board

_Approved Phase A record, 15 September 2026._

## Visual Principles

- Preserve Statefall's strategic readability: ownership, coastlines, active fronts, selected forces, routes, and alerts outrank decoration.
- Use an illustrated command-map language with restrained terrain texture, water depth, atmosphere, and combat effects.
- Keep overlays compact and operational, with gold for orders, cyan for friendly information, and red-orange for danger.
- Keep geometry undistorted. Desktop and portrait use one uniform world scale with a responsive crop; portrait centers the coast, landing route, fort, and nearby force activity.
- Treat desktop as the full game's authoritative composition. Portrait/mobile remains an advisory exploration for a possible future Statefall Light experience.
- Preserve simulation, command, save, replay, and deterministic behavior independently from visual presentation.

## Evidence Map

| Evidence | Purpose |
| --- | --- |
| `prototypes/graphics-vertical-slice/index.html` | Isolated command-map composition and semantic structure |
| `prototypes/graphics-vertical-slice/scene.js` | Original procedural terrain, coast, units, effects, and uniform responsive camera |
| `prototypes/graphics-vertical-slice/styles.css` | Desktop/portrait command UI, hierarchy, colors, and reduced-motion rule |
| `prototypes/graphics-vertical-slice/graphics-vertical-slice.spec.js` | Canvas-content, overflow, camera, error, and Windows pixel checks |
| `prototypes/graphics-vertical-slice/graphics-vertical-slice.spec.js-snapshots/command-map-chromium-desktop-win32.png` | Windows Chromium desktop candidate reference, 1440 x 900 |
| `prototypes/graphics-vertical-slice/graphics-vertical-slice.spec.js-snapshots/command-map-chromium-mobile-win32.png` | Windows Chromium portrait candidate reference, 390 x 844 |
| `tests/browser/canvas.spec.js-snapshots/current-map-chromium-desktop-win32.png` | Existing game map reference |
| `tests/browser/canvas.spec.js-snapshots/maps-*-strategic-chromium-desktop-win32.png` | Twelve-map strategic-distance matrix |
| `tests/browser/canvas.spec.js-snapshots/maps-*-close-chromium-desktop-win32.png` | Twelve-map close-distance matrix |
| `tests/browser/canvas.spec.js-snapshots/dense-late-game-chromium-desktop-win32.png` | Guarded deterministic late-game scene: fronts, structures, fleet, aircraft, missiles, fog, routes, selection, and alerts |
| `docs/browser-performance-baseline.md` | Harness, ceilings, environment caveats, and interpretation |
| `.github/workflows/verify.yml` | Ubuntu semantic/cross-engine gate and separate Windows Chromium pixel gate |

The two prototype candidates were regenerated and locally reviewed after the camera fix. Their SHA-256 values are `e087c3ca66e8d37eb6a986468b389b1bb49fdd2c770da0f3feec961397305838` (desktop) and `f34f240852e7791e1ac32e01cc36944e7a43f36110e0eeeda168d13186765804` (portrait). Ken approved the overall direction after reviewing the prototype on the host display.

## Approval Record

On 15 September 2026, Ken approved the overall illustrated command-map direction in this conversation. This approval completes the human direction gate for Phase A. It is not approval of either candidate image as final production art or of any individual structure, ship, aircraft, transport, projectile, state variation, animation, or effect.

Every unit graphic remains reserved for explicit unit-by-unit Phase G review in `docs/unit-art-review.md`. No Phase G register row is approved by this Phase A direction decision.

## Approval Criteria

- No non-uniform scaling, clipped primary action, horizontal overflow, missing Canvas content, browser error, failed request, or unintended screenshot diff.
- Portrait crop retains the active landing, route, fort, command state, and selected-force controls at readable sizes.
- Desktop retains broad theater context and a clear hierarchy between map, combat alert, and unit card.
- Every production map is useful at strategic and close camera distances in authoritative Windows Chromium captures.
- Mode and input evidence covers representative defining state, paused-order behavior, real pointer targeting, context-menu placement/action, and cloned command diagnostics.
- Ubuntu semantic and Chromium/Firefox/WebKit determinism checks pass without requiring Windows pixels.
- A human art-direction reviewer explicitly accepts or rejects the candidate references. Passing automation alone is insufficient.

## Measured Environment

Local automated evidence was collected on Windows `10.0.26100`, x64, headless Chromium `153.0.8010.12`, Playwright `1.63.0`, and Node `24.12.0`. The performance run used three fresh cache-disabled samples for desktop 1440 x 900 and Playwright Pixel 7 emulation at 390 x 844.

Observed medians were 83 ms cold load, 289-295 ms synchronous start, 1.29 s for 300 ticks, 0.8-0.9 ms rendered-frame p95, about 690 kB transferred, and about 4.0 MB post-GC CDP heap. All configured ceilings and deterministic digest checks passed. The generated detail report remains local at `.artifacts/browser-performance/baseline.json`.

Node 22.12 or newer within the 22.x line remains the supported repository and CI runtime. This Node 24 local observation does not broaden support. Pixel references are Windows Chromium authoritative; Linux is semantic and cross-engine authoritative, not pixel authoritative. Pixel 7 is browser emulation on desktop hardware and is not physical-device evidence.

## Residual Follow-Up

- Reference-specific review continues as implementation replaces prototype elements; it does not approve unit art.
- Automated DPR 1/1.5/2 coverage and host-display review passed. Additional physical display and lower-end hardware evidence remains a later release-quality check.
- Physical Android and iOS qualification is not a gate for the full desktop game; it is deferred unless a separate mobile or Statefall Light project is approved.
- The historical public replay fixture now loads and begins playback through the real browser replay UI; long-session and broader replay-corpus review remains open.
- Unit-level coverage for future extracted renderer/camera modules remains open; the current prototype is intentionally isolated and browser-tested.
- GPU/compositor latency, display presentation, input latency, production-network behavior, and lower-end hardware performance are not measured by this harness.
- The historical Phase A record did not capture exact CPU, GPU, RAM, display, or power-mode identity. Recovery hardware is recorded separately in `docs/phase-c-recovery-evidence.md` and does not retroactively qualify the Phase A run as a named-hardware performance certification.
- Phase A is complete. No production, release, deployment, or unit-art approval is implied.
