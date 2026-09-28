# Qualification findings — 1.10.46

Final simulation matrix status: [qualification-summary.json](qualification-summary.json). Run `node tools/qualification/summarize.js` to refresh it; it exits nonzero until every expected current-source case passes. Earlier failures remain in the JSONL history.

All final qualification gates passed on 27 September 2026. See [final-audit.json](final-audit.json) for the tested source digest and gate record.

## Verified coverage

- All 1,152 combinations passed on the final simulation fingerprint: 12 maps × six difficulties × 16 named mode profiles. All 1,152 final canonical digests and command counts also match the pre-optimization reference.
- All 84 extended campaigns passed, with 47 reaching 6,000 ticks and 37 ending earlier. The two heaviest Africa and Middle East cases ran in isolation under the unchanged 360-second watchdog; their record-plus-replay times were 200.78 and 324.36 seconds.
- Combined matrix and campaign coverage: 686,812 recorded ticks (19.08 simulated hours), plus exact replay, and 24,858 commands. Observed peaks: 1,400 structures, 46 ships, 74 aircraft, 30 attacks, and one repair truck. Full-roster campaigns add separate coverage.
- Final full-roster replay passed 2,100 ticks in each of Chromium, Firefox and WebKit, with no load errors, divergence, or rendering-induced state mutation. Canvas/build checks passed 51 tests with 27 intentional project-specific skips.
- The full fast regression/determinism gate passed. Two production builds reproduced all 25 files exactly; the release manifest digest is `a48d6e3e289ec1fc1c08cce3951760d859e6c1396a01f41785c6b50758029019`. This is local build verification, not release authorization.
- Simulation fingerprint: `590604a32c1ec5d9548e79a86965ed8834f8fa8ff9f984f70eba8ee03d1db17a`.

## Gameplay and replay fixes

- **Valid late-game checkpoints rejected after area merges:** attacks and transports retain return-origin IDs whose areas can cease to exist. Previously allocated positive IDs are now accepted; zero, negative, fractional, nonnumeric and future IDs are rejected atomically. Exact continuation and invalid-input regression tests pass.

- **Repair trucks never returned:** two completion branches referenced the return-home function without calling it. The regression dispatches, repairs, returns, and removes the truck.
- **Risky draft could freeze at the human turn:** with no eligible free territory, the draft waited for an impossible choice. Availability is now checked before waiting; valid human choices still pause correctly.
- **Bombardment left surviving buildings on neutral ground:** damage could downgrade a building while neutralizing its tile. Ground changes ownership only after destruction.
- **Cross-browser replay divergence:** native trigonometry differed by one floating-point bit between Node and browsers. Portable historical V8/fdlibm math preserves historical Node reference replay bytes. Over 530,000 numeric vectors, the unchanged historical corpus, and full-roster replay in Chromium, Firefox and WebKit verify the fix.

## Performance

- Classic detailed terrain now renders in a background worker using copied presentation inputs, one active job and one replaceable queued job. Captured camera offsets and overscan keep existing imagery aligned during updates. Reset epochs discard stale results; errors and five-second timeouts restore the synchronous renderer. Diagnostic sample histories are bounded. WebKit without OffscreenCanvas retains the original renderer. Worker terrain matches Firefox pixels exactly; Chromium has reviewed sampling differences averaging 1.57–1.69 channel levels out of 255 at DPR 1/1.5. Offscreen smoke/spark culling is pixel-identical.
- The complete Africa replay now reaches 6,000 ticks without divergence, then advances 120 ticks and draws 650 frames in 12 seconds (54 FPS; p95 33.3 ms, maximum 166.7 ms). Its earlier live renderer managed 136 frames. These measurements describe this computer and dense fixture, not a universal frame-rate guarantee.

- The dense Africa browser replay exposed two additional presentation bottlenecks after the headless matrix passed: explicit closure of each tiny attack-front polygon consumed 175.7 seconds of a captured profile, and repeated garrison label scans consumed 64.1 seconds. A subsequent 12-second live profile found the same closure cost in territory shading (7.2 seconds). Fill and clipping paths now use Canvas implicit closure; the sidebar groups area labels in one pass. Three-browser pixel comparisons of attack fronts, coastlines and territory shading are identical. A synthetic 147,908-tile fragmented front takes 78–381 ms across Chromium, Firefox and WebKit; exact-reference sidebar tests cover both label behavior and linear scaling. The original 240-second browser timeout is retained.
- Two additional dense garrison seeds (Africa and Middle East) exposed linear area lookup and repeated national troop summation inside each tile capture. Area lookups now use a validated derived index. Area rebuilds discover ownership seeds in one ordered map pass, and capture loops reuse a single local lookup, preserve shuffle order without temporary swap arrays, and update hostility once per attack. Combat retains exact per-area loss order and flushes the original ordered sum before global fallback reads and at each attack boundary. An eager-reference regression checks exact player, attack, ownership and RNG results, including missing area mappings and newly acquired tiles with an empty garrison.
- Fort-defense checks use a combat-local list of forts instead of scanning every unrelated structure for every captured tile; destroyed forts are immediately excluded. AI local defense placement now applies its distance filter before expensive building-spacing checks. Both preserve candidate order and random draws.
- Repeated capture events share immutable scalar player snapshots, with color/identity changes invalidating the snapshot. Primitive-only events avoid recursive object copying; invasion notifications retain only their displayed identity fields.

- Dense late-game garrison fronts repeatedly deep-copied whole player area networks into visual events. The event boundary now snapshots only the scalar fields actually consumed by the presentation layer, while preserving immutable event isolation and subsystem player identity. A regression uses a 3,000-area getter to prove no area traversal occurs. An 800-tick diagnostic fell from 90.72 seconds to 6.60 seconds; the formerly timed-out Atoll case completed 6,000 ticks plus exact replay in 177.37 seconds under the unchanged 360-second watchdog.

