# Launch and nuclear-impact review — 28 September 2026

Requested after Ken reported that 1.10.54 testing worked. This is the next local visual candidate, not a replacement for the checked 1.10.54 release ZIP.

## Implemented

- Silo: larger vertical rocket, motor flame, hot launch-mouth glow, expanding exhaust and ground smoke.
- SAM: a separate angled interceptor, motor flame and diagonal smoke trail aligned to the pictured launch rail.
- Nuclear impact: shockwave/fireball, textured rising column, broad mushroom cap, cooling smoke and nine-second dissipation. Two small procedural smoke textures are generated once and reused; no network art or simulation RNG is involved.
- Shared painters power gameplay and the review at http://127.0.0.1:4182/prototypes/combat-effects/ . Timeline, pause, replay, close/medium view and reduced-motion controls are available.

Silo/SAM triggers now observe only firing cooldown increases, avoiding damage/upgrade-triggered launches. Nuclear effects consume the existing nuclear impact flash descriptor (orange, NUKE_RADIUS); smaller conventional impacts and intercepted missiles retain their existing effects. Classic Canvas is the integration target; the development hybrid renderer keeps its existing flash.

The effect clock freezes when paused and resets on match reset/rewind. Clouds respect visibility and viewport bounds, expire after nine visual seconds, and retain at most 16 concurrent impacts. Reduced motion shows a static cloud silhouette with fade, without the moving fireball/shockwave. These are presentation overlays on the existing single-piece building sprites; separate hatch/rail mechanical articulation is not implemented. Launch visuals hand off to the existing gameplay projectiles, whose rules and trajectories are unchanged.

## Focused evidence

- Syntax passed.
- Two Chromium rendering tests passed: launch/cloud stages, Canvas state restoration, distinct launch types, bounded lifecycle, fog/offscreen guards, pause, expiry, rewind and reduced-motion visibility; existing animation roster regression.
- Three production-build browser checks passed: built module/assets and close-up match load, startup input guards and retry.
- Review scene screenshots inspected at ignition and developed-cloud stages. Replaced the initial spherical-puff appearance with cached turbulent smoke textures and gradual heat-to-ash blending.
- Informational effects-only Canvas draw submission at 1920 x 1080, 120 samples: p95 0.2 ms for one cloud, 1.3 ms for eight, 2.7 ms for sixteen. First-use texture generation reached 12 ms. These are not full-frame or GPU latency measurements.

No simulation modules changed. Full qualification and long-running combat/replay scenarios were not run for this visual candidate. No production access, push or deployment occurred. The existing installable 1.10.54 ZIP remains unchanged; visual acceptance and subsequent patch packaging remain separate steps.

## Silo revision — closed-hatch sequence

Ken requested reviewing one effect at a time and replacing the exposed-missile base. The focused combat preview now shows only the silo and starts paused with the hatch closed. The replacement is layered Canvas artwork with a concrete plinth, recessed shaft, two sliding armored leaves, elevator guides, a separate missile and front-rim occlusion.

Timeline: closed 0–0.8 s; hatch opening 0.8–2 s; missile elevation 2–3.5 s; firing-position hold 3.5–4.3 s; ignition 4.3–4.65 s; lift-off through 6.4 s; exhaust clearing; hatch closure 7–8.5 s. The missile is concealed below the opening before elevation. This supersedes the earlier silo overlay and the earlier statement that hatch articulation is not implemented. SAM and nuclear effects are unchanged in this revision and hidden in this focused preview.

Two focused Chromium checks passed: ordered silo phases/closed-state restoration/Canvas state, and the existing roster renderer. Closed and ready-to-fire frames were visually inspected, along with opening and lift-off captures. No full suite or release ZIP was produced. Preview pacing is a visual review choice; gameplay projectile handoff timing still needs reconciliation before a release of this longer sequence. The installed 1.10.54 remains unchanged.

## Textured silo revision

Ken preferred the earlier launcher and missile materials and rejected the flat flame. Replaced the vector silo with generated layered sprites matching that reference: weathered round ring, detailed steel hatch and silver missile. Replaced the polygon flame with cached textured exhaust and separate turbulent smoke. See [asset provenance and final prompt](silo-layered-art-v2.md). Two focused Chromium tests passed. Release and gameplay handoff timing remain pending.
