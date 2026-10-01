# Revision 5: completion materials

Factory alone uses an engine start. Other completion cues must avoid motor spin-up: use material/equipment signatures such as hand ratchet, chain, shutter, pressure seal, contactor and radio receiver. The user found revision 4 too similar despite the nominal building labels. Use name-hidden listening comparisons to judge separation, especially command and sensor types. Existing capture, hammering-start and subdued machine-gun directions remain in effect.

# Revision 4: capture and construction refinements

Neutral and enemy territory captures have separate brief recorded bugle signatures, with the same completed-territory and score-ducking rules. Neutral is restrained; enemy is more emphatic. Elimination still uses Taps.

Construction start: short recorded hammering, never a chime. Completion: choose by actual structure type; all 20 current types are represented in the audition manifest. Instant builds emit only their specific completion. Suppress hidden and unrelated bot construction, and avoid overlapping a large burst of completions. Preserve identity when queueing/coalescing: do not replace different buildings with one generic completion sound. Name-hidden listening checks should guide revisions, especially command/sensor families.

These rules supersede the earlier shared capture cue and generic completion descriptions below.

# Revision 3: authoritative audio direction

- Celebrate only **completed territory acquisition** by the player: neutral and enemy-held territories use the fanfare. Never trigger from a tile ownership update or progress tick.
- Enemy elimination means the enemy has been removed from the game. Play a short recorded Taps phrase once per elimination; it replaces any capture fanfare for the same result.
- Deduplicate completed capture events by territory and capture operation, and elimination by enemy and match. Do not rely on a time cooldown to define completion. If several completions happen together, coalesce fanfares and prioritize elimination.
- These milestones duck the currently playing hosted score and restore its current user volume smoothly afterward. Preserve mute, pause, track changes and user adjustments. The audition demonstrates this with a separate music gain bus; live-player integration remains pending.
- Machine guns are almost ambient: live default 12%, down from 65%; arranged battle contribution reduced 80%. Visible bot battles remain more distant. Inactive/hidden fighting stays silent.
- Stalled and failed remain subdued track friction/wind-down, with no arcade cadence. These directions supersede earlier success/ending suggestions below.

# Statefall sound opportunities

Reviewed against the local 1.10.57 source on 29 September 2026. This is a design and integration map, not an implemented change to the game.

Ken's priorities govern this plan: ground attack start, active fighting, stall, success and failure; building placement and completion; missile launches, SAM launches, successful interceptions and nuclear explosions. Active fighting should combine machine guns, squeaking tank tracks and artillery, and fall quiet when attacks stop. Player attacks and bot-on-bot battles must sound different.

## 1. The everyday ground battle

| Moment | Sound direction | Actual mechanic and integration requirement |
|---|---|---|
| Player starts an attack | Short mechanical order acknowledgement, then battle sound fades in | `launchAttack` already emits `attackStarted` and `sound('attack')`. Only acknowledge accepted commands. A rejected command must never start battle audio. |
| Player reinforces an existing attack | Smaller acknowledgement; existing battle continues | `launchAttack` adds troops to an existing owner/target attack and reuses `attack`. Avoid restarting the sound bed each click. |
| Fighting progresses | Independently varied machine-gun bursts, track squeaks/clatter and occasional artillery; intensity follows the actual active front | `stepAttacks` advances the frontier and emits `tileCaptured`. Aggregate activity over a short interval. Do not play a sound for each tile. Tanks are a representation of abstract ground combat, not a new unit or rule. |
| Progress slows / attack stalls | Battle activity thins; one brief restrained cue if a meaningful sustained stall can be established | There is no explicit persistent `stalled` state. If troops cannot afford the next tile cost, the attack is marked dead in that tick. Other temporary non-progress can arise from frontier processing. Do not call every quiet tick a stall. An exhausted attack is an ended attack, not a continuing stalled battle. |
| Attack succeeds | Short positive closure; combat fades out if no other local fighting remains | Whole-nation elimination emits `conquered`/`conquest`; a front can end without eliminating a nation. Need a reasoned outcome event to distinguish objective/local completion from exhaustion. Never equate disappearance with success. |
| Attack fails | Short descending closure, then quiet | Insufficient troops can set `a.dead`; remaining troops can return after an attrition deduction. Failure does not necessarily mean every attacking troop died. Partial gains must be reflected accurately. |
| Attack ends for another reason | Fade the battle; neutral cancellation/withdrawal acknowledgement only when useful | Diplomacy can remove attacks and return troops; owner death and lost frontier also end attacks. These are not automatically failed orders. |
| Player is invaded | Distinct incoming warning plus foreground battle activity | `invasion` provides an entry point, while `invaded` currently fires repeatedly on captured tiles and is throttled in presentation. Group warnings by front and meaningful escalation. |
| No fighting | No combat loops, no distant canned explosions | Stop the relevant battle layers after a short fade. Existing selected music can continue. Environmental sound, if retained, should be subtle and separately controlled. |

