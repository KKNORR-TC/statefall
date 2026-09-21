# Restart Checkpoint - 20 September 2026

This checkpoint was written immediately before the host was shut down and relocated. It is the restart authority for the next session; do not infer deployment or release state from build numbers alone.

## Repository State

- Repository: `D:\One Drive\projects - local\statefall\statefall-repo-2026-09-12`
- Branch: `recovery/phase-c-2026-09-17`
- Accepted terrain candidate: `27a2389 feat: add high-resolution terrain candidate`
- Terrain acceptance/goldens: `cf5e658 test: accept F2 terrain visual baselines`
- Development identity: game/package 1.10.32, build `2026-09-20-phase-f2-high-resolution-terrain`, plugin 1.10.7, simulation baseline 1.10.8
- Production remains game 1.10.7/plugin 1.10.6. Nothing was packaged, handed off, pushed, released, deployed, or copied to `working releases`.
- The worktree was clean and ports 4173/4174 had no listeners before this checkpoint was added.

## Decisions Recorded

- Ken approved the in-game F2 terrain on 2026-09-20 with `approved proceed`.
- Commit `cf5e658` records that approval and accepts only the terrain-affected Canvas goldens: current map, all 12 maps at strategic/close zoom, and dense late-game.
- Terrain Direction 02 and general Unit Direction 02 are approved as production directions.
- No Phase G unit, structure, projectile, effect, state, animation, or review-register row is approved. Every row in `docs/unit-art-review.md` remains `Pending | Unassigned`.

## Verification At Shutdown

- The post-golden configured browser scope completed with 426 passed, 2,153 intentional skips, zero failures, zero flaky/interrupted/timed-out cases.
- The Direction 02 prototype scope completed 4/4.
- The fresh browser matrix is `.artifacts/phase-f2-runs/browser-matrix.json`, source manifest `52a0b0a1251455d1e360fe907976ba38ac691a26df41ad24e9db32151e97c239`.
- The tracked approval record is `docs/phase-f1-review.md`.
- The approved local visual baselines are committed in `cf5e658`.

## Outstanding Evidence Refresh

The host shutdown interrupted the final ignored-evidence refresh. The fresh browser matrix has zero failures, but its aggregate currently says `technicalPassed: false` because `.artifacts/phase-f2-runs/technical.json` was generated before the acceptance commit/source changes. `.artifacts/phase-f2-review/manifest.json` is likewise the pre-acceptance pending-review manifest and must not be cited as final acceptance evidence.

After restart, with ports 4173 and 4174 free, run these in order:

```powershell
npm run qualify:phase-f2:technical
npm run qualify:phase-f2:matrix
npm run generate:phase-f2:review
npm run verify:phase-f2:review
git status --short
```

Expected result: technical qualification passes, configured browser matrix has zero failures, the review manifest records Ken/Approved/`approved proceed`, source binding matches the then-current commit, and the worktree remains clean because `.artifacts/` is ignored. Do not update goldens again unless a new named visual decision requires it.

## Safe Next Slice

Only after the F2 evidence refresh passes:

1. Reconcile `docs/unit-art-review.md` against the current shipped roster and add any missing cross-cutting effect rows without marking approvals.
2. Define one small Phase G review batch. Prefer a single radar/SAM ambient-motion slice to establish stable-ID phase offsets, reduced-motion behavior, zoom budgets, Canvas fallback, and Pixi ownership before ships or aircraft.
3. Keep the general Unit Direction 02 approval separate from per-row approval. Generate deterministic state/color/zoom evidence and stop for named review of each affected row.
4. Do not enable production Pixi, package, deploy, push, or access production without a separate explicit authorization.

## Shutdown Safety

- No Vite/Playwright listener was present on ports 4173 or 4174.
- Docker was not started.
- No production access occurred.
- The durable restart point is Git; ignored `.artifacts/` evidence is useful local evidence but is not a substitute for the committed source and approval records.
