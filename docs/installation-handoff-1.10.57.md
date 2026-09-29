# Install Statefall 1.10.57

Qualified local handoff. Production installation and acceptance are not yet recorded.

## Current files

In `D:\One Drive\projects - local\statefall\working releases`:

- Game: `statefall-release-1.10.57.zip` — SHA-256 `57a337c3246e94a63dae6d979e6ab317312da4c6623bd1b51a1631e3798e4050`.
- Compatible plugin: `statefall-scores-1.10.9.zip` — SHA-256 `c3520f9091873f48e0b9cded7522b701546d69bf14671b5fc7f9a45fa89798bc`.
- Matching checksum files and `release-record-1.10.57.md`.

Keep plugin 1.10.9 if already installed. The game includes the prior silo-flight correction and adds named unit images during startup. Reduced-motion users see one static image.

## Installation

1. Keep restorable backups of the WordPress database, plugin, and Statefall uploads, plus the previous immutable game release.
2. Check the ZIP checksums against the accompanying files.
3. If the installed plugin is older than 1.10.9, upload the compatible plugin through WordPress Plugins and replace the existing plugin first.
4. Upload the game through **Statefall → Game package → Install**. Do not use the WordPress plugin installer for the game ZIP.
5. Purge relevant caches. Check anonymous and logged-in play, displayed versions, loading images, game start, score submission, leaderboard/profile, save/resume/replay, and how-to pages.
6. Record installation time, versions, and live verification before calling production accepted. Roll back through Statefall's inactive immutable releases if necessary.

## Archived handoffs

Older top-level handoff files were moved unchanged into `superseded/2026-09-28-before-1.10.57/`. Earlier archives remain in `superseded/`. No package was deleted or rebuilt during cleanup.

The dated archive includes the immediate previous 1.10.56 testing patch and the earlier qualified 1.10.51 game. Their original notes retain their original qualification scope. Held releases and obsolete plugin versions are historical records, not current installation recommendations. Archived notes retain their original text; relative links may refer to their former top-level location. Repository release records remain authoritative.
