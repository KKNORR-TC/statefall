# Statefall 1.10.49 installation handoff

GO for manual publishing after local qualification. Use the exact ZIPs and SHA-256 values in the accompanying release record. Production installation and post-installation verification remain Ken’s responsibility.

## Installation order

1. Obtain a restorable WordPress database backup and backups of the current Statefall plugin and uploads. Retain the previous working packages.
2. Install statefall-scores-1.10.8.zip through WordPress Plugins → Add New → Upload Plugin, replacing the installed plugin.
3. Install statefall-release-1.10.49.zip through Statefall → Game package → Install. Stop if package validation, signing-key or minimum-plugin warnings appear.
4. Purge relevant caches. Open /play/ anonymously and while logged in. Confirm game 1.10.49 and plugin 1.10.8.
5. Check game start, a complete score submission, leaderboard/profile, save/resume/replay and how-to pages. The first cold load downloads the classic artwork; the loading screen remains visible until ready.
6. Record the installation time, uploader, active release and verification outcome in the release record.

## Recovery

If the game needs rollback, select the previous inactive immutable release under Statefall → Game package. Preserve backups and the previous approved packages until post-installation checks are complete. Local package qualification does not replace these site checks.

## Release scope

The classic artwork is included by default. Ken approved the current unit, building and upgrade art for this release; detailed Phase G animation/state review remains follow-up work. The full game remains desktop-first. Test coverage is extensive but does not establish zero bugs for every seed, hardware configuration or player action sequence.

No production access, push or deployment has been performed as part of this handoff preparation.
