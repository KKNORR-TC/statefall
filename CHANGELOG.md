# Changelog

## 1.10.9 - 2026-09-15

- Repository-only game version; recovered and normalized on 17 September 2026 with all Phase C correctness, artifact, and production-build performance gates passing. It has not been deployed.
- Added Vite development and reproducible production builds.
- Moved the unchanged Canvas game into ES modules with extracted styles, map/flag data, audio preferences, utilities, and Local/WordPress platform adapters.
- Added source-versus-built browser contracts, missing-chunk checks, bundle reporting, and schema-1 `dist/release.json` generation.
- Retained the approved 1.10.8 simulation and visual baselines through an explicit build metadata contract.
- Added manifest-backed signing-key health validation, functional Local/WordPress adapter boundaries, and production-only removal of browser test internals.

## Plugin 1.10.7 - 2026-09-15

- Repository-only plugin version; it has not been deployed.
- Added strict schema-1 game-package manifests, immutable release directories, serialized staging and activation, append-only release pointers, rollback, retention, and legacy-root import.
- Added exact-ZIP WordPress installation, upgrade, lifecycle, validation, MIME, cache, signing-key, and data-preservation coverage.

## 1.10.8 - 2026-09-15

- Repository-only game version; it has not been deployed.
- Added the Phase 0 deterministic state oracle, invariants, strict replay verification, cross-process determinism, and cross-browser canonical digest coverage.
- Removed seeded randomness from a JavaScript `sort` comparator and established the approved 1.10.8 simulation baselines.
- Added the Phase A Canvas visual matrix, display-scale coverage, performance harness, and isolated illustrated command-map prototype.

## Game 1.10.7 / Plugin 1.10.6 - 2026-09-14

- Production release installed and verified on WorldRTS.com.
- Hardened replay identity rendering, save ownership and quotas, Autosave handling, migrations, and bot-record isolation.
- Labeled scores, rankings, and achievements as community-submitted and not independently verified.
- See `docs/releases/1.10.7-1.10.6.md` for the authoritative deployment record.
