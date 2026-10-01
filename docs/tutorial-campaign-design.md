# Statefall tutorial campaign — First Command

Design baseline: deployed game 1.10.62, 1 October 2026 UTC. **Design complete; campaign integration is not shipped.** The companion `prototypes/tutorial-campaign/server.cjs` now runs the real game engine and renderer with a local-only coach. Its opening lesson uses actual camera controls, native menus, placement validation, gold deductions and full simulation construction time. The former schematic preview was replaced after visual review; advanced chapters below remain design work, not playable missions.

## Player promise

“Learn one decision at a time. The battlefield waits while you read.”

Nine short, replayable chapters carry a new commander from recognizing their own country to conducting a combined-arms campaign. The first two chapters teach enough to start a normal match; advanced chapters remain available from the campaign map without forcing a long course before play. Suggested full-course duration is 70–95 minutes across multiple sessions, a design target to validate with new-player testing rather than a measured claim.

Every lesson follows **Look → Try → See the result**. Look freezes simulation time, highlights one target and draws an arrow to it. Try permits the specific task and camera controls. See the result runs the world only when needed, then pauses at the meaningful outcome. Explanations never compete with a moving battle. No timer starts while the player reads, and no construction step waits for completion while time is frozen.

Entry: add **Learn to play** beside Start match, with “Start here · about 10 minutes” on the first chapter. Returning players see **Continue training** and a chapter map. Standard play always remains directly available. Training uses fictional, fixed nations and authored opponents; it never loads another player's custom nation.

## The coach

- A small dark card with a gold step number, a concrete heading, no more than roughly 45 words, an arrow, and one primary action. Detailed stats open a secondary unit card instead of expanding the coach into a manual.
- Labels explicitly say **Paused · Look**, **Paused · Try**, or **Running · Observe**. A footer says why the clock is stopped. The regular compact pause panel and tutorial controls must not overlap.
- One outlined target at a time. An arrow terminates at the target's edge, never at empty space. Lightly shade unrelated interface regions; preserve terrain legibility and never cover the target with the card.
- Persistent secondary actions: Back to explanation, Hint, Retry checkpoint, Field guide, Exit training. Back rereads copy; Retry explicitly restores the checkpoint. A completed step cannot silently undo a construction order.
- During task steps, the primary button reads the actual action (“Zoom out”, “Place a factory”). It is a status/instruction, not a substitute for doing the task. It becomes Continue only after the engine or camera confirms success. “Show me” demonstrates the action, labels it assisted, then offers practice again.
- Misses are gentle and specific: “That is enemy land. Build on the blue outline.” “This port needs a coastal tile.” “This aircraft needs Airfield II.” Do not charge gold for rejected actions.
- Camera movement stays available. If the target is offscreen, replace its arrow with **Show target**. Recenter only on an explicit request or a new mission, never fight a player's drag gesture.
- Desktop input copy uses the existing wheel/drag/right-click controls. Touch lessons require a supported in-game touch equivalent before being advertised; the prototype's camera buttons are design affordances, not a claim that production already has them.

## Opening chapter: the command table

Safe authored island; no hostile actions. Start paused at a close camera scale with blue homeland, a neutral neighbor and a clearly marked harbor. Suggested resources: 600 troops, 700 gold, ordinary rules. Show only the current lesson's essential widgets; reveal the rest as they are introduced. Hidden widgets stay in the engine normally and do not change game rules.