- Procedural-map startup repeatedly evaluated fixed island rotations and allocated temporary arrays in every trigonometric call. Rotations are now computed once, and scratch arrays are only allocated where required. The measured slow island startup fell from about 15 seconds to about 3 seconds; exact numerical vectors and before/after canonical matrix comparisons guard this optimization.
- Identical-output integer SHA-256 arithmetic and byte-validated typed-buffer JSON caching reduce checkpoint work.
- Fog boundary and garrison traversal avoid repeated accessors and temporary arrays without changing simulation results.
- Mixed fleets could continually rebuild 512 directional textures against a 256-entry cache. A 64 MiB byte budget and appropriately sized source textures keep the tested set resident. The 256-unit stress fixture fell from roughly 265–297 ms per warmed draw to 16.1–17.4 ms, using 32 MiB with no repeated source builds.
- Isolated medium-zoom attacking play measured 1,187 frames over 20.01 seconds (about 59 FPS), p95 16.8 ms, maximum 116.7 ms, and two frames over 50 ms. A 2200×1200 viewport at DPR 1.5 measured about 57 FPS (maximum 133.3 ms). Credits measured about 54 FPS (maximum 100 ms). Occasional checkpoint spikes remain; these are local observations, not hardware-independent guarantees.
- Unrolled/Wasm checksum experiments were not integrated: small warmed gains did not justify worse cold behavior and extra complexity.

## Harness corrections and retained coverage

- The replay driver detects lack of progress instead of waiting indefinitely after a mismatch.
- Campaigns handle draft-start timing and allied war decisions through the real command flow.
- Roster fixtures choose protected build sites so enemy capture is not mistaken for failed purchases.
- Two visual references had captured the blank terrain loading surface. The shared screenshot helper now waits for terrain completion; both correctly rendered references were visually reviewed and passed a subsequent two-test run without updates.
- Browser runs interrupted by hot reload were repeated against stable source. Timing checks affected by concurrent CPU-heavy work were rerun in isolation without widening ceilings.
- Naval pixel checks expected the former bright hull palette. They now target current material outlines and identification strips at a defined medium zoom. Merchant miter corners, rounded transport edges, routes, boarding endpoints, and all three DPR values remain checked. The dedicated naval DPR test is now included in desktop-scale projects.
- Final canvas/build checks: 51 passed, 27 intentional project-specific skips. Display-scale checks: 57 initially passed; six stale-art failures plus three newly enabled checks passed in the final nine-test run. Nine project-specific skips remain intentional.

## Scope

The unchanged historical replay corpus is the Node reference corpus. This does not automatically repair older recordings that already captured browser-dependent floating-point differences; those recordings have no per-engine math provenance. New recordings use the portable implementation across the tested engines.

Artwork covers 16 mobile classes with eight fixed-camera headings and all 20 structures. Classic raster art remains an opt-in development preview.

Simulation qualification covers 12 maps × six difficulties × 16 named profiles, plus 84 extended campaigns and full-roster campaigns. Reports record actual duration: ordinary endings can precede 6,000 ticks; second-seed late-game campaigns continue after ordinary endings.

This is finite regression evidence, not proof for every seed, option subset, action sequence, or device. It is not production release qualification. No production access, push, deployment, or Docker release packaging was performed.

## Additional verified presentation fixes

- Replay catch-up owns simulation advancement exclusively. A reproduced race allowed the ordinary game timer to finish the replay first and strand the loading dialog; the timer-interleaving regression now passes. Hidden battlefield painting is deferred while the catch-up dialog covers it.
- Classic effect lifetimes now advance at 60 presentation steps per second, independent of displayed frame rate. This prevents smoke from accumulating when rendering is slow. Batched steps retain the original per-step emission and motion ordering.
- Full-resolution contested fronts are composited in the terrain worker in attack order, then pulsed together on the display thread. This replaces several full-screen translucent blends per frame with one. Overlap colors are composed at the pulse maximum; their shared pulse avoids expensive repeated blending. The discarded lower-resolution experiment is not part of the implementation.
- Three-engine front viewport-culling comparisons produced zero changed pixels, including fractional cameras and fog. Chromium and Firefox worker-front comparisons also produced zero changed pixels at the pulse maximum, at DPR 1 and 1.5; WebKit retains the synchronous fallback where OffscreenCanvas is unavailable.
- The targeted late Middle East checkpoint reached 364 frames and 119 simulation ticks in 12 seconds after compositing, versus 118 frames in the rejected resampling experiment. The full 6,000-tick replay/live path subsequently passed with 382 frames, 119 ticks, p95 66.8 ms and maximum 233.4 ms in 12 seconds. The complete current-revision simulation matrix and extended campaign audit also passed.

- Final edge-culling checks cover 1,296 unit/building cases per browser, including transformed canvases and DPR 1/1.5. All three engines produced identical pixels while reducing sprite draws from 1,296 to 970.

## Submarine-base UI follow-up

After the comprehensive audit, a reported construction problem exposed misleading UI prerequisites. Construction requires owned coastal space and a completed owned level II port within 34 tiles. The land menu and placement preview now reflect that requirement; the water context menu now offers the same coastal construction option. Port upgrades correctly display their actual 60-second timer, including in instant-build mode, and unfinished upgrades explain that paused play must resume.

A real-menu regression failed before the fix and now passes in Chromium, Firefox and WebKit: locked base, port upgrade, locked base while upgrading, 600 simulation ticks, and successful coastal construction. Existing naval menus pass in both art modes, and the game build passes. Simulation files and their fingerprint are unchanged. The earlier final-audit source/build digest describes the preceding full qualification, not this later UI-only change.
