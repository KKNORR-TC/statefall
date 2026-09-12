# Production Baseline: 12 September 2026

## Provenance

- Source: full current-site archive supplied by Ken with explicit authorization for isolated local restoration.
- Snapshot time: 2026-09-12 14:22:30Z.
- Archive SHA-256: `21846797664e949bf9cbbb1892702bb227d71f2fcc0ad5a17c0721aadba91455`.
- The archive contains the WordPress filesystem and `wp-content/mysql.sql`. It remains outside Git and must be treated as sensitive production data.

## Confirmed environment

| Component | Production snapshot |
|---|---|
| WordPress | 7.1 |
| PHP | 8.4, as reported by the hosting panel |
| Game | 1.10.5, build 2026-09-12 |
| Plugin | 1.10.4 |

The installed game file SHA-256 is `5f356a8e37fe19f5a2071c30f04b593ef2ea1c54de85cf88f0a0a279ff8281fc` and matches `game/index.html` byte-for-byte. The restored plugin source matches `plugin/statefall-scores/`; the only later difference is the repository `readme.txt` paperwork correction made during this session.

These hashes identify files within the snapshot, not the original deployment ZIPs. Future releases must record package checksums using `docs/release-record-template.md`.

## Local restoration

- Runtime location: `D:\One Drive\projects - local\statefall\sandbox\statefall-runtime`, outside the repository.
- Runtime: Docker Desktop 4.90.0, WordPress 7.1/PHP 8.4 Apache image, MariaDB 11.4.
- Access: `http://localhost:8088` bound only to `127.0.0.1` while running.
- Production database credentials and WordPress salts were replaced.
- A synthetic local administrator was created; credentials are stored only in ignored `sandbox/.env`.
- Production WP Engine MU plugins were disabled in the local copy because they require host-only constants and services.
- Outbound WordPress HTTP, email, automatic updates, and WP-Cron are disabled.
- Repository game and plugin sources are mounted read-only over the restored copies while the sandbox runs.

## Verification

- Database import completed successfully.
- Home page and `/play/` return HTTP 200.
- `/play/` serves game 1.10.5.
- Statefall plugin 1.10.4 is active.
- Public classes REST endpoint responds.
- Synthetic administrator login and REST nonce authentication succeed.
- Save create/read/delete persistence succeeds and the synthetic record is removed.
- Every plugin PHP file passes PHP 8.4 syntax checking.
- Sandbox stop/start preserves data; full Docker shutdown and on-demand restart work.
- Docker Desktop autostart is disabled, and the sandbox was stopped after verification.

No production server was accessed or modified during restoration or verification.
