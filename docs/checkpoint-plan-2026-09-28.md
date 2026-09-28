# Local checkpoint plan — 28 September 2026

Recommendation: yes, preserve the current development work in local Git checkpoints before more optimization. A commit preserves work; it does not certify a release. Ken subsequently approved the recommendations and authorized work toward GO, including reviewed local checkpoint commits. No tag, push, or deployment is authorized. The completed checkpoint identities are recorded below.

## Scope observed

Before this documentation update, Git reported 104 modified tracked files and 373 individual untracked files (directory-collapsed status showed 156 entries). The changes span simulation/replay fixes, classic art and presentation, generated visual references, release integration, qualification tools, and evidence. HEAD is 09ed1844d046582f696bb4aad5866f3d4d60bb2e. These are existing collaborative changes, not all authored in this turn.

## Suggested checkpoints

1. Simulation/replay correctness and performance work, with corresponding regression tests.
2. Classic terrain, full unit roster, tier artwork, presentation fixes, provenance and visual references, with dependent tests.
3. WordPress 1.10.8 integration, score retry, current-package verification and game 1.10.48 packaging.
4. Qualification harnesses, retained evidence, current release record and budget reassessment.

These are review boundaries, not a promise that the present diff can be split mechanically. Shared files such as legacy-game.js, package.json and the changelog need hunk-level review. Each split should remain coherent; if dependencies make that impractical, use one explicitly marked development checkpoint of the reviewed complete state rather than creating broken intermediate commits.

## Original staging guidance (historical)

Inspect untracked source and evidence individually; include required assets and their provenance. Exclude credentials, sandbox/.env, database/runtime dumps, temporary browser output, ZIPs and node_modules. Review evidence sizes and prefer compact reproducible reports over unnecessary bulk. Check the staged diff and whitespace. Record the known NO-GO findings in the commit body: legacy byte threshold pending reassessment, late Middle East slowdown/watchdog, intermittent development Pixi stress, and open art review. Do not create a release tag or push without authorization.

The earlier 1.10.48 ZIP checksums remain in [their historical record](release-record-1.10.48.md); final 1.10.49 identities are in [the current record](release-record-1.10.49.md). A source checkpoint must not silently rewrite the recorded source identity of a previously tested archive.

## Recorded checkpoints

- a352b92: reviewed combined classic-art, simulation, release and performance candidate. Dependencies were retained together to keep the checkpoint coherent.
- ca83cdd: startup follow-up: loading status, inactive-control protection, retry, independently fingerprinted preload helper, and ten browser regression checks. Full qualification follows this checkpoint.

- 40439ad: wait for asynchronous startup in existing gameplay and score-retry tests, retaining all assertions.

- 1517d9e: replace unavailable PowerShell checksum cmdlet plumbing with runtime SHA-256 in the artifact verifier; preserve both mismatch assertions. Known vector and both independent ZIP descriptors pass.

- 0df4109 and 4a7cab9: correct Docker stopped-state reporting, recover crashed Desktop processes safely and bound unresponsive health/shutdown calls. Final Docker and exact-artifact gates pass.