| Step | Arrow / target | Player-facing explanation | Required action and success |
|---|---|---|---|
| 01 Welcome | Homeland flag | “This blue country is yours. We have stopped the clock so you can get your bearings.” | Continue; identify homeland by label as well as color. |
| 02 Clock and pause | Clock, then Pause | “The clock tracks battle time. Pausing stops troops, income and weapons. You can still look around.” | Resume a safe 2-second window, then press Space or Pause; actual ticks must stop. |
| 03 Zoom out | Map center | “Scroll down over the map to see the whole island. A wider view helps you plan.” | Camera scale decreases at least 25% from the step baseline. Do not accept scrolling the sidebar. |
| 04 Pan | Harbor world anchor | “Drag the map until the harbor marker is inside the center ring.” | Camera center changes and harbor enters the target region, with tolerance for viewport size. |
| 05 Zoom in and inspect | Neutral neighbor | “Zoom in on this neighbor. Its label and troop strength help you judge an attack.” | Scale increases and target is onscreen; hover, focus or open accessible inspection. |
| 06 Troops and cap | Troops readout/bar | “Troops fight and defend your land. The second number is your capacity. Growth slows as your army fills it.” | Pick the current army value in a simple two-option check; wrong answer explains in place. |
| 07 Gold and income | Gold, then Income | “Gold pays for buildings and units. Income shows what you gain each second while the battle runs.” | Identify current gold versus gold per second. No need to memorize numbers. |
| 08 Economy | Economy slider | “This divides growth between troops and gold. Move toward gold to fund construction; keep troops growing when danger is near.” | Set gold share to at least 65%; compare displayed rates, then return to 50/50. |
| 09 Attack share | Send into attack | “This is the share of available troops sent by your next order. The rest stay to defend.” | Set 30–40%; show calculated send/reserve from current troop source. |
| 10 Land and victory | Land held, then 72% objective | “In a normal match, holding 72% of the land wins. These training missions use smaller goals.” | Continue; distinguish mission progress from match victory. |
| 11 Neighbors and news | Ranking, Diplomacy, event log in three separate cards | “These show the leaders, your agreements, and what just happened. You do not need to read every line during a fight.” | Open one nation inspection and read one authored event. No live diplomacy sent. |
| 12 Help, sound and saves | Help, sound, save in three short cards | “Help pauses the battle while you read. Sound can be adjusted separately. Training checkpoints are kept separately from ordinary matches.” | Open/close Help; discover sound controls without changing volume; show checkpoint confirmation. Explain account saves versus browser progress. |
| 13 Ready | Mission objective | “You can now read the map and stop time. Next, turn your gold into a working economy.” | Continue to chapter 2 or return to chapter map. |

No tactical test depends on remembering an icon without its label. Keep mouse and keyboard instructions contextual; teach Escape cancellation during construction, not in the initial welcome.

## Chapter sequence

Each chapter begins with its own deterministic checkpoint. Budgets below are authored training budgets, not balance changes. Scenario authors must verify costs against shared rules and leave a 25% recovery margin. Long advanced builds start from transparent partially completed fixtures or a visible “Advance training to completion” action that actually advances deterministic ticks; never pretend a three-minute building normally finishes instantly.

### 1. The command table · 5–7 minutes

The opening sequence above. Success: pan, zoom both ways, inspect, pause/resume, adjust both sliders and read resources. No combat loss state. “Try again” restores only the relevant camera/UI exercise; no world reset needed.

### 2. A foothold · 7–9 minutes

Fixture: safe island, 700 gold, 600 troops, two weak neutral neighbors. Introduce **City, Factory, Bastion** and abstract land troops.

1. Pause and right-click the marked owned land. Arrow points first to the context menu, then City with its live price. Read the role; buy a city and observe the immediate troop/cap change.
2. Open construction again; choose Factory. Inspect the placement preview, valid/invalid tiles, spacing and displayed supply connections. Move to a valid marked site near the city; click once to commit. Gold deduction must match the actual quote.
3. Arrow points to the construction marker. Explain that purchased does not mean operational. Resume for construction; pause when this factory completes. Show the new income and supply line. The 15-second base time remains true.
4. Demonstrate cancel placement with Escape before spending. Explain cancelling an already-started build separately, including the actual refund shown by the engine (currently 50%).
5. Set a conservative attack share, inspect the neutral, left-click its land and observe commitment, moving frontier and reserve. Pause after the capture; explain that a large country can still have low troop density.
6. Build a bastion at the choke. Show its range, rising cost for additional bastions, and that protection is not an extra troop pool. Survive one small scripted attack.

Success: city exists, factory operational and linked, neutral captured, bastion covers the marked approach. Recovery: checkpoint before attack; offer a reserve reminder or one-click retry after a loss. Finish with an unguided second factory placement. This is the first “Ready for a normal match” exit.

### 3. Across the water · 8–10 minutes

Fixture: sheltered coastal homeland, friendly trade partner and a small hostile landing island; 2,000 gold, 1,200 troops. Introduce **Port, Merchant, Scout boat, Destroyer, Troop transport, Shore guns, Coastal battery, Port II, Heavy transport**.