Implementation should introduce explicit copied presentation events for attack lifecycle/outcome where required. A stable presentation identity must distinguish simultaneous and reinforced fronts without altering canonical simulation state or consuming simulation randomness. Reuse authoritative outcomes rather than trying to infer them from the player's total territory. Sound does not determine whether an attack succeeds.

## 2. Who is fighting changes the mix

| Perspective | Treatment | Information rule |
|---|---|---|
| Player initiates | Clear acknowledgement, near weapons/tracks, readable progress; one local outcome cue | Foreground the selected or visible active front. A relevant offscreen status cue can remain, but positional sound must not expose hidden enemy positions. |
| Bot attacks player | Distinct warning and foreground combat, with priority over unrelated fighting | Warn for known threats to the player. Deduplicate overlapping tile losses and invasion notices. |
| Bot fights bot | Lower gain, reduced high frequencies, sparse distant bursts; no personal order, stalled or success cue | Only audible in player-visible space. A global match announcement explicitly intended by the game is a separate category. |
| Multiple battles | A small capped number of audible fronts; foreground player involvement and selected/nearby fronts | Do not run a full loud mix for every attack on the map. Raise density modestly, not volume without limit. |

The audition's bot perspective uses the same recorded ingredients at a lower level with a distance filter. It is a listening demonstration, not a claim that visibility filtering is implemented in the game. Final integration needs both fog visibility and submarine visibility checks; current `onScreen` audio checks alone are not enough.

## 3. Construction — as important as combat

| Moment | Current behavior | Proposed cue |
|---|---|---|
| Accepted building placement | `city` for a city, otherwise `build` | Compact placement/assembly sound. Vary repeated placements subtly. |
| Timed building completed | Reuses `build` | Separate positive completion click/latch. Group several completions in a short window. |
| Instant building | Cities and bastions have zero base build time; instant-build setting affects other structures, with a shield exception | One combined placement/completion cue; no double sound. |
| Upgrade started / finished | `build` / `unified` | Related mechanical start and a distinct completion cue. |
| Cancel construction | Uses `error` despite being a valid user action | Neutral cancel/refund cue; keep error for rejected orders. |
| Unaffordable or invalid placement | Some paths call `fail`, other rejection paths simply return false | Consistent quiet rejected-command feedback only when the player actually issued an order; avoid hover spam. |
| Under construction | Timers advance silently | Optional short machinery texture when selected/close, not a permanent loop on every building. |

## 4. Missile and defense sequence

| Moment | Current hook | Proposed behavior |
|---|---|---|
| Strategic missile launches | `missile`, `missile_in`, `missile_other` share one sound recipe | Substantial ignition and rocket roar. Add a separate threat warning for an incoming known missile aimed at the player. The launch coordinates need not be disclosed. |
| Incoming nuclear threat | `missile_in` at launch; `nuclearAlert` after impact | The present siren is called by the post-impact event. Move the warning meaning to launch/detection; do not add a second belated incoming alarm after detonation. |
| SAM launches | `interceptor`, currently without coordinates | Short, fast rocket snap distinct from strategic launch. Carry copied launch location, owner and visibility context for correct mixing. |
| SAM successfully intercepts | `intercept`, currently without coordinates in this path | Brief high airburst/fragment cue. It confirms actual success. A launched interceptor may miss. |
| SAM misses | Visual dud fragment; no success sound | Do not play the successful-intercept cue. An incoming warning can remain relevant until the threat actually ends. |
| Nuclear explosion | `impact` / `impact_other` | Sharp initial detonation, broad weight, long decaying aftermath. Reserve mix headroom; do not flatten everything else into maximum volume. |
| Cruise missile hits | `bomb` | Conventional localized impact, clearly smaller than nuclear. |
| Shield absorbs / collapses | Absorption shares `intercept`; generator loss can use `pushback` | Distinct shield hit and collapse cues, so the player knows whether SAM or shield saved them. No continuous shield hum across the whole map. |

