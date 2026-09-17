# Statefall Current Status

_Updated 15 September 2026 after Phase C implementation._

## Repository and production

- Source authority: `main` in this repository. Current repository versions are game 1.10.9 and plugin 1.10.7. Production remains game 1.10.7/plugin 1.10.6; a repository version does not prove deployment without a release record.
- Production: [WorldRTS.com](https://www.worldrts.com/) is a live public WordPress site. Ken confirmed successful installation and production verification of game 1.10.7/plugin 1.10.6 on 14 September 2026. The earlier authorized snapshot is retained as the pre-release baseline in `docs/production-baseline-2026-09-12.md`.
- Deployment owner: Ken uploads approved packages through the WordPress admin panel.
- Handoff directory: `D:\One Drive\projects - local\statefall\working releases`. This directory contains installable artifacts; it is not source authority.
- Production access is not part of normal local development. Do not access, upload to, or change production without Ken's explicit authorization.

## Local verification baseline

The repository now owns its Node test setup and lockfile. On Node 22.x:

```powershell
npm ci
npm run syntax
npm test
```

As of this update, Phase 0 modernization verification passes: comprehensive syntax checks, hardened harness assumptions, state invariants, pinned canonical SHA-256 simulation baselines, strict replay positive/negative checks, reduced-grid map and mode simulations, standard/fog/garrison same-page replay checks, production-size cold determinism, and Playwright Canvas checks in Chromium, Firefox, WebKit, mobile profiles, and reduced motion. The determinism result is `DETERMINISTIC ✓`. See `docs/testing-baselines.md`.

Phase A is complete. Evidence in `docs/phase-a-evidence.md` includes strategic/close references for every production map, major modes and input paths, dense late-game and historical replay scenes, desktop DPR 1/1.5/2 checks, performance ceilings, and an illustrated command-map vertical slice approved by Ken as the high-level direction. The full game is desktop-first; mobile/Playables remains optional and may become a separate Statefall Light track. Individual unit graphics remain unapproved until Phase G review.

Phase B is implemented in repository plugin 1.10.7. Schema-1 manifest packages are validated for exact file inventory, normalized safe paths, allowed extensions, count/depth/compressed/extracted/per-file limits, minimum plugin version, SHA-256/size integrity, and exact agreement between manifest metadata and the entry's game markers. A filesystem lock serializes staging, finalization, activation, deletion, and pruning. Activation and complete rollback append an atomic record under `uploads/statefall/release-pointers/`; no existing pointer is replaced, making publication safe on Windows and POSIX. Pruning retains the active release plus five inactive releases. Shared `audio/` and `cards/` data remain outside releases. The deployed root `index.html` remains readable and is imported into an immutable release before the first manifest update; new bare-HTML installs and mutable legacy-backup restores are retired.

Phase C is implemented in repository game 1.10.9. `game/index.html` is a Vite entry for a multi-file ES-module application. Styles, maps, flag data/drawing, audio preference state, storage helpers, build/signing metadata, and Local/WordPress adapters are separate modules; the simulation and Canvas renderer remain together in `game/src/legacy-game.js` so Phase D has not started. The adapter owns account requests, saves, score submission, identity/capabilities, navigation, and lifecycle notification; legacy media loading and response-sensitive credit/leaderboard paths still fetch directly and are deferred with the broader legacy split. `npm run build:release` reproducibly emits hashed assets, canonical static help, standalone flags from explicit module exports, bundle metadata, schema-1 `dist/release.json`, and the exact installer ZIP without evaluating or scraping the application. Production bundles exclude the browser test bridge. Source and built Playwright projects reject failed requests and missing chunks, and the built project exercises normal UI startup without test internals. Build metadata explicitly retains the approved 1.10.8 behavior oracle and existing screenshots.

`npm run verify:artifacts` builds deterministic plugin and game ZIPs plus the actual repository `1.10.6` plugin baseline and uses a disposable WordPress/PHP 8.4 table prefix. It covers a fresh database, exact `1.10.6` install and `1.10.7` upgrade with data preservation; exact production game and synthetic multi-file ZIP install; activate/rollback/reinstall/delete/prune; cross-platform pointer publication and request context snapshots; lock contention; legacy import/constraints; manifest/game-marker mismatches; bad hashes; traversal, duplicate/case-colliding and forbidden entries; package limits; stale versus current staging; admin/runtime path compatibility; release-qualified assets; and private HTML, JSON, JS, and CSS MIME/cache behavior. Immutable caching requires the requested filename fingerprint to match the manifest SHA-256. The existing mounted sandbox and security suites remain required.

Docker Desktop 4.90.0 and WSL2 are installed with Docker autostart disabled. The isolated sandbox runs WordPress 7.1, PHP 8.4, and MariaDB 11.4 from the explicitly authorized production snapshot, with local credentials, external HTTP/email blocking, and localhost-only publication. `sandbox/verify.ps1` passes all plugin PHP syntax, public routes, authenticated cookie/nonce REST access, and save create/read/delete persistence. `sandbox/security-regression.ps1` passes malicious replay rejection, legacy replay sanitization, safe display-name compatibility, immutable save kinds, all Autosave reservation paths, concurrent hard quotas, InnoDB migration, and bot-record isolation. Start, stop, preserved-data restart, full Docker shutdown, and on-demand Docker restart have been verified.

Game 1.10.6 was rendered and inspected at 1440×900, 1280×720, and 390×844. No hotfix UI regression was found. The narrow viewport retains substantial pre-existing horizontal clipping and is not considered responsive-complete.

## Review findings

The disposition column records whether each finding is deployed, accepted, or still unresolved.

| Severity | Finding | Release disposition |
|---|---|---|
| Critical | Public replay data can inject stored HTML/JavaScript through unvalidated custom bot names rendered with `innerHTML`. | Fixed and deployed in game 1.10.7/plugin 1.10.6 with write validation, legacy public-data sanitization, safe client normalization, and text-only notice rendering. |
| Critical | The score HMAC key is delivered in public game HTML, so clients can forge leaderboard records. | Accepted and deployed product policy: game 1.10.7/plugin 1.10.6 explicitly label rankings and achievements as community-submitted and not independently verified. API score records expose `verified=false`; authoritative ranking is not claimed. |
| High | Unsigned `botNations` data can update arbitrary users' bot records. | Fixed and deployed in plugin 1.10.6 by ignoring non-authoritative client bot records. |
| High | Keep playing/Spectate is not serialized, so saves made after the first end state cannot reconstruct later progress. | Blocks claims that post-victory saves are resumable. |
| High | Save/replay quotas can be bypassed by changing record kind or creating protected Autosave rows. | Fixed and deployed in plugin 1.10.6 with per-user locking, transactional hard limits, immutable kinds, and one reserved Autosave. |
| High | Seeded randomness was consumed inside a `sort` comparator, risking replay divergence between JavaScript engines. | Fixed in repository game 1.10.8 by precomputing one seeded key per candidate with deterministic tie-breakers; Chromium, Firefox, and WebKit canonical-state regression coverage was added. Not deployed. |
| Medium | Expired-login HTTP 403 score submissions are discarded although the UI promises a retry. | Non-security defect; fix before claiming reliable score retry. |

## Current production release

The combined game 1.10.7/plugin 1.10.6 release was installed and verified in production on 14 September 2026. Node syntax, full simulations, production-size determinism, PHP syntax, WordPress integration, security regressions, rendered screenshots, archive structure, embedded versions, checksums, and production verification passed. Non-blocking replay and retry reliability findings remain open.

Release artifacts in `D:\One Drive\projects - local\statefall\working releases`:

- `statefall-release-1.10.7.zip`, SHA-256 `c7f0c0ad22b51dd8732f63acb53834de4f6d0844502124f2b6470c59b9908c86`.
- `statefall-scores-1.10.6.zip`, SHA-256 `12c08eb0960b9f423e2c9ba826d13aa6c8082e690f6484334fea28558c69f042`.

The earlier 1.10.6/1.10.5 package pair was superseded before deployment and must not be uploaded.
