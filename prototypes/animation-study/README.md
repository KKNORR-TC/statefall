# Small motions — local animation study

Run from the repository root: `npx vite --config prototypes/animation-study/vite.config.cjs`
Open http://127.0.0.1:4182/prototypes/animation-study/ .

Eight existing actors: Factory, Radar station, Coastal battery, Shield generator, Destroyer, Radar ship, Stealth fighter and Repair truck. Uses the actual classic artwork renderer. No new images, simulation changes or production assets were introduced.

Static unit artwork is cached once; bounded procedural effects use presentation time. Controls: pause/resume, staged actions, still-art comparison, intensity and three viewing scales. Reduced-motion preference starts paused. Effects are illustrative review proposals, not connected to game events. Moving mechanical components are deferred.

Focused Chromium check passed: eight populated previews, action/pause/comparison/scale controls and no page errors. Screenshot visually inspected and attachment positions adjusted. Local draw cost is informational, not a game performance qualification. Full suite and release packaging are not applicable to this isolated review scene.

Review revision: fighter flash and engine shimmer replaced with softly varying red port / green starboard wingtip navigation lights. Preview actions no longer flashes the fighter.

## Expanded roster — study 02

40 previews: 20 buildings drawn from STRUCT, eight combat ships drawn from SHIPS, eight existing support/transport/aircraft variants, and four upgrades drawn from UPGRADE. Category filters and per-card action controls are included. Offscreen and filtered cards do not render; sprite artwork remains cached. Aircraft retain red/green wingtip lights with per-artwork attachment points, without a fighter weapon flash.

Focused browser verification: all 40 artworks loaded, expected category counts (20/16/4), every action control, comparison, pause and scale; no page errors. Units and upgrade screenshots inspected; aircraft attachment points adjusted. All motion is still a staged proposal, not connected to simulation or deployed gameplay. No new images or full release qualification.

Gun-effect critique revision: replaced shared flash coordinates with individually inspected muzzle anchors and firing angles for Coastal battery, Shore guns, Big Bertha, Scout boat, Destroyer, Battleship, Heavy transport and Port II. Multi-barrel volleys are staggered. Smoke originates at the same muzzle anchor. Eight revised action previews passed browser checks; captured muzzle frames were visually reviewed. Anchors apply to the fixed artwork orientation in this study; gameplay integration must supply heading-specific anchors.

Visibility revisions: bastions now show defensive perimeter pulses and staggered corner lights; airfields show brighter staged departure lights on the apron, with a stronger level-II shield response. Focused browser action checks passed for all five variants.

## Gameplay integration — 1.10.54

Ken approved this study for integration and game-ZIP preparation. The study now imports the same procedural painter as gameplay. The historical staged-only notes above describe earlier revisions. Gameplay uses existing action state and visibility, pause and reduced-motion guards; the scene retains manual action controls for comparison. No live installation occurred. See docs/release-record-1.10.54.md for focused checks and limitations.
