# Phase G Unit Art Review Register

**Release-specific decision, 28 September 2026:** Ken explicitly approved the current classic units, buildings and upgrade artwork for release 1.10.49, and deferred detailed Phase G animation/state reviews. This supersedes the requirement to finish every register row before this particular release; Phase G itself remains open and rows retain their actual review status. [Approval and reviewed boards](evidence/release-1.10.49/art-approval.json).

Current candidate note (28 September 2026): Ken explicitly requested that the release include the new classic look. Candidate 1.10.48 includes the complete classic roster and level II/III structure artwork. This authorizes inclusion, but is not a recorded row-by-row review; existing statuses remain unchanged. See [current release evidence](release-record-1.10.48.md).

_Reconciled against the shipped roster and rendering categories on 25 September 2026. Ken has approved general Unit Direction 02 for production translation only. That direction approval does not approve any Phase G entity, state, animation, effect, evidence set, or register row. Every row below remains `Pending | Unassigned`; no per-row approvals have been recorded. The complete static-identity translation candidate is documented in `docs/phase-g-all-units-review.md`; it does not change any row status._

## Purpose And Rules

This is the authoritative Phase G unit-by-unit graphics review register. Reconcile it against the shipped roster at the start of Phase G and whenever that roster changes. Add separate rows for new entities or materially distinct render categories; do not treat approval of a related row or the overall illustrated command-map direction as approval.

Each row requires deterministic evidence for every applicable review dimension:

- Normal identity and silhouette.
- Selected, targeted, hovered, or otherwise emphasized state where applicable.
- Damaged, disabled, suppressed, repairing, destroyed, sinking, or crashing state where applicable.
- Building, queued, launching, landing, upgrading, or other transition state where applicable.
- Representative light and dark faction colors and every faction color that creates a readability concern.
- Strategic, mid, and close zoom levels, including overlap with ownership, fog, orders, labels, and combat.
- Characteristic headings, motion, attack/action frames, trails, wakes, recoil, and reduced-motion behavior where applicable.

Allowed status values are `Pending`, `Changes requested`, and `Approved`. Approval requires a named human reviewer and evidence that covers the applicable dimensions. Put evidence paths, review date, requested changes, follow-up result, and any intentional `N/A` state in Notes. A blank reviewer or unresolved note cannot pass the Phase G gate.

General Unit Direction 02 approval is a direction-level decision only. It must never populate a row's Reviewer or change a row from `Pending`. Each row requires its own named human decision after row-specific deterministic evidence. New reconciliation rows must be created as `Pending | Unassigned`.

## Structures

For every structure, review normal, selected/targeted, building, faction-color, and all three zoom states. Also review damage, repair, disabled/suppressed, destruction, upgrade level, shield, firing, or launch states when the structure supports them.

