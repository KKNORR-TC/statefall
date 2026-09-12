# Statefall Current Status

_Updated 12 September 2026._

## Repository and production

- Source authority: `main` in this repository. Current repository versions are game 1.10.7 and plugin 1.10.6; these versions contain the local security hotfix and adopted unverified-community-score policy and are not yet deployed.
- Production: [WorldRTS.com](https://www.worldrts.com/) is a live public WordPress site. The authorized production snapshot captured at 2026-09-12 14:22:30Z confirms game 1.10.5, plugin 1.10.4, and WordPress 7.1; the hosting panel reports PHP 8.4. See `docs/production-baseline-2026-09-12.md`.
- Deployment owner: Ken uploads approved packages through the WordPress admin panel.
- Handoff directory: `D:\One Drive\projects - local\statefall\working releases`. This directory contains installable artifacts; it is not source authority.
- Production access is not part of normal local development. Do not access, upload to, or change production without Ken's explicit authorization.

## Local verification baseline

The repository now owns its Node test setup and lockfile. On Node 22 or newer:

```powershell
npm ci
npm run syntax
npm test
```

As of this update, syntax checks, reduced-grid map and mode simulations, standard/fog/garrison same-page replay checks, and the production-size cold determinism test pass. The determinism result is `DETERMINISTIC ✓`. Release-asset generation and a reduced one-minute, three-seed Super hard benchmark also run locally.

Docker Desktop 4.90.0 and WSL2 are installed with Docker autostart disabled. The isolated sandbox runs WordPress 7.1, PHP 8.4, and MariaDB 11.4 from the explicitly authorized production snapshot, with local credentials, external HTTP/email blocking, and localhost-only publication. `sandbox/verify.ps1` passes all plugin PHP syntax, public routes, authenticated cookie/nonce REST access, and save create/read/delete persistence. `sandbox/security-regression.ps1` passes malicious replay rejection, legacy replay sanitization, safe display-name compatibility, immutable save kinds, all Autosave reservation paths, concurrent hard quotas, InnoDB migration, and bot-record isolation. Start, stop, preserved-data restart, full Docker shutdown, and on-demand Docker restart have been verified.

Game 1.10.6 was rendered and inspected at 1440×900, 1280×720, and 390×844. No hotfix UI regression was found. The narrow viewport retains substantial pre-existing horizontal clipping and is not considered responsive-complete.

## Open review findings

These findings are unresolved unless a later commit and verification entry explicitly closes them.

| Severity | Finding | Release disposition |
|---|---|---|
| Critical | Public replay data can inject stored HTML/JavaScript through unvalidated custom bot names rendered with `innerHTML`. | Fixed locally in game 1.10.6/plugin 1.10.5 with write validation, legacy public-data sanitization, safe client normalization, and text-only notice rendering; deployment remains required. |
| Critical | The score HMAC key is delivered in public game HTML, so clients can forge leaderboard records. | Accepted product policy: game 1.10.7/plugin 1.10.6 explicitly label rankings and achievements as community-submitted and not independently verified. API score records expose `verified=false`; authoritative ranking is not claimed. Deployment remains required. |
| High | Unsigned `botNations` data can update arbitrary users' bot records. | Fixed locally in plugin 1.10.5 by ignoring non-authoritative client bot records; deployment remains required. |
| High | Keep playing/Spectate is not serialized, so saves made after the first end state cannot reconstruct later progress. | Blocks claims that post-victory saves are resumable. |
| High | Save/replay quotas can be bypassed by changing record kind or creating protected Autosave rows. | Fixed locally in plugin 1.10.5 with per-user locking, transactional hard limits, immutable kinds, and one reserved Autosave; deployment remains required. |
| High | Seeded randomness is consumed inside a `sort` comparator, risking replay divergence between JavaScript engines. | Must be fixed and checked across supported browsers before claiming cross-browser determinism. |
| Medium | Expired-login HTTP 403 score submissions are discarded although the UI promises a retry. | Non-security defect; fix before claiming reliable score retry. |

## Current release cutline

The combined game 1.10.7/plugin 1.10.6 release is GO for Ken's manual production upload. Node syntax, full simulations, production-size determinism, PHP syntax, WordPress integration, security regressions, rendered screenshots, archive structure, embedded versions, and checksums passed. Production remains affected until Ken uploads and verifies both packages. Non-blocking replay and retry reliability findings remain open.

Release artifacts in `D:\One Drive\projects - local\statefall\working releases`:

- `statefall-release-1.10.7.zip`, SHA-256 `c7f0c0ad22b51dd8732f63acb53834de4f6d0844502124f2b6470c59b9908c86`.
- `statefall-scores-1.10.6.zip`, SHA-256 `75144317a4bf7299130dea3ea8ed589f5fb52c92008bf971e0e014047275be34`.

The earlier 1.10.6/1.10.5 package pair was superseded before deployment and must not be uploaded.
