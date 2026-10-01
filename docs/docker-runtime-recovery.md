# Docker runtime recovery — 1 October 2026

Docker Desktop 4.90.0 repeatedly failed while renaming Windows runtime sockets (sailor-ingest.sock and engine.sock). With Docker fully stopped, querying the former reparse point returned Windows error 1920. Replacing only the parent runtime directories previously restored startup, but the failure recurred on subsequent launches.

This matches the open [Docker report #676](https://github.com/docker/desktop-feedback/issues/676). The [current release notes](https://docs.docker.com/desktop/release-notes/) do not establish a fix for this exact error. The underlying Windows/Docker cause is not proven locally; do not describe it as permanently fixed by an upgrade or reset.

## Persistent workflow workaround

`sandbox/start.ps1` and `sandbox/stop.ps1 -DockerDesktop` now call `preserve-runtime-sockets.ps1` while Docker is fully stopped. It checks exact local AppData runtime paths, rejects redirected parent directories, validates every entry against the five known socket names and ReparsePoint attributes, then moves the socket-only directory to a timestamped sibling and recreates it empty. It rechecks processes immediately before moving. Unknown contents cause a clear failure before launching Docker. Existing runtime entries cannot have their tags read reliably, so name/attribute/directory checks are deliberately restrictive.

No Docker database, volume, image, container or settings directory is reset or removed. Preserved socket directories are not automatically deleted. The startup guard also refuses to launch another Desktop instance over an unhealthy/running one. Continue using the repository lifecycle scripts; direct Desktop launches after an external shutdown are outside the preflight protection. Cleanup on our normal shutdown leaves the next direct launch with empty runtime folders too.

## Validation

- First start preserved the previously broken sockets and started the existing sandbox successfully.
- First stop shut down the containers and Desktop, preserved the fresh sockets, and left empty runtime directories.
- Second start succeeded without a socket error, followed by the sandbox application, authenticated REST and save CRUD checks.
- Second stop succeeded. Status confirmed Docker Desktop and sandbox stopped.
- Evidence logs: `.artifacts/docker-start-recovery-{1,2}.log`, `.artifacts/docker-stop-recovery-{1,2}.log`, `.artifacts/docker-recovery-verify.log` (local logs, not source-controlled).

This is a verified recurring-workflow workaround, not proof of a vendor-level permanent repair. Reassess it if Docker changes runtime contents; do not loosen the allowlist blindly. No automatic upgrade, factory reset or broad cleanup was performed.
