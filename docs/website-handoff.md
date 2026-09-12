# Statefall RTS — Website Handoff

> Historical design and build handoff. It is not authoritative for current implementation, production status, security disposition, or release operations. See `README.md`, `docs/current-status.md`, and `docs/build-a-release.md`.

*One document for the web designer and the site build. **Part A** describes the game as it is, for copy, structure and screenshots. **Part B** is the build spec for the WordPress login, the global leaderboard and how the game plugs in, so the site, the plugin and the game can be built in parallel and meet at deploy. Everything is true of the current build (`index.html`, ~520 KB, single file); quote numbers as-is.*

---

# Part A — The game


---

## 1. What it is in one paragraph

Statefall is a real-time strategy game that plays in a browser tab with no install, no account and no server. You start as one small nation on a map of a hundred countries — real-world maps or generated continents, islands and atolls — and race nine rival nations to hold 72% of the land. You eat the neutral countries around you, build an economy of cities, factories and ports, and then fight for the rest with armies, navies, air power, missiles and diplomacy. A match runs 15–25 minutes. Think Risk played live, with a navy.

**Tagline options**
- *A real-time Risk. Start small, eat your neighbours, hold the world.*
- *One file. One hundred nations. Seventy-two percent of the land.*
- *Every coast is a front. Every island is a decision.*

**Positioning notes for writers**
- It is *deep*, not *casual* — closer to a compact Civilization than to a mobile clicker. The unit roster is large (13 buildings, 8 ship classes, 3 aircraft, subs, missiles) but every unit has a clear counter, and the How-to-play tabs in the game document all of it.
- It is *legible*: everything happens on one map you can zoom from the whole world down to individual tiles.
- It is *self-contained*: one HTML file, runs offline, no dependencies, no tracking, saves to the browser. This is a selling point worth stating plainly.

---

## 2. Core loop

