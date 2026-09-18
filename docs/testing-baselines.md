# Testing Baselines

_Originally recorded 14 September 2026; reconciled through final Phase D evidence on 18 September 2026._

The approved game 1.10.8 simulation results are pinned in `tests/fixtures/simulation-baselines-v1.10.8.json`. Development game 1.10.12 build metadata explicitly names 1.10.8 as its single-player behavior baseline because absent `settings.humanSeats` retains the existing setup path and Phase D2 relay code does not simulate. No approved hash or screenshot was rewritten. The fixture covers every reduced-grid smoke scenario, standard/fog/garrison same-page restart replay, the default production-grid cold determinism run, and the fixed-seed Chromium/Firefox/WebKit canonical digest. The Phase D parity corpus additionally freezes 7 old-engine scenarios from `ad30188`; the final production-grid run applied 85/85 commands and retained `bc43ad4e` / `509ad7e54aa2`. Mismatches print expected and actual values; intentional changes require review and a manual, versioned fixture edit.

The 15 September Phase 0 review expanded the canonical oracle to include visibility, radar visibility, and known-border fog state. Canonical SHA-256 baselines were manually updated for that authoritative-state-only change after confirming legacy simulation hashes remained unchanged; no pixel baseline was changed.

Same-page restart baselines remain standard `77683843` / `3cf3f0ded683`, fog `69bcdf18` / `b9811f9c8cbc`, and garrison `81232aef` / `b1ea57c49266`. Replay saves now retain periodic and final canonical digest, RNG draw count, command count, and replay cursor evidence. Watch and resume must reach and verify the exact target tick; serialized post-end continuation and resume no longer diverge.

Full engine checkpoints use `statefall-engine-checkpoint/v2` and include separate `statefall-canonical-compatibility/v1` label metadata. Checkpoint v1 is deliberately rejected because authoritative state alone cannot reconstruct exact canonical `labelPos` bytes between the legacy 30-tick refresh points.

`tests/fixtures/replays/public-v1.10.7-focus.json` remains the historical public replay fixture recorded by game 1.10.7. Game 1.10.8 changes seeded tier ordering so RNG is no longer consumed inside an implementation-dependent `sort` comparator. The historical fixture checks replay compatibility, while the 1.10.8 fixture pins current simulation behavior after that RNG correction.

The game visual references are `tests/browser/canvas.spec.js-snapshots/current-map-chromium-desktop-win32.png` and the `maps-*-chromium-desktop-win32.png` strategic/close matrix beside it. The prototype references are under `prototypes/graphics-vertical-slice/graphics-vertical-slice.spec.js-snapshots/`. They are authoritative only for Windows Chromium and all pixel assertions are gated to `win32`. Linux CI retains launch, Canvas-content, prototype camera/layout, interaction, error-collection, and cross-engine canonical-state checks without looking for Windows snapshots.

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

The optional Phase A browser performance harness and its measurement limitations are documented in `docs/browser-performance-baseline.md`. Its generated JSON is ignored and is not part of `npm run verify` because local browser timings are machine-relative.

Normal non-Docker change verification is `npm run verify`; build reproducibility is `npm run test:build-reproducibility`. Release qualification additionally requires the mounted sandbox, security regression, and exact-artifact commands in `docs/build-a-release.md`, plus applicable performance/device and production checks. The pinned scope does not claim every seed, long-match outcome, browser rendering pixel identity, mobile visual identity, or production deployment approval. Smoke and restart tests deliberately use a 240x138 grid; the default determinism test retains the 720x414 production grid. Optional determinism environment overrides still test run-to-run equality but intentionally do not compare against the default baseline.

Final candidate browser evidence is 55 main passes, 31 intentional project-selection skips (86 total), 3 desktop-scale passes, 1 graphics prototype pass, and 1 exact WordPress artifact pass. Final performance medians are desktop 102.2 ms load, 659.3 ms start, 1,869.2 ms/300 ticks, 0.8 ms frame p95, 242,431 B transfer, and 5,327,872 B heap; Pixel 7 emulation 108.0 ms, 658.7 ms, 1,942.4 ms/300 ticks, 1.3 ms p95, 242,431 B, and 5,370,404 B.