Build port on valid coast → watch trade arrival and gold → buy scout at the completed port → select it and right-click a waypoint → buy destroyer and select both ships with Shift-drag → compare ordinary troop transport against shore-gun range → clear/avoid defended landing → send troops overseas through foreign-land menu. Explicitly say ordinary transports are created by troop orders and require no port. They are not bought from a ship list.

Pause before the crossing to contrast short-range rapid shore guns with long-range heavy coastal batteries. Upgrade the port and repeat a small crossing using a heavy transport; explain extra durability, slower speed and continued vulnerability. Upgrade/repeat drills use separate checkpoint budgets so the player need not wait for trade to finance the entire lesson.

Success: actual merchant delivery, scout arrival, escorted landing and observed heavy-transport spawn. Failure: lost troop transport gives a brief frozen explanation and restores the crossing checkpoint, never demands rebuilding the economy.

### 4. A fleet with a purpose · 9–12 minutes

Fixture: completed Port II, staged enemy cruiser, merchant route, submarine lane and defended coast; 4,500 gold in independent drills. Introduce **Missile cruiser, Battleship, Submarine base, Attack sub, Hunter sub, Privateer**, plus cruise refit.

Use a destroyer to approach a cruiser and read the counter relationship → place friendly cruiser behind escort and watch coastal suppression → bring a slow battleship forward before the invasion → refit it near Port II and observe its longer-range cruise barrage → build submarine base inside the visible prerequisite radius → buy attack sub and ambush an unescorted transport → buy hunter and detect a hostile sub → pair hunter with surface escort because it cannot attack surface ships → board a non-allied merchant with privateer and escort the captured cargo home. Before piracy, explicitly explain that it starts hostilities; this is a training opponent.

Success is the matching combat/delivery event, not merely purchasing the hull. Every drill has a reset snapshot; actor survival is not required across unrelated lessons. Checkpoint timing must make stochastic weapon outcomes teach the role without asserting a guaranteed single-shot hit.

### 5. Own the sky · 8–11 minutes

Fixture: clear visibility, rear base, training bomber lane, defended enemy strip and inland landing zone; 4,500 gold across checkpoints. Introduce **Airfield, Stealth fighter, Stealth bomber, Airfield II, Stealth troop transport, Flight operations**.

Build airfield → point to four hangar slots → buy fighter → select patrol over protected assets → observe interception → recall damaged fighter through Air panel → buy bomber → select run against exposed ground after clearing fighter coverage → pause on suppression → upgrade airfield to II and inspect six slots/light dome → purchase air transport and make an inland drop from the correct troop source → build Flight operations → watch automation keeping reserve and assigning a patrol → toggle automation off and take manual control.

Explain counters accurately: stealth fighter/bomber/troop aircraft ignore SAMs; hostile fighters matter, and shields stop bomber attacks. Spy planes follow a different detection/interception rule and arrive in the next chapter. Losing an airfield loses its aircraft. A failed paradrop restores only that drill.

### 6. Seeing through the fog · 8–10 minutes

Fixture: Fog of war enabled, staged hidden force and jammer, prebuilt airfield/port; 4,000 gold across checkpoints. Introduce **Radar station, Long-range radar, Radar ship, Radar jammer, Spy plane, Satellite launch site**.

Inspect hidden/known information → build radar and compare reveal before/after → place long-range radar safely behind front → send escorted radar ship to coastal blind spot → view enemy radar coverage affected by your jammer → move a scout into direct sight to show why jamming is not invisibility → launch spy plane and watch temporary reveal → launch satellite immediately before a prepared strike → wait/advance to reveal expiry and compare map knowledge.

Success: reveal source and expiry are observed, not just an animation playing. Explain that a satellite scan costs additional gold, has a cooldown and does not permanently reveal the map. Radar ship remains unarmed; spy plane can be intercepted under its own rules. Unknown troop values must stay unknown in coach text.

### 7. Break the strongpoint · 10–13 minutes

Fixture: safe firing range with resettable defensive targets and connected repair road; 6,500 gold across independent drills. Introduce **SAM site, Shield generator, Missile silo, Missile command, Big Bertha, Engineering command, Repair truck, Bastion II and III**.