## 5. Further opportunities, after the core set

| Priority | Mechanics | Opportunity |
|---|---|---|
| Next | Shore guns, coastal batteries, Big Bertha, ship guns and bombardment | Different rate/weight signatures. Existing `shoreguns`, `battery`, `bertha`, `shell`, `shellhit` can be replaced, with richer class context where several ships share a cue. |
| Next | Fighters, bombers, troop carriers and spy planes | Aircraft ready, launch, damage/recall, bomb release and loss. Aircraft completion currently logs readiness without a dedicated sound; fighter low HP reuses invasion sound. |
| Next | Transport landings, ship sinking, torpedoes and privateering | Differentiate losing one's transport from sinking an enemy. Privateer capture deserves a short confirmation. Sonar/detection must never reveal an unseen sub. |
| Next | Diplomacy, betrayal, alliance, requests and gold aid | Replace the foghorn shared by diplomacy and boats. Separate incoming request, accepted pact and betrayal. Avoid musical celebration for every small transaction. |
| Later | Engineering trucks, manual repairs, troop command | Short repair-complete cue, important convoy held/route-risk warning, useful reinforcements arriving. These mechanics are largely logged or reuse generic cues. Do not announce every repaired hit point. |
| Later | Fog, radar, jammer, satellite | Short activation/status transitions and satellite expiry if useful. No always-on radar pings or hidden-entity notifications. |
| Later | Conquest, continent unification, nation fallen, victory/defeat | Brief authored milestone cues, lower priority than immediate danger. Avoid stacking conquer + cash + bugle + fanfare over the same event. |

## Mix and integration contract

- Separate player alerts, command feedback, battle effects and music. Give critical threats room with brief controlled ducking; preserve the existing track player's behavior.
- Remove all generated music fallback paths, including menu/loading, empty playlists, credits and saved `builtin` selections. Empty/unavailable track libraries leave music silent while effects work. Replace tonal drone ambience and synthesized musical event phrases as part of the approved audio replacement.
- Drive battle layers from real ongoing attacks; fade on end, pause, visibility/lifecycle changes, game reset and replay seeks. Never restart or duplicate them because a renderer retries a frame.
- Preserve catch-up suppression. Sample selection, mix priorities, throttling and spatialization use presentation state and separate randomness only.
- Audition currently uses one source take per family, with alternate edits. Shipping combat needs several distinct source takes, especially machine guns and artillery, to avoid recognizable repetition.
- Acquire lossless originals for the Freesound HQ-preview inputs before final mastering. Resaving MP3 to 24-bit WAV does not restore lost detail.
- Verify command acceptance, instant construction, concurrent attacks, actual success/failure reasons, interceptor misses, fog boundaries, pause/reset/replay behavior, decode errors, browser audio permissions and dense-scene voice limits. Run the repository's required simulation/replay gates for any added engine events and release gates before a release.

## Source evidence

- [Ground attacks and outcomes](../../game/src/sim/systems/land-combat.mjs): `launchAttack`, `stepAttacks`, survivor return, nation elimination.
- [Building lifecycle](../../game/src/sim/systems/structures.mjs): `placeStructure`, `upgradeStructure`, `finishUpgrades`, `stepBuild`.
- [Cancel and repair commands](../../game/src/sim/command-router.mjs).
- [Missiles, SAM and shields](../../game/src/sim/systems/missiles.mjs): `launchMissile`, `stepInterceptors`, `absorb`, `stepMissiles`.
- [Naval warfare and trade](../../game/src/sim/systems/naval.mjs), [air operations](../../game/src/sim/systems/air.mjs), [logistics](../../game/src/sim/systems/logistics.mjs), [diplomacy](../../game/src/sim/systems/diplomacy.mjs), [fog](../../game/src/sim/systems/fog.mjs), [rules](../../game/src/sim/rules.mjs).
- [Current sound recipes, priority policy, music fallback and presentation dispatch](../../game/src/legacy-game.js): `snd`, `MUS`, `jukeTracks`, `beginCredits`, `nuclearAlert` dispatch and badge audio.
