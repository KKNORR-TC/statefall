# Local checkpoint plan — 28 September 2026

Recommendation: yes, preserve the current development work in local Git checkpoints before more optimization. A commit preserves work; it does not certify a release. Ken subsequently approved the recommendations and authorized work toward GO, including reviewed local checkpoint commits. No tag, push, or deployment is authorized. Commit identities will be recorded when created.

## Scope observed

Before this documentation update, Git reported 104 modified tracked files and 373 individual untracked files (directory-collapsed status showed 156 entries). The changes span simulation/replay fixes, classic art and presentation, generated visual references, release integration, qualification tools, and evidence. HEAD is 09ed1844d046582f696bb4aad5866f3d4d60bb2e. These are existing collaborative changes, not all authored in this turn.

## Suggested checkpoints

1. Simulation/replay correctness and performance work, with corresponding regression tests.
2. Classic terrain, full unit roster, tier artwork, presentation fixes, provenance and visual references, with dependent tests.
3. WordPress 1.10.8 integration, score retry, current-package verification and game 1.10.48 packaging.
4. Qualification harnesses, retained evidence, current release record and budget reassessment.

These are review boundaries, not a promise that the present diff can be split mechanically. Shared files such as legacy-game.js, package.json and the changelog need hunk-level review. Each split should remain coherent; if dependencies make that impractical, use one explicitly marked development checkpoint of the reviewed complete state rather than creating broken intermediate commits.

## Before staging

Inspect untracked source and evidence individually; include required assets and their provenance. Exclude credentials, sandbox/.env, database/runtime dumps, temporary browser output, ZIPs and node_modules. Review evidence sizes and prefer compact reproducible reports over unnecessary bulk. Check the staged diff and whitespace. Record the known NO-GO findings in the commit body: legacy byte threshold pending reassessment, late Middle East slowdown/watchdog, intermittent development Pixi stress, and open art review. Do not create a release tag or push without authorization.

The exact tested ZIP checksums remain those in [the release record](release-record-1.10.48.md). A source checkpoint must not silently rewrite the recorded source identity of a previously tested archive.