Place overlapping SAM coverage → observe one intercepted hostile missile without claiming 100% SAM accuracy → inspect shield dome and lost hit points → repair manually → build engineering command and follow a truck over connected friendly land → demonstrate unreachable island repairs → build silo and launch at the marked training target → contrast interception, shield absorption and successful impact → use Bertha's automatic shelling against an in-range building → pause on suppression before land attack → build missile command near silos and inspect automatic firing/reserve controls → disable auto-fire for a manual launch → upgrade bastion II then III, compare radius and show shelling removing protection temporarily.

Success: interception, absorption, repair-pip increase, actual launch, suppression and upgrade states observed. The tutorial never asks the player to attack a shield repeatedly without explaining the cost and alternative. Units awaiting multi-minute construction use a clearly labeled prepared checkpoint or deterministic fast-forward with no hidden timer changes.

### 8. Keep the front supplied · 7–10 minutes

Fixture: Garrisons enabled, strong mainland plus thin isolated beachhead, completed Port II and Airfield II; 2,500 gold and explicit local troop pools. Introduce **Troop command** and revisit transports, city, airlift, diplomacy and aid.

Select each area and compare local strength → issue reinforcement from the correct origin → observe troops aboard the transport rather than appearing instantly across water → build a city on beachhead and observe local reinforcement → build troop command and enable logistics → observe transfer to thin area and retained home reserve → interrupt a route, explain the loss and retry with escort → compare airlift alternative → view a fixed scripted pact/alliance offer → choose aid amount and see both sender and recipient changes → explain duration, betrayal and that the normal match's diplomacy is not a guaranteed scripted response.

Success: beachhead reinforced, a logistics delivery completed and local source correctly identified. Troop command's growth benefit also works outside Garrisons; automated area logistics is the mode-specific part. Finish with a reserve quiz and an optional practice where the coach speaks only when requested.

### 9. First command · 10–13 minutes

Authored compact map with learned systems and deliberately limited opposition. No new units. Use a default non-fog, non-Garrisons scenario for the main capstone, with optional fog/garrison variants after completion. The ordinary 72% land victory condition remains intact. Player chooses an economy, defended coast and combined-arms route; there is no single forced purchase order.

Guidance fades: persistent objective and Hint only; pause automatically for the first major unfamiliar event, then ask whether reminders should continue. Completion requires normal engine victory and valid tutorial classification. Debrief shows three concrete decisions (for example an escorted crossing, repaired defense and retained reserve), links weak topics to their drill, and offers **Start a normal match** with standard settings. Do not silently carry training money, restricted units or assisted speed into that match.

## Every-unit lesson contract

Each row gets an illustrated “role / buy or spawn / useful against / vulnerable to” card, a practical action, and an observed result. Prices, timings, range and prerequisites come from `sim/rules.mjs` and `helpRoster()`; do not duplicate balance constants in the campaign scripts. The listed chapter owns the first explanation, while later missions reinforce it. Forty keys exactly match the current field guide.

