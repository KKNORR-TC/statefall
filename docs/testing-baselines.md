# Testing Baselines

_Originally recorded 14 September 2026; reconciled through the first Phase E foundation on 18 September 2026._

The approved game 1.10.8 simulation results are pinned in `tests/fixtures/simulation-baselines-v1.10.8.json`. Development game 1.10.13 build metadata explicitly names 1.10.8 as its behavior baseline. Renderer selection, DPR, resize, and render cadence are presentation-only and must preserve canonical bytes, legacy hash, RNG, command log, replay behavior, and tick. No approved hash was rewritten for the Phase E1 foundation. The fixture covers every reduced-grid smoke scenario, standard/fog/garrison same-page restart replay, the default production-grid cold determinism run, and the fixed-seed Chromium/Firefox/WebKit canonical digest.

The 15 September Phase 0 review expanded the canonical oracle to include visibility, radar visibility, and known-border fog state. Canonical SHA-256 baselines were manually updated for that authoritative-state-only change after confirming legacy simulation hashes remained unchanged; no pixel baseline was changed.

Same-page restart baselines remain standard `77683843` / `3cf3f0ded683`, fog `69bcdf18` / `b9811f9c8cbc`, and garrison `81232aef` / `b1ea57c49266`. Replay saves now retain periodic and final canonical digest, RNG draw count, command count, and replay cursor evidence. Watch and resume must reach and verify the exact target tick; serialized post-end continuation and resume no longer diverge.

Full engine checkpoints use `statefall-engine-checkpoint/v2` and include separate `statefall-canonical-compatibility/v1` label metadata. Checkpoint v1 is deliberately rejected because authoritative state alone cannot reconstruct exact canonical `labelPos` bytes between the legacy 30-tick refresh points.

`tests/fixtures/replays/public-v1.10.7-focus.json` remains the historical public replay fixture recorded by game 1.10.7. Game 1.10.8 changes seeded tier ordering so RNG is no longer consumed inside an implementation-dependent `sort` comparator. The historical fixture checks replay compatibility, while the 1.10.8 fixture pins current simulation behavior after that RNG correction.

The game visual references are `tests/browser/canvas.spec.js-snapshots/current-map-chromium-desktop-win32.png`, `dense-late-game-chromium-desktop-win32.png`, and the `maps-*-chromium-desktop-win32.png` strategic/close matrix beside them. They remain authoritative for the default Canvas renderer. The Phase E1 review regenerated only the dense late-game reference after `freezePresentation()` began cancelling its pending RAF, removing the prior extra-frame race; two focused repeats and the full matrix matched it. `pixi-hybrid` uses semantic screenshot pixel assertions for opaque sea/land/ownership content and visible invalidation changes rather than a final-art golden.

Production Pixi exclusion is a runtime and JavaScript-module-graph contract: production has no selectable/reachable Pixi renderer and emits no Pixi JavaScript chunk. Inert `.pixi-*` rules may remain in the shared stylesheet, so tests and documentation must not broaden that claim to zero Pixi text in every built asset.

Node.js 22.12 or newer within the 22.x line is the supported test and CI runtime; `package.json`, the lockfile, and locked Vite now agree on that range. Node 24 on Windows is excluded because it has been observed to be unstable during local simulation runs; changes should not broaden the declared engine range until that environment is reliable.

Focused commands:

```powershell
npm run test:smoke
npm run test:restart
npm run determinism
npm run test:replaycheck
npm run test:browser -- --project=chromium-desktop --grep "fixed-seed simulation"
npm run test:desktop-scale
npm run test:prototype
npm run test:visual:windows
npm run perf:browser
```

The required Phase A desktop display-scale suite uses Chromium emulation at DPR 1, 1.5, and 2 over 1280 x 720 and 1600 x 900 viewports. It checks the legacy CSS-pixel Canvas backing contract, rendered content, containment, coordinate targeting, resize camera stability, and browser/request errors. Emulated DPR does not qualify physical displays, operating-system scaling, text readability, compositor output, or input latency. Mobile projects remain advisory and are not part of `npm run verify`.

The optional Phase A browser performance harness and its measurement limitations are documented in `docs/browser-performance-baseline.md`. Its generated JSON is ignored and is not part of `npm run verify` because local browser timings are machine-relative. The current harness qualifies the Canvas production path and has no renderer-selection option, so it does not produce a Pixi performance result.

Normal non-Docker change verification is `npm run verify`; build reproducibility is `npm run test:build-reproducibility`. Release qualification additionally requires the mounted sandbox, security regression, and exact-artifact commands in `docs/build-a-release.md`, plus applicable performance/device and production checks. The pinned scope does not claim every seed, long-match outcome, browser rendering pixel identity, mobile visual identity, or production deployment approval. Smoke and restart tests deliberately use a 240x138 grid; the default determinism test retains the 720x414 production grid. Optional determinism environment overrides still test run-to-run equality but intentionally do not compare against the default baseline.

The Phase E1 review browser evidence is 64 main passes and 54 intentional project-selection skips (118 total), 6 desktop-scale passes, and 1 graphics prototype pass. It includes Pixi source smoke/canonical/input coverage in Chromium, Firefox, and WebKit, plus Chromium-only pixel, lifecycle, initialization-failure, and real context-loss evidence. Canvas performance medians are desktop 78.1 ms load, 554.4 ms start, 1,678.0 ms/300 ticks, 0.6 ms frame p95, 246,321 B transfer, and 5,376,792 B heap; Pixel 7 emulation 74.7 ms, 569.9 ms, 1,593.8 ms/300 ticks, 0.6 ms p95, 246,321 B, and 5,417,796 B heap.
