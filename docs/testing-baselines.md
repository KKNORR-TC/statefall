# Testing Baselines

_Recorded 14 September 2026._

The approved game 1.10.8 simulation results are pinned in `tests/fixtures/simulation-baselines-v1.10.8.json`. It covers every reduced-grid smoke scenario, standard/fog/garrison same-page restart replay, the default production-grid cold determinism run, and the fixed-seed Chromium/Firefox/WebKit canonical digest. Mismatches print expected and actual values; intentional changes require review and a manual, versioned fixture edit.

The 15 September Phase 0 review expanded the canonical oracle to include visibility, radar visibility, and known-border fog state. Canonical SHA-256 baselines were manually updated for that authoritative-state-only change after confirming legacy simulation hashes remained unchanged; no pixel baseline was changed.

`tests/fixtures/replays/public-v1.10.7-focus.json` remains the historical public replay fixture recorded by game 1.10.7. Game 1.10.8 changes seeded tier ordering so RNG is no longer consumed inside an implementation-dependent `sort` comparator. The historical fixture checks replay compatibility, while the 1.10.8 fixture pins current simulation behavior after that RNG correction.

The game visual references are `tests/browser/canvas.spec.js-snapshots/current-map-chromium-desktop-win32.png` and the `maps-*-chromium-desktop-win32.png` strategic/close matrix beside it. The prototype references are under `prototypes/graphics-vertical-slice/graphics-vertical-slice.spec.js-snapshots/`. They are authoritative only for Windows Chromium and all pixel assertions are gated to `win32`. Linux CI retains launch, Canvas-content, prototype camera/layout, interaction, error-collection, and cross-engine canonical-state checks without looking for Windows snapshots.

Node.js 22.x is the supported test runtime and the CI runtime. Node 24 on Windows is excluded because it has been observed to be unstable during local simulation runs; changes should not broaden the declared engine range until that environment is reliable.

Focused commands:

```powershell
npm run test:smoke
npm run test:restart
npm run determinism
npm run test:replaycheck
npm run test:browser -- --project=chromium-desktop --grep "fixed-seed simulation"
npm run test:prototype
npm run test:visual:windows
npm run perf:browser
```

The optional Phase A browser performance harness and its measurement limitations are documented in `docs/browser-performance-baseline.md`. Its generated JSON is ignored and is not part of `npm run verify` because local browser timings are machine-relative.

Full verification is `npm run verify`. The pinned scope does not claim every seed, long-match outcome, browser rendering pixel identity, mobile visual identity, or production deployment approval. Smoke and restart tests deliberately use a 240×138 grid; the default determinism test retains the 720×414 production grid. Optional determinism environment overrides still test run-to-run equality but intentionally do not compare against the default baseline.