| Unit key | Explanation and practical task | First chapter |
|---|---|---|
| city | Immediate troops plus capacity/growth; build and inspect troop change. Protect from conquest. | 2 |
| factory | Gold engine enhanced by supply links; place by city, wait for completion, compare income. | 2 |
| fort | Bastion makes invasion costly in its radius; defend a choke. Shelling suppresses protection; extra forts cost more. | 2 |
| port | Coastal trade and shipyard; build on coast and open completed port's purchase menu. | 3 |
| merchant | Automatically trades with nonhostile ports; observe delivery. Protect against piracy. | 3 |
| scout | Fast, fragile armed picket; reach a waypoint and scout a coast; avoid heavy guns. | 3 |
| warship | Destroyer escorts and counters cruisers; screen a transport, avoid heavy batteries. | 3 |
| transport | Ordinary troop-order vessel, no port needed; escort a landing. One hit sinks it and its troops. | 3 |
| shore | Rapid close coastal defense; stop light landing traffic, inspect short reach. | 3 |
| battery | Heavy long-range coastal gun; cover an approach. Bombardment suppresses it. | 3 |
| port-level2 | Upgrade a finished port; inspect guns and heavy-transport/sub-base unlocks. Repair damaged guns. | 3 |
| heavytransport | Automatically replaces eligible troop transports; repeat crossing. Tougher but slower, still needs escort. | 3 |
| cruiser | Missile cruiser bombards coastal defenses; hold behind destroyer. Enemy destroyers punish close combat. | 4 |
| battleship | Slow fleet anchor with heavy firepower; order early, then refit near Port II for cruise range. | 4 |
| subbase | Coastal submarine yard requiring nearby Port II; build inside prerequisite radius. | 4 |
| sub | Hidden torpedo ambusher; strike transport route. Detection escorts and hunters counter it. | 4 |
| hunter | Detects and fights submarines only; uncover hostile sub, pair with surface escort. | 4 |
| privateer | Boards non-allied merchants for double cargo; deliver captured merchant. Starts hostilities, needs protection. | 4 |
| airfield | Four-aircraft base; build and buy. Losing it loses its aircraft. | 5 |
| fighter | Stealth patrol/interceptor; defend bomber route and recall damage. Other fighters are the counter. | 5 |
| bomber | Stealth strip bombardment; hit exposed defenses. Fighters and shields counter it, SAMs do not. | 5 |
| airfield-level2 | Six slots, light dome and airlift unlock; upgrade and inspect all three. | 5 |
| carrier | Stealth troop transport, not a naval carrier; paradrop inland from Airfield II. Fighters can destroy loaded troops. | 5 |
| flightops | Automatically purchases and manages aircraft while retaining reserve; observe then take manual control. | 5 |
| radar | Local fog reveal; build near frontier and compare visibility. Jammers counter radar sources. | 6 |
| lradar | Broad fog reveal from behind the front; cover a distant approach, show limits. | 6 |
| rship | Unarmed mobile radar; reveal approach behind escort, withdraw from hostile ships. | 6 |
| jammer | Disrupts nearby enemy radar sources; contrast jammed radar with direct sight. Not universal invisibility. | 6 |
| spy | Temporary airfield reconnaissance; launch and inspect expiry. Fighters and limited SAM shots can intercept it. | 6 |
| satellite | Launch-site scan reveals map temporarily for an additional cost; prepare, scan, act before expiry. | 6 |
| sam | High-probability missile interception; cover valuable assets. Reload gaps and bombardment matter. | 7 |
| shield | Dome absorbs missiles aimed inside, consuming hit points; observe hit then repair. Can be exhausted. | 7 |
| silo | Builds and launches paid missiles with reload; choose target after checking defenses. | 7 |
| command | Automates nearby silos; observe reserve/target choice and disable when manual timing matters. | 7 |
| bertha | Long-range automatic artillery against buildings; observe suppression, exploit with ground troops. | 7 |
| engcmd | Dispatches repair trucks over connected land with gold reserve; support defensive cluster. | 7 |
| truck | Automatic repair actor, not a purchase; follow it, observe gold/pip change and unreachable island case. | 7 |
| fort-level2 | Extends bastion coverage; compare before/after on marked border. | 7 |
| fort-level3 | Widest upgraded coverage; observe persistent vulnerability to shelling. | 7 |
| troopcmd | Boosts growth; in Garrisons automates reinforcement of thin areas. Observe delivered troops and reserve. | 8 |

Additional weapon vocabulary: nuclear missile (silo order), cruise missile (battleship refit), cruiser/battleship barrage (automatic), torpedo (sub combat), SAM interceptor (automatic defense), bomber strip, artillery shell. These are not extra buildable roster entries. Land troops are represented by national/local pools and fronts, not purchasable tank or infantry units.

## Implementation contract

Suggested modules are future integration work, not files claimed to exist:

- `tutorial/catalog.mjs`: versioned chapters/steps, text, target IDs, allowed interactions, completion predicates, hint/retry links and roster keys.
- `tutorial/controller.mjs`: lesson state machine, pause ownership, progress and deterministic checkpoint lifecycle. No direct renderer mutation of simulation state.
- `tutorial/anchors.mjs`: existing DOM anchors (`#pauseBtn`, `#troops`, `#gold`, `#income`, `#land`, `#focus`, `#ratio`, `#board`, `#log`, `#airPanel`, `#logRow`) and world anchors resolved from current actor IDs through the renderer's camera projection. Add stable semantic IDs to dynamic construction choices.
- `tutorial/coach.mjs` and styles: dialog/status card, focus outline, SVG arrow, collision-aware placement and screen-reader equivalent.
- `tutorial/scenarios/`: validated, versioned deterministic fixtures using supported setup/checkpoint APIs. Scenario scripts issue ordinary validated commands; actor creation is authored setup, not ad hoc runtime globals.

