# Browser Performance Baseline

Run the Phase A browser baseline from the repository root:

```powershell
npm run perf:browser
```

The harness creates a fresh temporary production-optimized Vite build, serves it on loopback, and launches headless Chromium. The qualification build includes the guarded test bridge so deterministic setup and measurements remain available; normal release builds still omit that bridge. The harness requires a bundled JavaScript asset under `/assets/` and rejects any loaded resource absent from the exact temporary build inventory. It creates three fresh, cache-disabled contexts for each named scenario:

- `desktop-1440x900`
- `mobile-pixel-7-390x844`, using Playwright's Pixel 7 emulation

Each sample uses the guarded `?browserTest=1` bridge and fixed `PHASEAPERF` seed. It records navigation load time, synchronous match start-to-ready time, their sum, 300 controlled simulation ticks and canonical digest, 20 paused rendered frames, bundled navigation/resource transfer and body sizes, and Chromium heap values. All samples must produce one simulation digest and no page, console, request, or HTTP failures. The temporary build is removed after the run.

The machine-readable report is overwritten at `.artifacts/browser-performance/baseline.json`, which is intentionally ignored. Set `STATEFALL_PERF_SAMPLES` to change the repetition count or `STATEFALL_PERF_OUTPUT` to choose another repository-relative report path.

Conservative regression ceilings live in `tests/fixtures/browser-performance-ceilings.json`. Timing and post-GC heap checks use the median across cold contexts to reduce one-off noise. Resource checks use the maximum across cold production-optimized qualification builds. The 15 September Windows observation before Phase C was about 371-378 ms for load plus start, 1.29 seconds for 300 ticks, 0.8-0.9 ms rendered-frame p95, 690 kB transferred, and 4.0 MB post-GC CDP heap. Ceilings intentionally allow several times the observed timing and heap values and about 30% payload growth.

The first 17 September post-Phase-C invocation still used the Vite development server. It passed timing, simulation, frame-work, and heap ceilings but failed the payload checks at 4,296,330 transfer bytes and 4,291,830 decoded bytes. That result identified a methodology defect: release qualification was measuring raw source modules rather than deployable output. No ceiling was changed.

After commits `951db36`, `5583fc9`, and `0d1cae9` corrected and hardened the target, the fresh production-optimized qualification build passed every unchanged ceiling on Windows 11 build 26200, an Intel Core Ultra 9 290HX Plus, 127.4 GB RAM, an NVIDIA GeForce RTX 5090 Laptop GPU, Node 22.23.2, Playwright 1.63.0, and headless Chromium 153.0.8010.12. Desktop medians were 303.8 ms load plus start, 885.6 ms for 300 ticks, 0.5 ms rendered-frame p95, 193,089 transfer bytes, 589,024 decoded bytes, and 4,026,096 bytes post-GC heap. Mobile-emulation medians were 306.1 ms load plus start, 891.1 ms for 300 ticks, 0.4 ms rendered-frame p95, the same payload, and 4,034,560 bytes post-GC heap.

## Limitations

- Results are relative regression signals for the same class of machine, not production service-level objectives. CPU load, power mode, virtualization, browser version, operating system, and headless rendering can move timings.
- `coldLoadAndStartToReadyMs` is the sum of navigation duration and synchronous match initialization. It excludes Playwright interaction time between those phases and does not model network latency because assets come from loopback with caching disabled.
- Render timing measures JavaScript and Canvas command work performed by the bridge's synchronous `freezePresentation()` render. It does not measure compositor latency, GPU presentation, display refresh cadence, input latency, or sustained animation smoothness.
- Pixel 7 is browser emulation on the desktop CPU and GPU, not physical mobile hardware or throttling.
- Transfer sizes come from same-origin Performance Timeline entries for a production-optimized bundle with extra guarded test instrumentation. The qualification bundle is therefore a conservative upper bound on normal release JavaScript, but a production server's compression, headers, and network conditions can produce different values.
- CDP heap is collected after an explicit garbage collection. `performance.memory` is also reported when Chromium exposes it, but only CDP post-GC used heap has a ceiling. Neither value includes all browser, Canvas backing-store, or GPU memory.
- The harness is Chromium-only because cache control and comparable heap collection use CDP. Cross-engine correctness remains covered by `tests/browser/canvas.spec.js`.