| Game key | Structure | Additional relevant states | Status | Reviewer | Notes |
| --- | --- | --- | --- | --- | --- |
| `city` | City | Capture and destruction | Pending | Unassigned | - |
| `factory` | Factory | Supply-link context, capture, and destruction | Pending | Unassigned | - |
| `port` | Port | Coast placement, level II, guns firing/damaged/repairing, capture, and destruction | Pending | Unassigned | - |
| `sam` | SAM site | Ambient dish sweep/tracking, interceptor launch, reload/cooldown, suppressed/knocked-out, capture, and destruction; static equivalent under reduced motion | Pending | Unassigned | Prototype-translation candidate 01 pending review: `docs/phase-g-radar-sam-review.md`. |
| `silo` | Missile silo | Launch, reload/cooldown, capture, and destruction | Pending | Unassigned | - |
| `fort` | Bastion | Levels I/II/III, suppressed, overrun, and destruction | Pending | Unassigned | Suppression is currently not rendered and must be represented or explicitly reviewed as `N/A`. |
| `command` | Missile command | Command-link activity, capture, and destruction | Pending | Unassigned | - |
| `shield` | Shield generator | Dome active/hit, damaged/repairing, burnout, and destruction | Pending | Unassigned | - |
| `battery` | Coastal battery | Coast placement, aiming/firing/recoil, suppressed, damaged/repairing, and destruction | Pending | Unassigned | - |
| `shore` | Shore guns | Coast placement, aiming/firing/recoil, suppressed, damaged/repairing, and destruction | Pending | Unassigned | - |
| `bertha` | Big Bertha | Aiming/firing/recoil, damaged/repairing, and destruction | Pending | Unassigned | - |
| `airfield` | Airfield | Hangar/launch/landing, level II shield active/hit/down/repairing, capture, and destruction | Pending | Unassigned | - |
| `flightops` | Flight operations | Command-link activity, capture, and destruction | Pending | Unassigned | - |
| `subbase` | Submarine base | Coast placement, launch context, capture, and destruction | Pending | Unassigned | - |
| `engcmd` | Engineering command | Repair-truck dispatch context, capture, and destruction | Pending | Unassigned | - |
| `troopcmd` | Troop command | Logistics-link activity, capture, and destruction | Pending | Unassigned | - |
| `radar` | Radar station | Fog-reveal context, restrained dish/sweep ambient motion with stable tile phase, static reduced-motion state, capture, and destruction | Pending | Unassigned | Prototype-translation candidate 01 pending review: `docs/phase-g-radar-sam-review.md`. |
| `lradar` | Long-range radar | Long-range fog-reveal context, distinct silhouette, restrained dish/sweep ambient motion with stable tile phase, static reduced-motion state, capture, and destruction | Pending | Unassigned | Candidate 01 is a separately reviewable production extrapolation from Unit Direction 02: `docs/phase-g-radar-sam-review.md`. |
| `jammer` | Radar jammer | Active owned jammer range, interference/beacon ambient treatment, static reduced-motion state, capture, and destruction | Pending | Unassigned | - |
| `satellite` | Satellite launch site | Launch/cooldown command feedback, full-map reveal transition, capture, and destruction | Pending | Unassigned | No visible launch vehicle currently exists; review that representation as `N/A` or request one. |

## Ships

For every ship, review normal, selected/targeted, faction-color, headings/motion/wake, damaged, sinking/destroyed, and all three zoom states. Review the listed class-specific actions as well.

| Game key | Ship | Additional relevant states | Status | Reviewer | Notes |
| --- | --- | --- | --- | --- | --- |
| `sub` | Attack sub | Hidden/detected readability, submerged identity, and torpedo launch | Pending | Unassigned | - |
| `hunter` | Hunter sub | Hidden/detected readability, submerged identity, and torpedo launch | Pending | Unassigned | - |
| `rship` | Radar ship | Radar/fog overlay context, radar/sonar sweep ambient motion, stable-ID phase, and static reduced-motion state | Pending | Unassigned | - |
| `privateer` | Privateer | Boarding, captured-merchant escort, and combat context | Pending | Unassigned | - |
| `scout` | Scout boat | Gunfire and hit response | Pending | Unassigned | - |
| `warship` | Destroyer | Gunfire, SAM launch, hit response, and anti-cruiser combat | Pending | Unassigned | - |
| `cruiser` | Missile cruiser | Gunfire, SAM launch, barrage/recoil, and hit response | Pending | Unassigned | - |
| `battleship` | Battleship | Gunfire, SAM launch, barrage, cruise-missile launch/refit, recoil, and hit response | Pending | Unassigned | - |

## Aircraft

For every aircraft, review normal, selected/targeted where exposed, faction-color, headings/motion, launch/landing or return, damaged where supported, destruction/crash, and all three zoom states. The shipped world renderer intentionally hides hangar, refuel, and heal states; record each applicable hidden state as reviewed `N/A` rather than implying that world art exists.

