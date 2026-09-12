# Building a Statefall release from these files

Layout expected by the tools: the game at `index.html`, the plugin as a folder `statefall-scores/` with `statefall-scores.php`, `readme.txt`, `includes/*.php`, `assets/*`. The `plugin-includes-NAME.php` files here map to `statefall-scores/includes/NAME.php`; `plugin-assets-*` to `statefall-scores/assets/*`.

Game release (`statefall-release-x.y.z.zip`):
1. `node tools-build-howto.js index.html pkg/howto` (needs `npm install canvas`) — the how-to pages.
2. `node tools-build-flags.js index.html pkg/flags.js` — the site's flag renderer.
3. Put `index.html`, `howto/`, `flags.js` and a `VERSION.txt` line in the zip. Install under Statefall → Game package.

Plugin release: zip the `statefall-scores/` folder as `statefall-scores-x.y.z.zip`; bump `Version:` and `STATEFALL_VERSION` in the main file first. Install via Plugins → Add New → Upload → Replace.

Before any release that touches the simulation: `SEED=X DIFF=hard TICKS=2000 node tools-determinism.js` must print `DETERMINISTIC ✓`.
