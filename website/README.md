# Website imagery update — 29 September 2026

Repository-owned, focused updates for the existing Statefall WordPress theme. The complete theme is not currently tracked here. Published to worldrts.com on 30 September 2026 with Ken's explicit approval. The full existing header and menu were preserved.

## Changes

- Hero v1.0.0: approved cinematic battleship/fighter illustration, readable desktop overlay, stacked mobile art and copy, preserved custom tagline and calls to action. The image is eagerly loaded with high fetch priority; its dimensions reserve layout space.
- Continents: actual game 1.10.59 screenshots with the production artwork enabled, seed TERRAIN2026, normal difficulty, Iran. The close-up is used for the homepage/maps tile and detail page; the strategic overview is expandable on the detail page. Captures are from different moments of the same running match. Only browser controls and outside-map space were cropped; terrain was not retouched.
- Help/roster content and game source are unchanged by this work.

## Local application

Run from the repository root, against the local theme directory:

```powershell
.\website\hero\apply.ps1 -ThemePath '<local theme directory>'
.\website\continents\apply.ps1 -ThemePath '<local theme directory>'
node website/preview.cjs '<local theme directory>'
```

The scripts check known template markers, preserve initial template backups, and can be rerun. The static layout preview runs at http://127.0.0.1:4186. It uses the local theme stylesheet with a simplified header and selected sections; it does not execute PHP or prove WordPress integration. Generated preview files reside in ignored `.artifacts/website-review`.

For rollback, restore map-single.php/functions.php from statefall-continents-backup first, then front-page.php/functions.php from statefall-hero-backup. Compare backups before restoring if subsequent theme changes have occurred. Existing screenshot assets remain intact.

## Publication and verification

Docker was recovered by preserving and renaming stale socket directories, without resetting its data. The exact four editor-ready theme files were applied to local WordPress: PHP syntax checks, `sandbox/verify.ps1`, and `sandbox/security-regression.ps1` passed. The security harness catch was corrected for PowerShell 7's HTTP exception type so expected rejection responses can be asserted.

Desktop and mobile hero and Continents layouts were inspected in local WordPress. The existing homepage header/leaderboard still cause mobile horizontal overflow; the new hero stacks correctly. Live desktop hero, full navigation, Continents tile, close-up, and expandable overview were verified. Anonymous HTTP checks returned 200 for both pages with the new artwork and stylesheet version 1.1.1. Docker Desktop and the sandbox were stopped and confirmed stopped afterward.

`prepare-publish.cjs` builds this specific 1.1.0-to-1.1.1 update from fresh theme backups. It preserves all content outside the targeted replacements and does not edit the header. Production uses the fragments inline in the existing templates and images from `/wp-content/uploads/2026/09/`, rather than the local partial installer above. Published files: `front-page.php`, `functions.php`, `map-single.php`, and `style.css`. WP Engine caches were cleared after saving.

The pre-publication theme backups are retained outside source control at `C:/Users/ken/.codex/visualizations/2026/09/29/01a0ee46-4853-7632-8d81-0f99e5758067/theme-backup-2026-09-30/`; prepared files remain in ignored `.artifacts/website-publish-2026-09-30/`. To roll back this publication, review subsequent changes first, then restore those four pre-publication files and clear the site cache. The generator intentionally rejects unexpected baseline versions.

## Artwork provenance

### All map galleries and homepage imagery — 30 September 2026

Published the same three-image treatment across all 12 map pages: a large terrain view, closer crop, and strategic overview. The approved Continents v2 images remain in use. The other 11 maps now use their own simulator screenshots; the homepage and Maps archive share optimized 600px thumbnails. The homepage's Garrisons illustration and Ships help-panel screenshot were refreshed from the current app. The cinematic hero, full navigation, and app-served help/roster content were preserved.

`maps/captures.json` records the source crops and map-specific captions. `maps/crop.cjs` crops/resizes real 2560×1600 simulator screenshots into 46 JPEG assets (8.8 MB combined); it does not repaint or composite terrain. New map captures use seed MAPS2026, Normal difficulty and Quick start. Geographic maps select an available regional nation automatically. The homepage gameplay capture uses Continents, seed TERRAIN2026, Iran, with Garrisons selected. Audio was muted. Raw captures are retained outside source control in the visualization directory's `all-terrain-sources` folder. Captures show different moments and, where a renderer refresh was needed, different matches using the same seed.

`maps/prepare-publish.cjs` builds the exact three changed templates from the fresh `theme-backup-2026-09-30/all-terrain-before` backup. It rejects unexpected inputs and preserves the hero and styles. Editor-ready outputs are in ignored `.artifacts/website-all-terrain-ready`. All 46 files were uploaded once through WordPress Media. Published templates: `functions.php`, `map-single.php`, and `front-page.php`; WP Engine caches were cleared. The unchanged stylesheet/theme version remains 1.1.2.

Verification: all three PHP syntax checks passed, as did `sandbox/verify.ps1` and `sandbox/security-regression.ps1`. Local map routes and homepage image markers passed. Desktop galleries and the 390px stacked mobile gallery were inspected. All 12 live map pages and every homepage map tile were verified, and all 46 new image URLs returned HTTP 200. Live proof: `all-terrain-published.png` and `large-islands-published.png` in the visualization directory. The existing mobile header layout is outside this imagery change. The simulator and Docker sandbox were shut down after verification.

For rollback, compare subsequent changes before restoring the three corresponding files from `all-terrain-before`, then clear the site cache. Old assets remain available; no uploads were deleted.

### Continents imagery v2 — 30 September 2026

Replaced the homepage/maps Continents tile with a 2100×1180 coastal gameplay capture showing ports, river channels, wooded ground and a moving ship. The detail page leads with this image and adds an always-visible two-column gallery: a 1600×1000 terrain close-up and the strategic overview. It stacks into one column on mobile. Captures use the local production-art renderer at detailed zoom, seed TERRAIN2026, Normal difficulty, Iran; audio was muted. `continents/crop-v2.cjs` records exact screenshot crops and JPEG export settings; no terrain was painted or composited.

Published only `functions.php`, `map-single.php` and the two v2 JPEG uploads. Backups and exact tested templates are in the existing backup directory with `before-terrain-v2` / `terrain-v2-ready` names. Both PHP files passed syntax checks; local WordPress verification and security regressions passed. Desktop and 390px mobile image loading/layout checked. Docker startup required the same non-destructive socket recovery again.

### Wide-screen correction — 30 September 2026

Hero CSS v1.0.1 anchors the artwork at the top and caps its desktop width at 1600px, with faded side edges. This prevents centered vertical cropping and unlimited artwork enlargement on wide displays. Local layout checks covered 2560px, 3840px, and 390px widths. Published stylesheet and theme cache version are now 1.1.2; the menu and hero copy are unchanged. This CSS correction did not require starting Docker. The publication generator now targets 1.1.2 from the original 1.1.0 backup.

The hero was generated with the built-in image tool and approved by Ken for implementation. Original PNG is preserved at `hero/assets/statefall-hero-v1.png`.
Prompt: cinematic movie-poster-style Statefall website hero; steel-gray battleship below a head-on twin-tail fighter, cobalt-blue accents, stormy ocean and warm gold rim light, dark left-side negative space for headline, wide 16:9, no text or interface.
