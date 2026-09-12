# Statefall Current Status

_Updated 12 September 2026._

## Repository and production

- Source authority: `main` in this repository. Current repository versions are game 1.10.5 and plugin 1.10.4.
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

Docker Desktop 4.90.0 and WSL2 are installed with Docker autostart disabled. The isolated sandbox runs WordPress 7.1, PHP 8.4, and MariaDB 11.4 from the explicitly authorized production snapshot, with local credentials, external HTTP/email blocking, and localhost-only publication. `sandbox/verify.ps1` passes all plugin PHP syntax, public routes, authenticated cookie/nonce REST access, and save create/read/delete persistence. Start, stop, preserved-data restart, full Docker shutdown, and on-demand Docker restart have been verified. The sandbox and Docker Desktop are currently stopped. Browser workflow and production smoke checks remain separate release requirements.

## Open review findings

These findings are unresolved unless a later commit and verification entry explicitly closes them.

| Severity | Finding | Release disposition |
|---|---|---|
| Critical | Public replay data can inject stored HTML/JavaScript through unvalidated custom bot names rendered with `innerHTML`. | Blocks public release until input validation, output-safe rendering, and existing-data handling are verified. |
| Critical | The score HMAC key is delivered in public game HTML, so clients can forge leaderboard records. | Leaderboard and achievement integrity is not trustworthy. A product decision and non-client-secret trust model are required if rankings must be authoritative. |
| High | Unsigned `botNations` data can update arbitrary users' bot records. | Blocks public release until ownership, match participation, schema, and range validation are enforced. |
| High | Keep playing/Spectate is not serialized, so saves made after the first end state cannot reconstruct later progress. | Blocks claims that post-victory saves are resumable. |
| High | Save/replay quotas can be bypassed by changing record kind or creating protected Autosave rows. | Blocks public release with open registration until quotas are enforced transactionally. |
| High | Seeded randomness is consumed inside a `sort` comparator, risking replay divergence between JavaScript engines. | Must be fixed and checked across supported browsers before claiming cross-browser determinism. |
| Medium | Expired-login HTTP 403 score submissions are discarded although the UI promises a retry. | Non-security defect; fix before claiming reliable score retry. |

## Current release cutline

The local simulation and WordPress integration setups are GO. A new public release is NO-GO while the stored-XSS, cross-account mutation, and storage-quota findings remain open. The authorized production snapshot contains the game and plugin code reviewed for these findings, so the live installation requires an urgent security hotfix. Ken retains the final deployment and acceptance decision.
