# Phase G Unit Art Review Register

_Future review register initialized 15 September 2026 from the current game roster. All entries are pending; no unit-art approvals have been recorded._

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

## Structures

For every structure, review normal, selected/targeted, building, faction-color, and all three zoom states. Also review damage, repair, disabled/suppressed, destruction, upgrade level, shield, firing, or launch states when the structure supports them.

| Game key | Structure | Additional relevant states | Status | Reviewer | Notes |
| --- | --- | --- | --- | --- | --- |
| `city` | City | Capture and destruction | Pending | Unassigned | - |
| `factory` | Factory | Supply-link context, capture, and destruction | Pending | Unassigned | - |
| `port` | Port | Coast placement, level II, guns firing/damaged/repairing, capture, and destruction | Pending | Unassigned | - |
| `sam` | SAM site | Tracking/firing, suppressed/disabled, damaged/repairing, and destruction | Pending | Unassigned | - |
| `silo` | Missile silo | Launch, reload/cooldown, capture, and destruction | Pending | Unassigned | - |
| `fort` | Bastion | Levels I/II/III, suppressed, overrun, and destruction | Pending | Unassigned | - |
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
| `radar` | Radar station | Fog/radar overlay context, capture, and destruction | Pending | Unassigned | - |
| `lradar` | Long-range radar | Fog/radar overlay context, capture, and destruction | Pending | Unassigned | - |
| `jammer` | Radar jammer | Active jammer/radar overlay context, capture, and destruction | Pending | Unassigned | - |
| `satellite` | Satellite launch site | Launch/cooldown, capture, and destruction | Pending | Unassigned | - |

## Ships

For every ship, review normal, selected/targeted, faction-color, headings/motion/wake, damaged, sinking/destroyed, and all three zoom states. Review the listed class-specific actions as well.

| Game key | Ship | Additional relevant states | Status | Reviewer | Notes |
| --- | --- | --- | --- | --- | --- |
| `sub` | Attack sub | Hidden/detected readability, submerged identity, and torpedo launch | Pending | Unassigned | - |
| `hunter` | Hunter sub | Hidden/detected readability, submerged identity, and torpedo launch | Pending | Unassigned | - |
| `rship` | Radar ship | Radar/fog overlay context | Pending | Unassigned | - |
| `privateer` | Privateer | Boarding, captured-merchant escort, and combat context | Pending | Unassigned | - |
| `scout` | Scout boat | Gunfire and hit response | Pending | Unassigned | - |
| `warship` | Destroyer | Gunfire, SAM launch, hit response, and anti-cruiser combat | Pending | Unassigned | - |
| `cruiser` | Missile cruiser | Gunfire, SAM launch, barrage/recoil, and hit response | Pending | Unassigned | - |
| `battleship` | Battleship | Gunfire, SAM launch, barrage, cruise-missile launch/refit, recoil, and hit response | Pending | Unassigned | - |

## Aircraft

For every aircraft, review normal, selected/targeted where exposed, faction-color, headings/motion, launch/landing or return, damaged where supported, destruction/crash, and all three zoom states.

| Game key | Aircraft | Additional relevant states | Status | Reviewer | Notes |
| --- | --- | --- | --- | --- | --- |
| `fighter` | Stealth fighter | Hangar, outbound, patrol, dogfight/AAM, return, low HP, repair, and crash | Pending | Unassigned | - |
| `bomber` | Stealth bomber | Hangar, outbound, bomb run/drop, return/rearm, interception, and crash | Pending | Unassigned | - |
| `carrier` | Stealth troop transport | Hangar, outbound, paradrop, return/rearm, interception with troops aboard, and crash | Pending | Unassigned | - |
| `spy` | Spy plane | Outbound, on-station orbit, return, SAM/fighter interception, and crash | Pending | Unassigned | - |

## Transports And Support Craft

Review normal, selected/targeted where exposed, faction-color, headings/motion/wake, damaged where supported, destruction, and all three zoom states, plus each listed action.

| Render category | Entity | Additional relevant states | Status | Reviewer | Notes |
| --- | --- | --- | --- | --- | --- |
| Naval troop transport | Standard troop transport | Loaded movement, landing, return/reinforcement route, hit, and sinking | Pending | Unassigned | - |
| Heavy naval troop transport | Heavy transport | Loaded movement, landing, return/reinforcement route, gunfire, each HP state, and sinking | Pending | Unassigned | - |
| Merchant transport | Merchant ship | Trade route, blockade attack, boarding/capture, privateer escort, and sinking | Pending | Unassigned | - |
| Ground support transport | Repair truck | Dispatch, outbound route, repair work, return, and overlap with structures/orders | Pending | Unassigned | - |

## Projectiles

Review faction/hostility readability, origin and target readability, trajectory/trail, interception or impact, strategic/mid/close zoom, quality tiers, dense combat, and reduced-motion behavior. Selected and building states are not applicable unless a future implementation introduces them; record that decision in the row's evidence.

| Render category | Projectile/effect | Additional relevant states | Status | Reviewer | Notes |
| --- | --- | --- | --- | --- | --- |
| Strategic missile | Silo missile | Launch, arcing flight, SAM interception, shield impact, target warning, and crater impact | Pending | Unassigned | - |
| Cruise missile | Battleship cruise missile | Launch, low straight flight, SAM interception, shield impact, and structure impact | Pending | Unassigned | - |
| Naval barrage projectile | Cruiser/battleship land-barrage rocket | Salvo spacing, arcing flight, trail, and land impact | Pending | Unassigned | - |
| Heavy artillery shell | Big Bertha shell | Launch/recoil context, arc, trail, and structure/land impact | Pending | Unassigned | - |
| Surface gun shell | Ship, shore-gun, coastal-battery, port-gun, and heavy-transport gunfire | Different origin weapons, tracer/trail, hit response, and dense crossfire | Pending | Unassigned | - |
| Torpedo | Submarine torpedo | Launch, foam trail, target tracking, hit, and miss/target-loss behavior | Pending | Unassigned | - |
| Defensive interceptor | SAM-site and ship interceptor | Site/ship launch origin, tracking, hit/miss, and missile interception flash | Pending | Unassigned | - |
| Air-to-air missile | Fighter AAM | Dogfight/interception launch, tracking trail, hit, and dense patrol combat | Pending | Unassigned | - |
| Aircraft bomb | Bomber bomb | Release sequence, fall/readability, shield impact, land impact, and repeated run spacing | Pending | Unassigned | - |

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
