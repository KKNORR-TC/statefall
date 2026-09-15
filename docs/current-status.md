# Statefall Current Status

_Updated 15 September 2026._

## Repository and production

- Source authority: `main` in this repository. Current repository versions are game 1.10.8 and plugin 1.10.6. Production remains game 1.10.7/plugin 1.10.6; a repository version does not prove deployment without a release record.
- Production: [WorldRTS.com](https://www.worldrts.com/) is a live public WordPress site. Ken confirmed successful installation and production verification of game 1.10.7/plugin 1.10.6 on 14 September 2026. The earlier authorized snapshot is retained as the pre-release baseline in `docs/production-baseline-2026-09-12.md`.
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

As of this update, Phase 0 modernization verification passes: comprehensive syntax checks, hardened harness assumptions, state invariants, pinned canonical SHA-256 simulation baselines, strict replay positive/negative checks, reduced-grid map and mode simulations, standard/fog/garrison same-page replay checks, production-size cold determinism, and Playwright Canvas checks in Chromium, Firefox, WebKit, mobile profiles, and reduced motion. The determinism result is `DETERMINISTIC ✓`. See `docs/testing-baselines.md`.

Phase A review evidence is now available in `docs/phase-a-evidence.md`: all production maps have strategic/close Windows Chromium references, major modes and representative input paths have browser coverage, desktop performance ceilings pass, and a standalone illustrated command-map vertical slice has desktop plus advisory portrait references. The full game is desktop-first; mobile/Playables remains optional and may become a separate Statefall Light track. Phase A remains open pending human art-direction approval, broader replay/action scenes, and supported desktop display review.

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