Step shape: `{id, phase, target, copy, permittedActions, completion, checkpoint, hints, rosterKeys}`. Observe simulation outcomes from engine events/queries, not DOM text scraping. Accept a build only when the intended player's correct structure exists at a valid location; accept purchase only when that player's queue/actor changes; accept delivery only on successful arrival. Camera predicates use relative scale/viewport distances. Predicates are latched once, idempotent and safe on reload; retries restore initial predicate state.

Pause ownership must support manual, Help, restart confirmation and coach separately. Acquiring coach pause cannot overwrite manual pause; releasing one owner never releases another. During a reading card, Space must not secretly resume the world. During the manual-pause exercise, the coach temporarily releases its own lock and explicitly enables the player control. Retry, exit and navigation always dispose coach ownership/listeners. Existing pause behavior must remain unchanged outside training.

Tutorials permit specified orders while coach-paused through explicit training capability, without changing ordinary match settings or enabling ranked Paused orders implicitly. Reject unrelated orders with one useful hint; do not swallow camera navigation or accessibility actions. Chapters 2–8 should progressively remove restrictions after a successful guided attempt.

Store `{campaignVersion, scenarioVersion, chapterId, checkpointId, completedSteps, assistedSteps}` in a dedicated browser key. Save only at stable checkpoints with a visible confirmation. Cross-device account progress is a later feature until a separate validated API exists. Incompatible revisions keep completed chapter badges, explain why an in-progress chapter restarts and do not try to restore stale actor IDs. Avoid the ordinary account autosave slot. Refuse tutorial scores server-side as well as client-side; local training replays/progress must not pollute community boards, achievements, custom-nation combat or match statistics.

## Accessibility and layout

Keyboard focus moves to the coach heading on a new explanation, then to the highlighted actionable control on Try. Preserve the previous meaningful focus when closing. Tab order includes coach actions and permitted targets; never trap a user away from Exit. Use `aria-describedby` for target explanation, polite step announcements and a text equivalent for the arrow. Do not repeatedly announce camera coordinates. Add keyboard camera and context-menu equivalents if the integration lacks them; they are a prerequisite to claiming keyboard-complete training.

At 200% zoom or narrow width, use a compact docked coach with the target scrolled into view and an arrow/edge indicator. Recalculate on resize, sidebar scroll, camera movement and content changes. Reserve at least 12 px between card and target, respect safe areas and avoid covering menus. If no collision-free placement exists, show a labeled target description plus explicit Show target instead of a misleading arrow. Reduced motion removes pulsing and animated camera flights. Text and numbered outlines reinforce every color cue. No audio is required to complete a lesson.

## Acceptance and rollout

1. Ship coach shell and chapter 1 locally; verify every arrow at desktop, narrow layout and 200% browser zoom. Playtest with at least three people unfamiliar with the game: can each independently pause, zoom, pan and identify spendable gold? Track observed confusion, not just completion clicks.
2. Add chapter 2 and validate action predicates against wrong owner, wrong tile, cancelled build, insufficient funds, early click, Help open and manual pause. First factory must require a real placement and completion. Test repeated retry, exit and browser reload.
3. Add chapters 3–8 with one authored test per meaningful outcome. Require coverage set equality with all 40 `helpRoster` keys; flag a roster change until a lesson is assigned. Verify no impossible prerequisites, inaccessible anchors or resource dead ends.
4. Add capstone/debrief and classification protection. Confirm tutorials cannot submit regular scores or overwrite ordinary autosaves, including direct API attempts. Ordinary matches, saves and replays must retain deterministic behavior.
5. Run full repository release qualification, exact-ZIP integration and performance checks. Coach/art loads lazily after Learn to play; ordinary startup should not pay for all scenario fixtures. Production release needs current About, guide and a new version; 1.10.62 remains the shipped pause patch.

Design acceptance: every chapter has ordered tasks, outcomes, recovery and prerequisites; every roster entry has a practical lesson; orientation includes paused arrows, zoom-out before panning, zoom-in inspection, interface reading and construction. Implementation acceptance additionally requires fresh-player playtesting and all technical gates above. The companion prototype runs the opening lesson with the actual engine and native construction; it does not implement the later campaign chapters or production training isolation.