1. **Expand** — left-click a bordering nation to attack with a share of your army (slider). Neutrals don't fight back until you hit them; then they mobilise and counter-attack if you're spread thin.
2. **Build** — right-click your land for the build menu. Cities grow troops, factories and ports make gold, supply lines between them add bonuses.
3. **Unify** — own every tile of an island or continent for a one-time troop windfall and an ongoing growth bonus. Unifying your home landmass first is the classic opening.
4. **Project power** — ports build transports and warships; airfields build fighters and bombers; silos launch missiles. Diplomacy (pacts, alliances, aid) shapes who you're fighting.
5. **Win** — 72% of the land (or your team's combined land). A nation whose army hits zero collapses outright.

---

## 3. Maps

| Map | Kind | Notes |
|---|---|---|
| Continents | Generated | 6–9 organic landmasses with rivers, the default |
| Land, lakes & rivers | Generated | One big continent cut by lakes and 4–14 rivers |
| Large / Medium / Small islands | Generated | Naval-heavy play |
| Atoll | Generated | A ring with a lagoon and channels |
| World, Europe, Americas, Africa, Asia, Middle East | Real | Natural Earth data; large countries are split into provinces |

Every map has ~50–90 neutral countries, a **seed** shown on the start card that reproduces the exact map and start positions (restart keeps it; share it with a friend), and 74 real-nation flags drawn procedurally — you pick yours.

---

## 4. Modes and difficulty

**Garrisons** (a switch at the top of the start card) — troops live where they are. Every contiguous area of your land has its own garrison; water and rivers separate them; reinforcing across water is a transport that can be sunk. Density, pushback and betrayal all read the local garrison, so a rich homeland no longer protects a thin beachhead. Has its own How-to-play tab and its own leaderboard class.

**Modes** (checkboxes; Quick start, Risky start and End game are exclusive, the rest combine)
- *Quick start* — begin with a large holding, 4× troops, 5× gold.
- *Risky start* — nobody starts with land; everyone drafts neutral countries round-robin.
- *End game* — the whole map already divided, everyone at 45,000 troops.
- *Fog of war* — troop counts, buildings, ships and missiles hidden outside your vision; radar, spy planes, satellites and jammers matter.
- *Instant build* — no construction timers (shields and upgrades excepted).
- *Billionaire* — you start with a billion troops and a billion gold.
- *Teams* — 2, 3 or 4 permanent teams; a team wins together.

**Difficulty** is behaviour, not just a multiplier:

| Level | Bots… |
|---|---|
| Super easy | grow at half speed, rarely fight, no brain |
| Easy | slower; place defenses sensibly |
| Normal | even footing; sensible placement, reinforce a winning attack |
| Hard | manage their economy, remember where they were hit and build answers, pick a focus enemy, break off stalled attacks, gang up on a runaway leader |
| Super hard | all of Hard plus air power — airfields, patrols, bombers, paradrops |
| Impossible | all of it, faster |

---

## 5. The roster

### Buildings (right-click your land)

| Group | Building | Role |
|---|---|---|
| Economy | City | +300 troops now, raises cap and growth, supply hub |
| | Factory | gold; supply lines to cities and ports |
| | Port | ships, trade merchants, supply hub. **Upgrade to II**: built-in shore guns, heavy transports, unlocks sub bases |
| Defense | Bastion | doubles the cost of taking nearby land |
| | SAM site | intercepts missiles in range (96%, layered) |
| | Shield generator | 12-tile dome that stops every missile, 100%; 10 hp, repairable, never decays |
| Coast & artillery | Shore guns | 14-tile rapid fire; the transport stopper |
| | Coastal battery | 34-tile heavy gun, outranges a battleship |
| | Big Bertha | 60-tile artillery, uninterceptable, hits buildings |
| Strike | Missile silo | 280-gold missiles, 20-tile crater |
| | Missile command | auto-fires silos, salvo logic against SAMs, regional focus |
| Command | Troop command | +10% growth each (to +40%); with Garrisons, runs logistics with route-risk checks |
| | Engineering command | four repair trucks that fix shields, guns and port II guns over your land |
| Air | Airfield | hangar for 4 aircraft (6 at level II); spy planes fly from here. **Upgrade to II**: light shield dome, stealth troop transports |
| | Flight operations | buys aircraft, keeps patrols, recalls damaged pilots, strikes with bombers |
| Navy | Submarine base | attack subs and hunter subs (needs a port II nearby) |
| Intel (fog only) | Radar station / Long-range radar | 45 / 110-tile vision |
| | Radar jammer | blanks enemy radar within 30 tiles |
| | Satellite site | 400-gold launches reveal the whole map for 45 s |

### Ships (right-click water)

| Class | Role |
|---|---|
| Scout | fast picket |
| Destroyer | escort; sees subs at 8 tiles; double damage vs cruisers |
| Missile cruiser | 4-missile barrage every 15 s, hunts SAMs and guns |
| Battleship | 6-missile barrage, biggest guns; **refit with cruise missiles** at a port II: two low, straight cruise missiles every 40 s up to 120 tiles inland — shields first, then SAMs |
| Radar ship | 60-tile vision under fog |
| Privateer | boards merchants and sails them to your port for double cargo |
| Attack sub | invisible unless within 8 tiles of a destroyer/radar ship or 20 of a hunter; torpedoes one-shot ordinary transports |
| Hunter sub | sees and torpedoes subs, nothing else |
| Transports | automatic; **heavy transports** (4 hp, return fire) once you own a port II |
| Merchants | automatic trade between ports; blockade or pirate them |

### Air (right-click the map)

| Aircraft | Role |
|---|---|
| Stealth fighter | 25-tile patrol for 10 min; untouchable by SAMs; kills bombers, troop transports and spy planes; dogfights with air-to-air missiles; recall from the Air panel, repairs at base |
| Stealth bomber | 30-tile run of 8 bombs, each 1/8 of a nuke; ignores SAMs; stopped by fighters and shields |
| Stealth troop transport | airfield II; paradrops up to 1,500 troops anywhere in range — no coast needed |
| Spy plane | fog only; reveals a 35-tile circle for 45 s |

### Missiles

Silo missiles (nukes): 20-tile crater, buildings destroyed, the garrison on the cratered ground dies. Countered in layers — SAM sites thin a salvo, shield domes stop what's left. Cruise missiles from refitted battleships fly low and straight. When *you* are nuked: a red card names the attacker, an air-raid siren plays, the launching silo flashes, and an arrow points to it if it's off screen.

---

## 6. Systems worth a paragraph each

- **Supply lines** — factories auto-link to cities and ports within 34 tiles; each line adds gold, troops or cheaper ships. Command buildings draw their own links (missile command → silos, flight ops → airfields, troop command → cities).
- **Neutrals** — never attack first; once hit they mobilise, counter-attack thin invaders, and hold a grudge. Sustained pressure makes them collapse.
- **Diplomacy** — 3-minute pacts, permanent alliances, allied SAM defense and shared vision, aid in troops and gold, reputation that bots remember. Handshake badges over allies' names; a broken heart when a pact breaks.
- **Fog of war** — territory and names always visible; everything else needs vision. Eyes (territory margin, warships, fighters, spy planes, satellites) versus radar (stations, radar ships) — jammers blank radar only.
- **Upgrades** — ports and airfields to level II; captured with their level; bombardment knocks a II back to I.
- **Banners** — a nation falling ("EGYPT — FALLEN, killed by France", bugle call) and a continent unified (gold banner, herald fanfare) take the centre of the screen without stopping play; fallen nations stay on the sidebar list with who killed them.
- **Sound** — fully synthesised, no audio files: a generative game score that rises with pressure, a written menu theme, tiered sound importance so the whole-map view is a murmur while announcements cut through; a mixer with Master/Effects/Alerts/Ambient/Music.
- **Animation** — captured tiles spark, ships sink into their wakes, aircraft tumble, destroyed buildings leave scorch marks that fade, intercepts throw fragments, barrages fan out as rockets, torpedoes trail foam.

---

## 7. Interface

- **Sidebar**: nation, troops/gold/land/income, economy slider (troops vs gold), attack slider, Intel row (fog), Air panel (recall), Diplomacy, leaderboard (hover to highlight a nation on the map, click to jump), log.
- **Right-click menus**: grouped with real icons; buildings snap to the nearest valid spot within 5 tiles.
- **Header**: pause, restart (with confirmation; keeps your settings and seed), help, music.
- **How to play**: tabs — Basics, Buildings, Ships, Air, Systems, Garrisons, Modes — with real icons and sprites.
- **Hotkeys**: C F P S M D K N for buildings, Space pause, Esc cancel, scroll/drag to zoom and pan (0.35× to 12×).

---

## 8. Leaderboard

Local, in the browser. Every finished (or abandoned) match is recorded: result, country, map, difficulty, modes, time, land, nations eliminated, peak troops, gold, seed. Score = land% × difficulty × mode bonus (fog 1.25, risky 1.15) × result ÷ minutes. Each class of match — Standard, Garrisons, Quick start, End game, Billionaire, combinations — has its own board; the combined view shows the top 3 of each with a **Play a random … match** button, and empty classes read *"No leader yet — play and take a spot!"* A global board is designed but not built (it would be a small WordPress endpoint).

---

## 9. Technical facts (for the designer's reference — not for the public site)

*Keep the implementation story off the public pages: no "single file", no "no framework", no "synthesised audio". Say it's a browser game that needs no install, and stop there.*

- One HTML file, ~520 KB, HTML/CSS/JavaScript on Canvas. No framework, no dependencies, no build step.
- Runs from a file on disk or any static host. Works offline.
- No accounts, no analytics, no ads. The only stored data is the leaderboard and audio settings in the browser's localStorage.
- Single-player. Nine bot nations plus neutrals. Deterministic seeded maps.
- 720×414-tile world, 100 ms simulation ticks, 60 fps rendering.

**Not in the game (don't promise):** multiplayer, replays/saves, a minimap, mobile/touch controls.

---

## 10. Glossary (use these spellings)

Statefall RTS · nation · neutral · landmass / continent / island · unify · garrison (Garrisons mode) · area (a contiguous holding in Garrisons) · bastion (not fort) · SAM site · shield generator / dome · shore guns · coastal battery · Big Bertha · missile silo · missile command · flight operations · troop command · engineering command · airfield (level I / II) · port (level I / II) · submarine base · attack sub / hunter sub · privateer · heavy transport · cruise missile · spy plane · satellite · radar jammer · fog of war · Quick start / Risky start / End game / Instant build / Billionaire / Teams · seed · leaderboard class.

---

## 11. Suggested site structure

The privacy policy page is the designer's; the game's About tab links to WordPress's designated privacy page (Settings → Privacy) or `/privacy-policy/`, and to `/community/`. What the game actually stores, for that page: locally in the browser — leaderboard records and audio settings; on the site, per logged-in user — score, result, country, map, difficulty, modes, time, land %, nations eliminated, peak troops, gold, seed, timestamp, and a salted hash of the IP kept for moderation only. Nothing else; no gameplay is recorded.

1. **Hero** — logo (the SVG is embedded in the file: a fracturing two-tone landmass mark with a stepped STATEFALL wordmark), one tagline, a *Play now* button that opens `index.html`, a screenshot of a mid-game map.
2. **How it plays** — the five-step core loop with a screenshot each.
3. **The roster** — three cards: Land, Sea, Air, each listing the units in a sentence or two; link to the in-game How-to-play for the numbers.
4. **Modes** — Garrisons gets its own block; the rest as a row of tiles.
5. **Maps** — the twelve map buttons as a gallery.
6. **Leaderboard** — what it tracks; "play and take a spot".
7. **Community** — link the bbPress board at `/community/` for strategy, seeds, bugs and suggestions; the game's About tab links there too.
8. **FAQ** — Does it need an account? (No.) Does it work offline? (Yes.) Multiplayer? (Not yet; single-player with nine bots.) Can I share a map? (Yes — the seed.) Is it free? (Whatever you decide.) What browser? (Any modern desktop browser; keyboard and mouse.)

**Screenshots to capture** (in-game, F11 fullscreen, sidebar visible): a naval landing under shore-gun fire; a nuke impact with SAM interceptors; a fighter patrol over a SAM belt; a "FALLEN" banner; the Garrisons sidebar with several areas; the start card; the How-to-play Ships tab.


---

# Part B — WordPress login, global leaderboard and integration

*Part A says what the game is; this part says how the website, the WordPress login and the game connect, so three streams can be built at once and meet at deploy.*

---

## 12. The shape of it

- **WordPress is the identity provider.** Players register and log in with a normal WordPress account. No second user table, no OAuth to third parties.
- **The game is served from the WordPress site itself** (same origin), so the browser's WordPress login cookie applies to it and the REST API can be called with a nonce. No CORS, no tokens in the game file.
- **A small custom plugin** (`statefall-scores`) adds three REST endpoints, one database table, and two shortcodes.
- **The game's local leaderboard already exists.** The global one reuses its record format exactly; the game adds a name/sign-in state, a POST on match end, and a GET for the top list. Nothing the local board does is changed.

Three streams, three owners:

| Stream | Builds | Depends on |
|---|---|---|
| **Website** | pages, theme, login/registration UI, profile page, board page | the plugin's shortcodes (can stub with static tables) |
| **Plugin** (`statefall-scores`) | endpoints, table, validation, shortcodes | nothing — start now |
| **Game** | sign-in badge, submit, fetch, "Global / Mine" toggle | the endpoint contract below (can develop against a mock) |

---

## 13. Hosting layout

```
https://<site>/                 WordPress
https://<site>/play/            the game — index.html served as a page or a static file inside the theme/plugin
https://<site>/leaderboard/     page with [statefall_board]
https://<site>/profile/         page with [statefall_profile]  (logged-in only)
https://<site>/wp-json/statefall/v1/…   REST endpoints
```

Serving the game: the simplest reliable option is a page template that outputs `index.html` verbatim (the plugin can register `/play/` as a rewrite that streams the file). The file must be on the same origin as `wp-json`. Do **not** iframe it from another domain.

The game reads the WordPress nonce from a tiny inline script the page template injects before the game's own script:

```html
<script>
window.STATEFALL_WP = {
  rest: "https://<site>/wp-json/statefall/v1/",
  nonce: "<?php echo wp_create_nonce('wp_rest'); ?>",
  user: <?php echo is_user_logged_in()
        ? json_encode(['id'=>get_current_user_id(),'name'=>wp_get_current_user()->display_name])
        : 'null'; ?>,
  loginUrl: "<?php echo wp_login_url('/play/'); ?>",
  registerUrl: "<?php echo wp_registration_url(); ?>"
};
</script>
```

If `STATEFALL_WP` is absent (file opened from disk), the game behaves exactly as today: local board only, no sign-in UI.

---

## 14. REST contract (the plugin owns this; the game codes against it)

Namespace `statefall/v1`. All responses JSON. Nonce header `X-WP-Nonce` required on POST; GET endpoints are public.

### `GET /me`
Who am I. Returns `{ "id": 12, "name": "Ken", "matches": 41, "best": 612 }` or `401`.

### `POST /scores`
Submit one finished match. Body is **the game's existing leaderboard record**, unchanged:

```json
{
  "when": 1757372345000,
  "result": "Victory",            // Victory | Total victory | Team victory | Shared victory | Defeat | Abandoned
  "country": "Portugal",
  "map": "random",                // random | land | islands_l | islands_m | islands_s | atoll | world | europe | americas | africa | asia | mideast
  "diff": "hard",                 // supereasy | easy | normal | hard | superhard | impossible
  "fog": true, "risky": false,
  "cls": "Standard",              // leaderboard class, e.g. "Garrisons", "Quick start + Instant build"
  "land": 76.1, "minutes": 14.2, "kills": 6, "peak": 48210, "gold": 31200,
  "seed": "7N79XU",
  "score": 412,
  "sig": "…"                      // see §4
}
```
Response `{ "ok": true, "id": 9981, "rank": 3, "classRank": 1 }`. The plugin **recomputes `score`** from the fields and ignores the client's value.

### `GET /scores?cls=Standard&limit=50&offset=0`
Top list for a class, ordered by score then time. Each row: the record above plus `"user": {"id":12,"name":"Ken"}` and `"rank"`. `cls=__all` returns the top 3 of every class (the game's combined view).

### `GET /scores/mine?cls=…` *(logged in)*
Same shape, the caller's own matches.

### `GET /classes`
`[{"cls":"Standard","count":1830},{"cls":"Garrisons","count":412},…]` for the board page's dropdown.

Errors: `400` malformed, `401` not logged in, `403` bad nonce/signature, `422` implausible record (see §16), `429` rate limited. Error body `{ "error": "code", "message": "…" }`.

---

## 15. Database

One table, created on activation:

```sql
CREATE TABLE {prefix}statefall_scores (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  played_at DATETIME NOT NULL,
  result VARCHAR(20) NOT NULL,
  country VARCHAR(40) NOT NULL,
  map VARCHAR(20) NOT NULL,
  diff VARCHAR(12) NOT NULL,
  fog TINYINT(1) NOT NULL DEFAULT 0,
  risky TINYINT(1) NOT NULL DEFAULT 0,
  cls VARCHAR(60) NOT NULL,
  land DECIMAL(5,1) NOT NULL,
  minutes DECIMAL(6,1) NOT NULL,
  kills SMALLINT UNSIGNED NOT NULL,
  peak BIGINT UNSIGNED NOT NULL,
  gold BIGINT UNSIGNED NOT NULL,
  seed VARCHAR(16) NOT NULL,
  score INT UNSIGNED NOT NULL,
  ip_hash CHAR(64) NOT NULL,
  created_at DATETIME NOT NULL,
  KEY cls_score (cls, score DESC),
  KEY user (user_id, created_at)
);
```

Retention: keep everything; the board queries are indexed. A weekly cron can prune `Abandoned` rows older than 90 days.

---

## 16. Trust and abuse

Honest framing: the game runs entirely in the player's browser, so a determined person can forge a submission. The goal is to stop casual tampering and obvious nonsense, not to be tamper-proof.

1. **Nonce + login.** Every POST needs a valid `wp_rest` nonce and a logged-in user. This alone stops drive-by junk.
2. **Signature.** The game HMAC-SHA256s the canonical JSON of the record (fields in the fixed order above, no `sig`) with a key baked into the game file; the plugin has the same key in `wp-config.php` (`STATEFALL_SIGN_KEY`). Mismatch → `403`. Rotate the key by shipping a new game file; the plugin can accept two keys during a rollover.
3. **Server-side score.** The plugin recomputes the score with the same formula (§18) and stores its own value.
4. **Plausibility.** Reject (`422`) any of: `land` > 100 or < 0; `minutes` < 1.5 for a victory; `land` ≥ 72 with `result` = Defeat; `kills` > 9; `peak` > 1e12; class contains "Billionaire" while `peak` < 1e8; `diff`/`map`/`result` not in the allowed lists; `seed` not 1–16 alphanumerics.
5. **Rate limit.** Max 6 submissions per user per 10 minutes, 40 per day. Store a salted hash of the IP for moderation only.
6. **Moderation.** A WP admin page listing recent submissions with delete and ban-user (a user meta flag the endpoint checks). Enough.

---

## 17. Website stream — what to build

**Pages**
- `/` — the marketing site per the feature handoff; hero button → `/play/`.
- `/play/` — the game page: full-viewport, no theme chrome, injects `STATEFALL_WP`, streams `index.html`.
- `/leaderboard/` — `[statefall_board]`: class dropdown, top 50, columns *Rank · Player · Score · Result · Country · Map · Difficulty · Time · Land · Seed*. Seed is a link to `/play/?seed=XXXX` (the game reads `?seed=` into the start card).
- `/profile/` — `[statefall_profile]`: the logged-in player's stats (matches, best score, wins, favourite map, most-played class) and their match history, newest first. Redirect to login if logged out.
- Login / Register / Lost password — use WordPress's own forms styled to the theme (`wp_login_form()` on a page is enough; registration must be enabled in Settings → General). No social login for v1.

**Header** — "Play", "Leaderboard", and either "Log in / Register" or the user's name → Profile · Log out.

**Theme notes** — dark palette matching the game (`#0f1a26` background, `#1a2634` panels, `#ffd27a` gold accent, `#7fb3ff` blue); the game's logo SVG can be lifted from the top of `index.html`.

**While the plugin isn't ready:** build the shortcode blocks against a static JSON fixture in the same shapes as §14 so the layout is done before the endpoints land.

---

## 18. Plugin stream — `statefall-scores`

Files: `statefall-scores.php` (bootstrap, activation, table), `includes/rest.php`, `includes/score.php`, `includes/shortcodes.php`, `includes/admin.php`, `assets/board.css`.

**Score formula (must match the game):**
```
diffMult   = {supereasy:0.4, easy:0.7, normal:1, hard:1.4, superhard:1.9, impossible:2.6}[diff]
modeMult   = (fog ? 1.25 : 1) * (risky ? 1.15 : 1)
resultMult = {"Total victory":1.3, "Victory":1, "Team victory":1, "Shared victory":0.7, "Abandoned":0}[result] ?? 0.25
score      = round(land * diffMult * modeMult * resultMult / max(1, minutes) * 100)
```

**Shortcodes:** `[statefall_board cls="Standard" limit="50"]`, `[statefall_profile]`. Both render server-side HTML with the CSS from `assets/board.css`; no JavaScript required for v1.

**Rewrite:** `/play/` → streams the game file from `wp-content/uploads/statefall/index.html` (uploaded via the admin page so the game can be updated without touching the theme). The admin page shows the current file's version and lets you upload a new one.

**Settings:** signing key (read from `wp-config.php`, shown masked), rate limits, prune-abandoned toggle.

---

## 19. Game stream — what changes in `index.html`

Small and additive; local play is untouched.

1. **Detect `window.STATEFALL_WP`.** If present: show a sign-in state in the start card header — "Playing as Ken · Profile" or "Log in to post scores" linking to `loginUrl`. Also read `?seed=` from the URL into the seed field.
2. **On match end** (same place the local record is written): if signed in, sign the record and `POST /scores` with the nonce; on `{ok}` show "Posted — #3 overall, #1 in Garrisons" on the end card; on error show a quiet "Couldn't post score" and keep the local record.
3. **Leaderboard modal:** a *Global / Mine / This browser* toggle. Global and Mine call the GET endpoints and render into the same table; seeds stay clickable. Offline or signed out → the toggle is greyed with the reason.
4. **Retry queue:** unsent records are kept in localStorage and retried on the next match end or next page load.
5. Nothing else. No account UI inside the game; profile and registration live on the site.

The signing key is a constant in the game file; the plugin's key must match. Until the plugin exists, the game can be developed against a mock: a `mock-wp.js` that defines `STATEFALL_WP` and stubs `fetch` for the three endpoints with the fixture from §14.

---

## 20. Release packages and how-to pages

Every game update from the game session arrives as **`statefall-release-<date>.zip`** containing `index.html`, a `howto/` folder (one HTML page per How-to-play tab, generated from the game's own unit tables so they can't drift), and `VERSION.txt`. Install it under **Statefall → Game package** in the dashboard — that single upload replaces the game and the how-to pages together. A bare `index.html` still works if you ever need it.

How-to pages on the site: create `/how-to-play/` with `[statefall_howto]` (a tab switcher, `?tab=ships` etc.), or use `[statefall_howto tab="garrisons"]` to embed one tab anywhere. The pages carry their own styling and the real unit icons and ship sprites as embedded images.

The game is no longer required to be one file: anything else in the package (js, css, images, audio) is served at `/play/<path>` with cache-busting by version.

## 21. Sequencing to deploy

1. **Now, in parallel:** website pages with fixtures · plugin endpoints + table + score · game sign-in/submit against the mock.
2. **Integration on staging** (`thatcompanystg`-style staging is fine): install plugin, upload game via the admin page, set `STATEFALL_SIGN_KEY`, create the four pages, enable registration, play one match end-to-end, confirm the row appears on `/leaderboard/` and `/profile/`.
3. **Checks before production:** nonce refresh (a player who leaves the tab open for hours must still be able to post — the game should re-fetch `/me` and, on `403`, reload the page's nonce by fetching `/play/` headers or simply prompting a refresh); rate limit tested; a forged POST without `sig` rejected; mobile layout of the board page; the game file cached with a version query so updates bust the cache.
4. **Deploy** to production: same steps, key rotated to a production value.

**Open decisions for you** (defaults in brackets): registration open to all or invite-only [open]; display name shown on the board = WP display name [yes]; whether Abandoned matches count toward "matches played" on profiles [no]; whether to show a player's country flag from their most-played nation on the board [yes, later].


---

# Part C — Checklist for the designer

- [ ] Read Part A §1–§2 for voice and the core loop; §10 for spellings; §11 for page structure and the screenshot shot list.
- [ ] Build the pages in Part B §17 against the JSON fixtures in §14 — the plugin's shortcodes will replace the fixtures without layout changes.
- [ ] Use the palette and the logo from Part B §17 (theme notes); the logo SVG is at the top of `index.html`.
- [ ] Keep `/play/` chrome-free and full-viewport; the game needs the whole window.
- [ ] Put the seed link format (`/play/?seed=XXXX`) on every board row.
- [ ] Hand the page slugs (`/play/`, `/leaderboard/`, `/profile/`, `/how-to-play/`, login) back to the plugin build so the rewrite and redirects match.
- [ ] Add a `/how-to-play/` page with `[statefall_howto]` and link it from the header next to Play and Leaderboard.
