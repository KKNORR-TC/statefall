# Statefall Release Record

Copy this file for each release and keep the completed record with the approved artifacts in `D:\One Drive\projects - local\statefall\working releases`.

## Identity

- Release date:
- Production baseline used:
- Source commit:
- Working tree clean or intentional changes recorded:
- Game version/build:
- Plugin version:
- `REQUIRES_PLUGIN`:
- Simulation fixture revision:
- Canonical digest/schema revision:
- Visual baseline revision:
- Performance report/environment (N/A only for an unaffected component, with approver and reason):
- Release owner:

## Artifacts

| Component | Filename | SHA-256 | Internal version inspected | Exact artifact tested |
|---|---|---|---|---|
| Game | | | | |
| Plugin | | | | |

- Game manifest/build id:
- Game signing-key SHA-256:
- Artifact build command and time:
- Rebuilt or repackaged after verification: No / Yes (rerun all artifact checks and explain)

## Verification

- `npm ci`:
- `npm run verify`:
- Deterministic hash result:
- `npm run test:build-reproducibility`:
- Browser projects and result:
- Windows visual baseline result or N/A with reason:
- Performance/device evidence or approved N/A for an unaffected component:
- `.\sandbox\verify.ps1`:
- `.\sandbox\security-regression.ps1`:
- `npm run verify:artifacts`:
- Exact-ZIP install/upgrade and data preservation:
- Manifest, activation, rollback, retention, MIME, and cache checks:
- ZIP structure and embedded-version inspection:
- Docker shutdown/status confirmation:
- Open findings reviewed:
- GO/NO-GO and approver:

## Production

- Backup/restore point confirmed:
- Uploaded by and time:
- Installed game version/build:
- Installed plugin version:
- Cache purged:
- Anonymous `/play/` check:
- Logged-in game and score submission:
- Leaderboard/profile check:
- Save/resume/replay check:
- How-to pages check:
- Rollback required:
- Post-deployment release pointer/version verified:
- Notes:
