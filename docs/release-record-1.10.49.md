# Statefall release readiness — 1.10.49 / plugin 1.10.8

28 September 2026. **Qualification in progress; not yet GO.** No push, deployment, or release tag is authorized.

Game build: 2026-09-28-release-performance. Minimum plugin: 1.10.8. The original simulation behavior baseline remains 1.10.8.

## Changes from the 1.10.48 candidate

- Preserve capture-front iteration/RNG behavior while eliminating repeated coordinates and direction branches.
- Skip unnecessary Canvas state writes for offscreen particles, with pixel-equivalence regression coverage at viewport edges.
- Isolate development Pixi support actors in their own render group to reduce GPU buffer upload stalls.
- Apply Ken-approved required network loading gates: maximum of three cold samples must be within 15 seconds at 25 Mbps / 100 ms, and 40 seconds at 10 Mbps / 150 ms. Other performance/correctness limits remain unchanged.

## Focused evidence so far

- Land-combat contracts PASS.
- Global-effects contracts and pixel-equivalence checks PASS.
- Middle East impossible/SOAK11B: full 6,000-tick campaign plus replay PASS in 308.53 seconds, below the unchanged 360-second watchdog.
- Pixi support-layer suite: 17/17 PASS, including resource/fallback behavior.
- Three isolated 1,800-frame stress repeats: 3/3 PASS; p99 11.0, 11.1 and 12.6 ms, versus the unchanged 33 ms limit. Tight-loop maximum stalls remain 868–941 ms; these tests measure synchronous submission, not live display smoothness.

Full current-source matrix, browser suites, required network performance, reproducibility and exact WordPress artifact qualification remain to be completed and recorded. The unit-art register still requires its named human review; no row approval has been invented.

The [1.10.48 release record](release-record-1.10.48.md) is historical and retains that candidate's exact ZIPs and failures. New final artifacts must be built and verified for 1.10.49.