| Game key | Aircraft | Additional relevant states | Status | Reviewer | Notes |
| --- | --- | --- | --- | --- | --- |
| `fighter` | Stealth fighter | Hangar, outbound, patrol, dogfight/AAM, return, low HP, repair, and crash | Pending | Unassigned | - |
| `bomber` | Stealth bomber | Hangar, outbound, bomb run/drop, return/rearm, interception, and crash | Pending | Unassigned | - |
| `carrier` | Stealth troop transport | Hangar, outbound, paradrop, return/rearm, interception with troops aboard, and crash | Pending | Unassigned | - |
| `spy` | Spy plane | Outbound, on-station orbit/range, homebound, SAM/fighter interception, and shot-down flash/removal | Pending | Unassigned | No aircraft-wreck animation currently exists for the spy plane. |

## Transports And Support Craft

Review normal, selected/targeted where exposed, faction-color, headings/motion/wake, damaged where supported, destruction, and all three zoom states, plus each listed action.

| Render category | Entity | Additional relevant states | Status | Reviewer | Notes |
| --- | --- | --- | --- | --- | --- |
| Naval troop transport | Standard troop transport | Loaded movement, landing, return/reinforcement route, weapon impact, and immediate sinking | Pending | Unassigned | - |
| Heavy naval troop transport | Heavy transport | Loaded movement, landing, return/reinforcement route, gunfire, each HP state, and sinking | Pending | Unassigned | - |
| Merchant transport | Merchant ship | Trade route, blockade attack, boarding/capture, privateer escort, and sinking | Pending | Unassigned | - |
| Ground support transport | Repair truck | Dispatch, outbound route, repair work, homebound, captured-ground loss/removal, and overlap with structures/orders | Pending | Unassigned | Captured-ground loss currently has no destruction effect. |

## Projectiles

Review faction/hostility readability, origin and target readability, trajectory/trail, interception or impact, strategic/mid/close zoom, quality tiers, dense combat, and reduced-motion behavior. Selected and building states are not applicable unless a future implementation introduces them; record that decision in the row's evidence.

| Render category | Projectile/effect | Additional relevant states | Status | Reviewer | Notes |
| --- | --- | --- | --- | --- | --- |
| Strategic missile | Silo missile | Launch, arcing flight, SAM interception, shield impact, incoming alert, nuclear blast flash/footprint, and terrain/structure destruction | Pending | Unassigned | No persistent crater actor is currently rendered. |
| Cruise missile | Battleship cruise missile | Launch, low straight flight, SAM interception, shield absorption, area impact, tracer/smoke, suppression, and terrain/structure result | Pending | Unassigned | - |
| Naval barrage projectile | Cruiser/battleship land-barrage rocket | Salvo spacing, arcing flight, trail, and land impact | Pending | Unassigned | - |
| Heavy artillery shell | Big Bertha shell | Launch/recoil context, arc, trail, and structure/land impact | Pending | Unassigned | - |
| Surface gun shell | Ship, shore-gun, coastal-battery, port-gun, and heavy-transport gunfire | Different origin weapons, tracer/trail, hit response, and dense crossfire | Pending | Unassigned | - |
| Torpedo | Submarine torpedo | Launch, foam trail, target tracking, hit, and miss/target-loss behavior | Pending | Unassigned | - |
| Defensive interceptor | SAM-site and ship interceptor | Site/ship launch origin, tracking, hit/miss, and missile interception flash | Pending | Unassigned | - |
| Air-to-air missile | Fighter AAM | Dogfight/interception launch, tracking trail, hit, and dense patrol combat | Pending | Unassigned | - |
| Aircraft bomb | Bomber bomb | Release sequence, fall/readability, shield impact, land impact, and repeated run spacing | Pending | Unassigned | - |

## Cross-Cutting Animation And Effects

