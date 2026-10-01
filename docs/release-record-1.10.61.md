# Statefall 1.10.61 — field guide and allied aid

## Identity

- Date: 30 September 2026. Owner: Ken; publishing explicitly authorized with “publish it”.
- Production baseline: game 1.10.60 / plugin 1.10.10.
- Source HEAD: `37a85e6ec0ac4e2dc22644973d7385109dce1bbe`, with intentional local changes recorded in `evidence/release-1.10.61/source.json`. Prior approved audio, art, save and score fixes are retained.
- Game: 1.10.61 / `2026-09-30-field-guide-ally-aid`. Plugin remains 1.10.10; minimum required plugin 1.10.9.
- Simulation baseline: 1.10.8. Canonical schema and visual baselines unchanged. Aid command amounts now accept up to one billion; existing transfer semantics remain unchanged.
- Scope: shared illustrated guide for all eight help tabs, updated About, build-enforced release notes, and the reviewed Billionaire allied-aid fix. See `field-guide-1.10.61.md`.

## Qualification

- Fresh `npm ci`: passed.
- Full syntax/Node/replay/determinism checks: passed; 85/85 commands applied, matching final state `bc43ad4e`, digest prefix `509ad7e54aa2`, `DETERMINISTIC ✓`.
- Development-focused guide/aid browser checks: 15 passed across Chromium, Firefox and WebKit, with desktop/mobile guide layout and all forty portraits.
- Established WordPress sandbox verification: passed.
- Security regressions: passed (replay XSS, immutable kind, autosave uniqueness, bot-record isolation).
- Docker initially failed on stale Windows socket reparse points. Stopped Docker, preserved the socket-only runtime directories under timestamped names, and recreated their empty locations. Restart succeeded. No database, image, volume or factory reset was performed.
- Full uninterrupted npm run verify passed: 422 browser cases, 940 intentional project exclusions, 21 display-scale cases and the prototype test. No failures or reruns were needed.
- Reproducibility passed: both clean builds matched all 138 files.
- Exact-ZIP installation, plugin upgrade/data preservation, activation/rollback/retention, MIME/cache paths and all four installed browser cases passed. Installed About shortcode confirms current version and retained plugin navigation.
- All performance ceilings passed over three cold samples per scenario, including the approved 15-second broadband and 40-second constrained-network ceilings. Report: evidence/release-1.10.61/performance.json.
- Docker shutdown and stopped status confirmed. Source manifest still matches the pre-verification record.

## Artifacts and decision

Local release GO: all required gates passed. The exact tested game ZIP is statefall-release-1.10.61.zip, SHA-256 `875712a095f7e7fb2d79aab0af9b7967ba2a6498e4b4ae7b61b279023e3bf82d`. Its 138 entries include release.json and 137 payloads; every payload size and hash was independently verified. Minimum plugin 1.10.9; signing-key SHA-256 `c51b9460b645bc8d2f6e365ecec86408afb6949289ff3afab057e3938a1a1c53`.

Unchanged plugin 1.10.10 ZIP was verified during qualification, SHA-256 `a3a34f7ff11fa2b50a4821ee1ab56766ad73cdd042f94b8d88dd1e18e46de289`. No plugin upload needed. Game ZIP has not been rebuilt or repackaged after exact-artifact verification.

## Production

Ken confirmed “backup complete” earlier in this same release session. The restorable backup is user-confirmed; the hosting portal was not independently checked.

Published the exact qualified game ZIP on 30 September 2026 at 22:01:14 UTC as Statefall Staff. Admin confirmed 1.10.61 installed and activated with the matching signing key. Plugin remains 1.10.10. WP Engine caches cleared at 22:02:02 UTC. Prior 1.10.60 remains available for rollback; no rollback was needed and no Git push occurred.

Live acceptance passed:

- Anonymous entry, exact manifest and all 137 payload URLs; all eight guide tabs, forty portraits, current About metadata and retained WordPress navigation. See `evidence/release-1.10.61/production-public.json`.
- Authenticated startup reports game and site package 1.10.61. Profile and leaderboard load correctly.
- Synthetic acceptance match GUIDE1061LIVE (Hungary, Continents, Impossible, Custom start, 20 troops / zero gold) saved at 0:10, appeared in the account library, resumed at 0:10 and advanced normally.
- Historical HELP1060SCORE replay from 1.10.60 finished Overrun at 8× with “The replay matched the recording throughout.”
- Fresh acceptance match ended Overrun at 3.7 minutes and confirmed “Community score posted” (#74 overall, #3 Custom start), with credits at https://www.worldrts.com/credits/78/. Test save/replay/score records are retained under Statefall Staff.
- No game console errors or warnings were reported. Master mute remained checked during acceptance.

Live screenshots: `evidence/release-1.10.61/live-about.png` and `live-score.png`. Docker is stopped. Production acceptance is complete.
