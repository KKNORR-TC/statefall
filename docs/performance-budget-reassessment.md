# Classic artwork loading-budget reassessment

**28 September approval update:** Ken approved the recommended replacement and requested fixes to achieve GO. The required cold-load-plus-start limits are now 15 seconds at 25 Mbps / 100 ms and 40 seconds at 10 Mbps / 150 ms, maximum of three samples each. Both profiles run by default. Byte counts remain reported; the historical 0.9 MB gates are superseded. All other performance/correctness limits are unchanged. A passing current rerun is required. Earlier pending-approval wording below records the proposal history.

Updated 28 September 2026. **Replacement policy approved and implemented; current candidate qualification is recorded in [release 1.10.49](release-record-1.10.49.md).**

The following provenance, measurements and proposal describe the earlier 1.10.48 reassessment. Historical failures and the initial automatic-review rejection are retained for traceability.

## Provenance

The 900,000-byte transfer and decoded-response limits were introduced in commit 026b12bf97c773dae6997b7066ceb1f065708826 on 15 September 2026, “test: capture modernization phase A baseline,” in tests/fixtures/browser-performance-ceilings.json. They remained unchanged during the initial reassessment and were subsequently superseded after Ken’s approval. Phase A reported approximately 690 kB transferred before the classic artwork existed. No explicit user requirement or calculation establishing 900,000 bytes was found. It is an inherited regression threshold, not a hosting, WordPress, browser, engine, or GPU capacity limit. Decoded response bytes are not decoded image/texture memory.

## Historical 1.10.48 measurement

Twelve cold samples: three each for localhost desktop, localhost mobile emulation, and two desktop network profiles. Chromium cache is disabled, each sample uses a new context, and the production-optimized qualification build waits for artwork initialization before measuring readiness. Start cost is added to navigation-to-ready time; time spent choosing settings is excluded. The controlled initial match uses PHASEAPERF. All samples produced the same simulation digest. No game/plugin source or installation archive was changed.

| Profile | Median load plus start | Worst of three | Resource transfer |
| --- | ---: | ---: | ---: |
| desktop-1440x900 | 0.48 s | 0.52 s | 31.58 MB |
| mobile-pixel-7-390x844 | 0.48 s | 0.49 s | 31.58 MB |
| desktop-broadband-25mbps | 11.38 s | 11.42 s | 31.58 MB |
| desktop-constrained-10mbps | 26.91 s | 26.93 s | 31.58 MB |

Network profiles use Chromium network emulation: 25 Mbps download / 100 ms latency and 10 Mbps / 150 ms, both with 1 Mbps upload. This is a modeled bandwidth constraint on this Windows desktop, not evidence from the live site, an actual internet connection or low-end hardware. No CPU throttling was applied. The bundled test bridge is qualification-only. The production ZIP startup/integration checks remain separately recorded.

At 31,582,416 bytes, transfer alone has an ideal lower bound of approximately 10.11 seconds at 25 Mbps and 25.27 seconds at 10 Mbps, before latency and initialization. The measured results are consistent with those lower bounds. Localhost's sub-second startup did not represent real download waiting time.

[Raw samples and unchanged required checks](evidence/release-1.10.48/performance-reassessment.json). The run intentionally reports failure under the still-active byte gates; no failure was suppressed.

## Original replacement proposal — subsequently approved

Replace only the two historical byte ceilings per profile with explicit cold-load experience targets for the illustrated desktop game:

- At 25 Mbps / 100 ms: load plus match start within **15 seconds in every one of three cold samples**. This is a proposed tolerable initial-load bound for an asset-rich game, not a previously agreed requirement or an industry standard. A future optimization goal remains under 10 seconds.
- At 10 Mbps / 150 ms: within **40 seconds in every one of three cold samples**, also required under this proposal. This characterizes a constrained connection; a visible loading state is needed for long waits. No new approval of the current loading interface is implied.
- Continue recording transfer and decoded-response sizes as regression diagnostics. Any increase needs explanation and a fresh network check. A full asset-library size and initial critical-path size should be reported separately when lazy loading is implemented.
- Retain existing localhost startup, simulation time, synchronous render and heap limits, live-frame tests, replay correctness, network-error checks and all other release checks. Do not treat a loading-time pass as evidence that late-game frame delivery is smooth.

Both sampled network profiles fall within these proposed bounds; see [explicit proposal comparison](evidence/release-1.10.48/proposed-loading-assessment.json). The bounds are engineering recommendations for Ken to approve or tighten, not derived platform limits. A 10-second broadband requirement would fail today and require optimizing/defer-loading artwork. The current 31.6 MB payload still merits optimization even if the 15-second proposal is accepted.

Automatic approval review rejected an attempted replacement of the byte gates as a weakening of mandatory qualification. That attempt made no file changes. The safe alternative added supplemental measurements only; tests/fixtures/browser-performance-ceilings.json remains unchanged. Ken subsequently approved this replacement. The required fixture and harness now enforce it; the historical failing report remains retained alongside current candidate results.

## Historical findings requiring follow-up

A revised loading policy does not make the release green by itself. Middle East late-game play still fails the frame-rate gate and its headless record/replay verification exceeds 360 seconds; the development Pixi support-actor p99 stress check is intermittent. The detailed art review remains open. See [the release record](release-record-1.10.48.md). No source commit, production change, release tag, or handoff copy was made during this reassessment.

## Reproduction

From the repository root, run npm run perf:browser. Both required network profiles now run by default alongside the original localhost profiles, with three samples each. Set STATEFALL_PERF_OUTPUT to a new evidence JSON path when retaining a separate run, then clear that environment variable afterward.
