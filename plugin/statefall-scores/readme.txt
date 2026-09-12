=== Statefall Scores ===
Contributors: thatcompany
Tags: game, leaderboard
Requires at least: 6.0
Tested up to: 6.6
Requires PHP: 7.4
Stable tag: 1.10.4
License: GPLv2 or later

Global leaderboard, player profiles and game hosting for Statefall RTS.

== Installation ==
1. Upload the statefall-scores folder to wp-content/plugins/ and activate it.
2. Statefall → Game package: upload the game release package. The game is then served at /play/.
3. Create a page at /leaderboard/ containing [statefall_board] and one at /profile/ containing [statefall_profile].
4. Review the repository's docs/current-status.md before enabling public registration. Keep registration invite-only while release-blocking security findings remain open.
5. Statefall → Settings: read the signing key and give it to whoever builds the game file (STATEFALL_SIGN_KEY in the game). Optionally define STATEFALL_SIGN_KEY in wp-config.php instead.
6. If /play/ returns 404, visit Settings → Permalinks once.

== REST API ==
GET  /wp-json/statefall/v1/me
POST /wp-json/statefall/v1/scores        (logged in, X-WP-Nonce, signed record)
GET  /wp-json/statefall/v1/scores?cls=Standard&limit=50&offset=0   (cls=__all for top 3 of every class)
GET  /wp-json/statefall/v1/scores/mine?cls=
GET  /wp-json/statefall/v1/classes

== Signature ==
HMAC-SHA256 over the canonical JSON of the record — fields in this order, no whitespace:
when, result, country, map, diff, fog, risky, cls, land, minutes, kills, peak, gold, seed
(land and minutes as plain JSON numbers — 76.1, or 76 when whole — fog/risky as true/false, JSON.stringify-style: no spaces, slashes and unicode unescaped). Send as "sig" (hex).

The key is delivered to the browser with the game and therefore does not provide authoritative anti-cheat protection. Treat submitted scores as client-supplied data unless gameplay is independently validated server-side.
