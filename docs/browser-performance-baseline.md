# Browser Performance Baseline

Run the Phase A browser baseline from the repository root:

```powershell
npm run perf:browser
```

The harness launches its own loopback server and headless Chromium. It creates three fresh, cache-disabled contexts for each named scenario:

- `desktop-1440x900`
- `mobile-pixel-7-390x844`, using Playwright's Pixel 7 emulation

Each sample uses the guarded `?browserTest=1` bridge and fixed `PHASEAPERF` seed. It records navigation load time, synchronous match start-to-ready time, their sum, 300 controlled simulation ticks and canonical digest, 20 paused rendered frames, navigation/resource transfer and body sizes, and Chromium heap values. All samples must produce one simulation digest and no page, console, request, or HTTP failures.

The machine-readable report is overwritten at `.artifacts/browser-performance/baseline.json`, which is intentionally ignored. Set `STATEFALL_PERF_SAMPLES` to change the repetition count or `STATEFALL_PERF_OUTPUT` to choose another repository-relative report path.

Conservative regression ceilings live in `tests/fixtures/browser-performance-ceilings.json`. Timing and post-GC heap checks use the median across cold contexts to reduce one-off noise. Resource checks use the maximum across cold Vite module loads. The 15 September Windows observation before Phase C was about 371-378 ms for load plus start, 1.29 seconds for 300 ticks, 0.8-0.9 ms rendered-frame p95, 690 kB transferred, and 4.0 MB post-GC CDP heap. Ceilings intentionally allow several times the observed timing and heap values and about 30% payload growth.

## Limitations

- Results are relative regression signals for the same class of machine, not production service-level objectives. CPU load, power mode, virtualization, browser version, operating system, and headless rendering can move timings.
- `coldLoadAndStartToReadyMs` is the sum of navigation duration and synchronous match initialization. It excludes Playwright interaction time between those phases and does not model network latency because assets come from loopback with caching disabled.
- Render timing measures JavaScript and Canvas command work performed by the bridge's synchronous `freezePresentation()` render. It does not measure compositor latency, GPU presentation, display refresh cadence, input latency, or sustained animation smoothness.
- Pixel 7 is browser emulation on the desktop CPU and GPU, not physical mobile hardware or throttling.
- Transfer sizes come from same-origin Performance Timeline entries. Browser cache, cross-origin timing restrictions, compression, and a production server can produce different values.
- CDP heap is collected after an explicit garbage collection. `performance.memory` is also reported when Chromium exposes it, but only CDP post-GC used heap has a ceiling. Neither value includes all browser, Canvas backing-store, or GPU memory.
- The harness is Chromium-only because cache control and comparable heap collection use CDP. Cross-engine correctness remains covered by `tests/browser/canvas.spec.js`.
