# Statefall Current Status

_Updated 12 September 2026._

## Repository and production

- Source authority: `main` in this repository. Current repository versions are game 1.10.6 and plugin 1.10.5; these versions contain a local security hotfix and are not yet deployed.
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
| Critical | The score HMAC key is delivered in public game HTML, so clients can forge leaderboard records. | Leaderboard and achievement integrity is not trustworthy. A product decision and non-client-secret trust model are required if rankings must be authoritative. |
| High | Unsigned `botNations` data can update arbitrary users' bot records. | Fixed locally in plugin 1.10.5 by ignoring non-authoritative client bot records; deployment remains required. |
| High | Keep playing/Spectate is not serialized, so saves made after the first end state cannot reconstruct later progress. | Blocks claims that post-victory saves are resumable. |
| High | Save/replay quotas can be bypassed by changing record kind or creating protected Autosave rows. | Fixed locally in plugin 1.10.5 with per-user locking, transactional hard limits, immutable kinds, and one reserved Autosave; deployment remains required. |
| High | Seeded randomness is consumed inside a `sort` comparator, risking replay divergence between JavaScript engines. | Must be fixed and checked across supported browsers before claiming cross-browser determinism. |
| Medium | Expired-login HTTP 403 score submissions are discarded although the UI promises a retry. | Non-security defect; fix before claiming reliable score retry. |

## Current release cutline

The emergency game 1.10.6/plugin 1.10.5 release is GO for Ken's manual production upload. Node syntax, full simulations, production-size determinism, PHP syntax, WordPress integration, security regressions, rendered screenshots, archive structure, embedded versions, and checksums passed. Production remains affected until Ken uploads and verifies both packages. The leaderboard trust-model decision and non-blocking reliability findings remain open.

Release artifacts in `D:\One Drive\projects - local\statefall\working releases`:

- `statefall-release-1.10.6.zip`, SHA-256 `add40fc76c99d418150c878e11a9f8effa5cb41b822aee40b5eff3ffc804b9ea`.
- `statefall-scores-1.10.5.zip`, SHA-256 `49c2f2a64d4ffe2f2c5404212c3b1e4afd5f0e6f5f4b6fce7a13f0220334c255`.
