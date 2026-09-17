# Changelog

## 1.10.9 - 2026-09-15

- Added Vite development and reproducible production builds.
- Moved the unchanged Canvas game into ES modules with extracted styles, map/flag data, audio preferences, utilities, and Local/WordPress platform adapters.
- Added source-versus-built browser contracts, missing-chunk checks, bundle reporting, and schema-1 `dist/release.json` generation.
- Retained the approved 1.10.8 simulation and visual baselines through an explicit build metadata contract.
- Added manifest-backed signing-key health validation, functional Local/WordPress adapter boundaries, and production-only removal of browser test internals.
