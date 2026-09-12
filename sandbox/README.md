# Local WordPress Sandbox

This sandbox restores the explicitly authorized production snapshot into an isolated local environment matching WordPress 7.1 and PHP 8.4. The restored site and database live outside Git under `D:\One Drive\projects - local\statefall\sandbox-runtime`.

Snapshot provenance and completed verification are recorded in `docs/production-baseline-2026-09-12.md`.

Safety controls:

- WordPress is published only on `127.0.0.1:8088`.
- Docker Desktop does not start with Windows; `start.ps1` launches it only when needed.
- Outbound WordPress HTTP and email are blocked.
- Automatic updates and WP-Cron are disabled.
- Local database credentials and `.env` are ignored by Git.
- The repository plugin and game sources are mounted read-only over the restored copies, so local code changes are exercised without modifying the backup archive.

Commands from the repository root:

```powershell
.\sandbox\start.ps1
.\sandbox\status.ps1
.\sandbox\verify.ps1
.\sandbox\stop.ps1
.\sandbox\stop.ps1 -DockerDesktop
```

Stopping preserves the imported database. To discard and re-import only the local database:

```powershell
.\sandbox\reset-database.ps1 -Force
.\sandbox\start.ps1
```

The source backup remains unchanged. Never commit `sandbox/.env`, the extracted runtime, database dumps, uploads, or production-derived user data.

The synthetic local administrator credentials are stored in the ignored `sandbox/.env`. Do not reuse production credentials in this environment.

The restored production WP Engine MU plugins are retained under `wp-content/mu-plugins-production-disabled` but are not loaded locally because they depend on WP Engine-only constants and services.
