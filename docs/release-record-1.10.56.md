# Statefall 1.10.56 — continuous silo flight

Testing patch, 28 September 2026. Game 1.10.56 / build 2026-09-28-silo-flight; plugin 1.10.9 unchanged; simulation baseline 1.10.8 unchanged.

Fix: the earlier launch overlay ran on a separate clock, then the native projectile restarted at the silo center. The hatch and projectile now share the actual missile age, with frame interpolation. One approved raster missile leaves the hatch at the same position and size and follows a tangent-continuous curve into the original ballistic path by tick 5 (before SAM reaction at tick 6). Original arrival time, target, damage, interception rules and simulation data remain unchanged. Runtime adaptations are separate from the locked prototype.

Package: statefall-release-1.10.56.zip
SHA-256: 60314e7f6d5843920da8a8a2ae87659c885af524b2adb6f4b1499d79a9dcc807

Focused checks passed: 24 trajectory cases across six directions/four zooms (launch position, join position/velocity, final target and state purity), missile model contracts, four browser tests covering motion roster, SAM guards, silo sequence and single-projectile handoff. Syntax passed. Exact extracted ZIP: 56 payload sizes/hashes verified, startup/match/close-up smoke passed without browser errors or failed requests. Handoff screenshot inspected. No new full replay or performance qualification is claimed.

Full qualification and Docker/WordPress tests deferred under Ken's debug-patch instruction. Not a new production GO. Docker was not started; no live access, deployment or push. Existing Vite large-chunk and Playwright color-environment advisories remain.

Built in isolated checkout .artifacts/silo-flight-patch from 3659747 plus this fix, to exclude unrelated in-progress loading-screen work. Primary checkout contains the source fix; package-only version bump is in the isolated checkout. Exact tested archive copied unchanged to working releases.

Install through Statefall → Game package. Keep plugin 1.10.9 and previous package for rollback. Check silo launches toward several directions, pause and reduced motion. Mushroom cloud remains unapproved and excluded.
