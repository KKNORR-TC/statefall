# Statefall 1.10.52 — map-edge testing patch

28 September 2026. Prepared at Ken's request for debug/testing with focused checks only. This is not a new full production GO qualification. Base source: 94cba5f; the local patch commit contains this record.

The classic close-up terrain cache filled the viewport beyond the map. Terrain compositing now clips to the real map rectangle, including ownership shading and cache overscan. Both the synchronous fallback and terrain worker use this boundary. Simulation behavior is unchanged.

Game: 1.10.52; build: 2026-09-28-map-edge-fix; required plugin: 1.10.9 (unchanged).
Package: statefall-release-1.10.52.zip
SHA-256: 37297a49236d58887527c4c6ace0cc7f71da0ccf4e7a438d308f2446d49c4455

Passed: syntax checks; focused browser coverage of all four map edges, zoom scales 5 and 8, DPR 1 and 2, camera/cache panning, fallback and actual worker output; exact ZIP manifest verification of 53 payload files; extracted production ZIP classic startup and match start. The test checks transparent pixels beyond all four boundaries and opaque water within the map. Existing coverage remains intact.

Per Ken's explicit instruction, full regression, performance and Docker/WordPress installation suites were not run for this debug patch. Docker was not started. Prior qualification is historical and does not constitute full qualification of this patch. The package was copied unchanged after these focused checks. Nothing was pushed or deployed.

## Install for testing

Keep plugin 1.10.9. Retain the current backup and install statefall-release-1.10.52.zip through Statefall → Game package. Clear relevant caches, then zoom and pan around the map edges. Prior credits and custom-flag fixes remain included. Live confirmation is pending.