| Render category | Effect/state family | Additional relevant states | Status | Reviewer | Notes |
| --- | --- | --- | --- | --- | --- |
| Attack-front pulse | Active land-combat front | Faction color, pulse phase, dense fronts, fog, zoom/quality, and static reduced-motion treatment | Pending | Unassigned | - |
| Supply-route motion | Factory-to-city/port links | Dashed route, moving marker, endpoint visibility, fog, low zoom, stable endpoint phase, and reduced motion | Pending | Unassigned | - |
| Command-link motion | Missile, flight-operations, and troop-logistics links | Three link identities/colors, moving markers, overlap, stable endpoint phase, zoom budget, and reduced motion | Pending | Unassigned | - |
| Structure status overlays | Ranges, domes, pips, build/upgrade/queue/cooldown/repair/suppression marks | Every supported structure/state combination, overlap, fog, faction context, zoom/quality, and reduced motion | Pending | Unassigned | Pending ordering evidence for ambient dish below suppression/cooldown: `docs/phase-g-radar-sam-review.md`. |
| Unit command overlays | Ship selection/destination/ranges and aircraft patrol/orbit ranges | Hover/selection emphasis, order readability, fog, overlap, zoom/quality, and reduced motion | Pending | Unassigned | - |
| SAM network overlay | Hovered SAM-site and SAM-ship network | Friendly/allied colors, active/knocked-out site, strong hovered member, label, dense network, fog, and reduced motion | Pending | Unassigned | - |
| Persistent scorch | Blast and destroyed-structure ground mark | Radius variants, terrain/ownership contrast, lifetime/fade, fog, dense impacts, and quality tiers | Pending | Unassigned | - |
| Capture spark | Tile-capture spark | Faction color, dense fronts, lifetime/fade, fog, zoom/quality, and reduced motion | Pending | Unassigned | - |
| Smoke/puff | Structure, projectile, interception, and wreck smoke | Color/radius/lifetime variants, drift, overlap, fog, quality tiers, and reduced motion | Pending | Unassigned | - |
| Debris/fragment | Interception debris, dud interceptor, and non-bomb fragments | Direction, color, lifetime, ballistic motion, dense combat, quality tiers, and reduced motion | Pending | Unassigned | - |
| Impact tracer | Barrage and cruise-impact line | Origin/target readability, color, fade, dense impacts, fog, zoom/quality, and reduced motion | Pending | Unassigned | - |
| Ship wreck | Sinking ship/transport/merchant | Every hull class, faction color, spin/sink/fade, wake interaction, fog, quality, and reduced motion | Pending | Unassigned | - |
| Aircraft wreck | Fighter, bomber, and troop-transport crash | Faction color, heading, falling/spin/smoke/fade, fog, quality, and reduced motion | Pending | Unassigned | - |
| Dome wreck | Shield-generator and level-II-airfield dome collapse | Radius variants, collapse/fade, underlying structure state, fog, quality, and reduced motion | Pending | Unassigned | - |
| Impact flash | Gun, bomb, missile, interception, shield, capture, and nuclear flash | Color/radius variants, lifetime, dense combat, fog, quality tiers, and reduced motion | Pending | Unassigned | - |
| Floating world text | Cash and combat/economy feedback | Normal/big variants, color, rise/fade, overlap, zoom/quality, and reduced motion | Pending | Unassigned | - |
| Incoming nuclear alert | Launch-to-target warning overlay | Hostile origin/target readability, clipping, target pulse, lifetime/fade, overlap, and reduced motion | Pending | Unassigned | - |

The first Phase G batch contains only `radar`, `lradar` where the shared dish treatment is affected, `sam`, and any directly affected SAM-network/status-overlay rows. Use the structure tile as the stable entity phase key. Evidence must separately cover Canvas fallback, Pixi ownership, strategic/mid/close zoom budgets, quality tiers, normal motion, and a static reduced-motion equivalent. All affected rows remain `Pending | Unassigned` until separately reviewed by a named human. General Unit Direction 02 approval is not row approval.

## Review Entry Template

Use this block in a row's Notes or in a linked review record. Do not prefill approval.

```text
Review date:
Evidence paths:
Normal:
Selected/targeted/hovered:
Damaged/disabled/repairing:
Building/upgrading/launching/landing:
Faction colors checked:
Zoom levels checked (strategic/mid/close):
Motion/action/destruction:
Quality/reduced motion:
Reviewer:
Status: Pending
Notes or requested changes:
Follow-up evidence and result:
```
