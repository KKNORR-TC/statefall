# Statefall Project Instructions

## Source and production

- Repository source is authoritative. Release artifacts under `D:\One Drive\projects - local\statefall\working releases` are handoff copies, not source.
- Do not access, upload to, or modify production without Ken's explicit authorization.
- Preserve deterministic simulation behavior. Any simulation-relevant change must pass the applicable replay and determinism gates.
- Follow `docs/build-a-release.md` for releases and `docs/graphics-modernization-plan.md` for modernization sequencing and test gates.
- Every game release must update the player-facing About note in `game/src/help-release.mjs`, review the shared How to Play content for changed behavior, and verify About in both the app and packaged website. The build rejects stale About version/build metadata.

## Docker sandbox

- Docker Desktop remains shut down unless the local Statefall sandbox is actively in use.
- Run sandbox commands from the repository root.
- Start and inspect the sandbox with:

```powershell
.\sandbox\start.ps1
.\sandbox\status.ps1
```

- Run the established verification suites with:

```powershell
.\sandbox\verify.ps1
.\sandbox\security-regression.ps1
```

- After every Docker-backed task, whether it succeeds or fails, stop the sandbox and Docker Desktop completely:

```powershell
.\sandbox\stop.ps1 -DockerDesktop
```

- Confirm cleanup with `.\sandbox\status.ps1`; it should report that Docker Desktop and the sandbox are stopped.
- Prefer the repository lifecycle scripts over direct `docker compose` commands.
- Any one-shot container must use `--rm`. Remove temporary containers, networks, and volumes created outside the established sandbox before finishing.
- Do not use `docker compose down`, delete the preserved sandbox database, or remove production-derived runtime data unless the task explicitly requires a reset and Ken authorizes it.
- Never commit `sandbox/.env`, extracted runtime data, database dumps, uploads, credentials, or production-derived user data.

## Verification discipline

- Test the exact release artifacts before handoff; manually repackaging an already tested artifact invalidates that verification.
- Existing coverage remains until equivalent replacement coverage passes.
- Do not declare a release GO with skipped required checks, unexplained replay divergence, failed browser requests, or incomplete Docker cleanup.
