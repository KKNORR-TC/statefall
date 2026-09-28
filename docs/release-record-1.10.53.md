# Statefall 1.10.53 — tree coverage testing patch

28 September 2026. Debug/testing patch using focused checks as requested by Ken; full production qualification deferred. Source base 4c074ed; the local patch commit contains this record.

The close-up renderer stopped after 180 trees while scanning from top to bottom, leaving lower screen areas bare on large views. Removed that cutoff. Scenery remains restricted to the visible cached terrain bounds and existing terrain, building and road exclusions. Cached frames do not redraw trees. Simulation behavior and saved recordings are unchanged. The map-edge fix remains included.

Game 1.10.53; build 2026-09-28-tree-coverage-fix; required plugin 1.10.9, unchanged.
Package: statefall-release-1.10.53.zip
SHA-256: 7583cdcfc0bb7bace308cd25129c8eb425e85fb509dd245347af4280496366fe

Passed: syntax; large 3840 by 1800 close-up tree coverage through the bottom of the view and cache reuse; map-edge regression including actual worker output, zoom, pan and display scales; exact ZIP integrity verification of 53 payload files; extracted ZIP classic startup and match start.

User-provided Africa replay 91WI5P, recorded in 1.10.51, matched 2806 ticks, 57 commands and all 28 checkpoints, final digest 584b5cbd. Replay contents were not modified or committed. This verifies replay integrity; the focused visual regression uses synthetic terrain to isolate the cutoff.

The full suite, full performance qualification and Docker/WordPress installation suite were not run per the debug/testing instruction. No new production GO is claimed. Docker was not started. No push or deployment occurred. The exact checked ZIP was copied unchanged to working releases.

## Installation

Keep plugin 1.10.9 and the current backup. Upload statefall-release-1.10.53.zip through Statefall → Game package, clear relevant caches, then check tree coverage while zooming and panning. Live confirmation is pending.
