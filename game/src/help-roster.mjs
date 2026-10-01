import {STRUCT,BUILD_TICKS,SHIPS,SHIP_BUILD,AIR,FOG,UPGRADE,TRUCK,HEAVY} from './sim/rules.mjs';
import {HELP_ART} from './help-art.mjs';

// Presentation-only advice; costs and timings come from the authoritative rules.
const advice={
 city:'Build early to grow your army, then add factories within supply-line range. In Garrisons mode, a city on a weak beachhead adds its troops to that area immediately.',
 factory:'Place near cities and ports so supply lines improve both your income and the connected buildings. Invest on secure land before buying an expensive fleet.',
 port:'Build on a protected coast near factories. Right-click the finished port to buy ships; keep its trade route clear and upgrade to level II before a major sea invasion.',
 sam:'Cover valuable buildings and likely missile flight paths, with overlapping sites for backup. Use fighters against stealth aircraft; SAMs cannot stop them. Repair your defensive line after bombardment suppresses it.',
 silo:'Build behind your front line and protect it with SAMs or a shield. Right-click enemy land and choose Launch missile here; clear shields and missile defenses before spending on a strike.',
 fort:'Place on narrow borders and around territory you cannot afford to lose. Overlap coverage to make invasion costly, but do not rely on bastions alone: bombardment temporarily cancels their protection.',
 command:'Place within range of your silos to automate targeting. Keep gold available for launches, and use the auto-fire toggle when you want to save your missiles or choose targets yourself.',
 shield:'Center the dome over your most valuable cluster of buildings. Watch its hit points and repair from the right-click menu; repeated attacks can exhaust it. Engineering command can help maintain it.',
 battery:'Put on a coastline overlooking an approach or shipping lane. Its long-range heavy shots deter large ships; pair it with shore guns for close threats and SAMs against bombardment.',
 shore:'Cover likely landing beaches and narrow channels. Use several guns to stop tougher transports, and keep longer-range enemy ships from sitting outside their reach.',
 bertha:'Build close enough to enemy infrastructure to reach it, but behind a defended border. Use its automatic shelling to soften defenses before a land attack; protect the gun during its long construction.',
 airfield:'Place where its aircraft can reach the front while the field stays safe. Right-click it to buy aircraft. Losing the field also loses its aircraft, so cover it with fighters and ground defenses.',
 flightops:'Build after an airfield when you want automatic purchases, patrols and strikes. Leave gold above its reserve and use the Air panel toggle to take control of the air war yourself.',
 subbase:'First upgrade a nearby port to level II, then build this on the coast. Right-click it to buy attack subs for ambushes or hunter subs to protect your sea lanes.',
 engcmd:'Place on the same connected land as shields and coastal defenses you expect to repair. Keep gold available; its trucks cannot cross water to reach an isolated island.',
 troopcmd:'Use for sustained troop growth. With Garrisons enabled, turn on logistics to reinforce thin areas; protect the transports or aircraft carrying those reinforcements.',
 radar:'In Fog of war, place near a frontier to reveal nearby threats before they arrive. Protect it and avoid relying on one station where an enemy jammer can blank it.',
 lradar:'In Fog of war, build safely behind the front for a broad view. Use its coverage to plan attacks, and use scouts or spy planes where jamming leaves a blind spot.',
 jammer:'In Fog of war, place near hostile radar coverage to hide activity from those radar sources. It does not hide troops from direct sight, spy planes or satellites.',
 satellite:'In Fog of war, save a satellite scan for the moments before a major strike or when searching for hidden enemy infrastructure. The reveal is brief, so prepare your orders first.',
 sub:'Ambush transport routes and isolated heavy ships. Stay away from hunter subs and detection escorts; once revealed, withdraw or bring support. Torpedoes leave a visible wake that can betray your position.',
 hunter:'Patrol invasion routes and escort valuable fleets where you suspect submarines. It detects subs farther away than surface escorts, but cannot fight surface ships: pair it with a destroyer.',
 rship:'Move ahead of a fleet to reveal an approach in Fog of war, keeping it behind armed escorts. It has no gun, so pull it back when enemy ships close in.',
 privateer:'Send toward non-allied merchant routes to capture trade and bring double cargo home. Keep an escape route to your port; piracy starts hostilities, so choose the victim deliberately.',
 scout:'Use its speed to check coasts, intercept fragile traffic and provide early warning. Avoid sustained fights with heavier ships or coastal guns.',
 warship:'Escort transports and cruisers, screen nearby submarines and chase enemy missile cruisers. Move ships with right-click orders after selecting them; keep them clear of heavy coastal batteries.',
 cruiser:'Keep behind destroyers and near enemy coasts to bombard defenses before landing troops. Its missile barrage suppresses ground defenses, but enemy destroyers punish it at close range.',
 battleship:'Send early toward a planned assault because it is slow. Use it as a fleet anchor with destroyers and a hunter sub, then refit near a level II port for deeper cruise-missile strikes.',
};
const seconds=t=>t?`${t/10} s`:'instant';
export function helpRoster(tab){
 if(tab==='build')return [...Object.values(STRUCT).map(s=>({key:s.key,name:s.label,stats:`${s.cost} gold · ${seconds(BUILD_TICKS[s.key])}${s.coast?' · coast only':''}${s.fog?' · Fog of war':''}`,description:s.desc.replace(/^\d+ (s|min) to build\. /,''),use:advice[s.key]})),
  {key:'port-level2',name:'Port II',stats:`Upgrade · ${UPGRADE.port.cost} gold · ${seconds(UPGRADE.port.ticks)}`,description:'Adds built-in shore guns, heavy transports and access to nearby submarine bases. Supports battleship cruise-missile refits.',use:'Right-click a completed port to upgrade it before committing troops across water. Repair its gun pips when damaged; losing the guns downgrades the port.'},
  {key:'airfield-level2',name:'Airfield II',stats:`Upgrade · ${UPGRADE.airfield.cost} gold · ${seconds(UPGRADE.airfield.ticks)}`,description:'Six hangar slots, a light shield dome and access to stealth troop transports.',use:'Upgrade a safe airfield when you need more aircraft or an inland landing. Maintain the dome and clear hostile fighter patrols before a paradrop.'},
  {key:'fort-level2',name:'Bastion II',stats:`Upgrade · ${UPGRADE.fort.cost} gold · ${seconds(UPGRADE.fort.ticks)}`,description:'Extends the bastion’s defensive coverage.',use:'Right-click an existing bastion to extend protection along a wider border. Check the range overlay before paying for another nearby fort.'},
  {key:'fort-level3',name:'Bastion III',stats:`Upgrade from II · ${UPGRADE.fort.cost3} gold · ${seconds(UPGRADE.fort.ticks3)}`,description:'The widest bastion coverage, with the same vulnerability to bombardment.',use:'Reserve this upgrade for a critical strongpoint that protects several approaches. Back it with troops and defenses against shelling.'},
  {key:'truck',name:'Repair truck',stats:`Automatic · up to ${TRUCK.max} per engineering command · ${TRUCK.costPip} gold per pip`,description:'Travels over connected friendly land to repair damaged defenses.',use:'Build engineering command to dispatch trucks automatically. Keep a connected route and enough gold; trucks cannot repair a remote island across open water.'}];
 if(tab==='ships')return [...Object.values(SHIPS).map(s=>({key:s.key,name:s.label,stats:`${s.cost} gold · ${seconds(SHIP_BUILD[s.key])} · ${s.hp} hp · ${Math.round(s.speed*10)} tiles/s`,description:`${s.gun?`Gun range ${s.gun}. `:''}${s.sam?`SAM range ${s.sam} (${Math.round(s.samHit*100)}% hit chance). `:''}${s.barrage?`Barrage: ${s.barrage.count} missiles, ${s.barrage.range}-tile range, every ${seconds(s.barrage.cd)}. `:''}${s.key==='sub'?'Hidden unless detected by nearby escorts; hunter subs detect it at 20 tiles. Torpedoes deal 3 damage and reload in 10 s.':s.desc}`,use:advice[s.key]})),
  {key:'transport',name:'Troop transport',stats:'Sent by an overseas troop order · no port required',description:'Carries troops to another coast. An ordinary transport sinks in one hit, losing the troops aboard.',use:'Right-click a country you do not border to send troops by sea. Clear the route and landing beach first, then escort the crossing with warships.'},
  {key:'heavytransport',name:'Heavy transport',stats:`Port II unlock · ${HEAVY.hp} hp · 25% slower`,description:'Replaces ordinary transports once a level II port is available. With Garrisons, the port must serve the departing area. Its short-range gun returns fire but cannot target submarines.',use:'Upgrade before a contested landing, but still escort the crossing. Extra armor helps against light opposition; paired shore guns and submarines remain dangerous.'},
  {key:'merchant',name:'Merchant ship',stats:'Automatic port trade',description:'Sails between ports that are not fighting, earning gold for both sides when it arrives.',use:'Build ports and protect their routes to keep trade flowing. Watch for privateers; disrupting enemy trade can weaken their economy without taking the port.'}];
 if(tab==='air')return [
  {key:'fighter',name:'Stealth fighter',stats:`${AIR.fighter.cost} gold · ${seconds(AIR.fighter.build)} · ${AIR.fighter.hp} hp · range ${AIR.fighter.range}`,description:`Patrols a ${AIR.fighter.patrol}-tile circle, intercepting bombers, troop transports and spy planes. Ignores SAMs; fights other fighters. Returns to refuel after 10 minutes.`,use:'Buy at an airfield and place a patrol over assets or the route your bombers will use. Overlap friendly patrols where combat is likely; recall damaged fighters through the Air panel to repair.'},
  {key:'bomber',name:'Stealth bomber',stats:`${AIR.bomber.cost} gold · ${seconds(AIR.bomber.build)} · range ${AIR.bomber.range}`,description:`Drops ${AIR.bomber.bombs} bombs along a strip, cratering and suppressing enemy ground. Ignores SAMs and guns, but fighters and shield domes stop it.`,use:'Scout the target and clear enemy fighter patrols before ordering a run. Bomb defenses just ahead of a land attack so your troops can exploit the suppression.'},
  {key:'carrier',name:'Stealth troop transport',stats:`${AIR.carrier.cost} gold · ${seconds(AIR.carrier.build)} · Airfield II · range ${AIR.carrier.range}`,description:`Carries up to ${AIR.carrier.capacity.toLocaleString('en-US')} troops for an inland paradrop. Enemy fighters can shoot it down, losing everyone aboard.`,use:'Buy at a level II airfield and choose a reachable landing area away from hostile fighters. Use it to open a second front or reinforce an isolated area, then support the small force you drop.'},
  {key:'spy',name:'Spy plane',stats:`${FOG.plane.cost} gold · ${seconds(FOG.plane.cd)} cooldown · Fog of war`,description:`Reveals a ${FOG.plane.r}-tile area for ${FOG.plane.dur/10} seconds. Enemy fighters can kill it; SAM sites get limited shots after its initial grace period.`,use:'Launch from an airfield before a landing or bombing run. Reveal the defenses, issue your orders while the area is visible, and avoid known enemy patrol circles.'}];
 return [];
}
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const HELP_ROSTER_CSS=`
.sf-unit-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;margin:16px 0 28px}
.sf-unit-card{min-width:0;background:#192938;border:1px solid #34485b;border-radius:12px;overflow:hidden;color:#e8ecef;text-align:left}
.sf-unit-art{height:210px;background:radial-gradient(ellipse at 50% 65%,#354a59,#101e2a 75%);display:flex;align-items:center;justify-content:center;padding:16px}
.sf-unit-art img{display:block;width:100%;height:100%;max-width:100%;object-fit:contain;margin:0;filter:drop-shadow(0 10px 9px #0006)}
.sf-unit-copy{padding:18px}.sf-unit-name{font-size:20px;font-weight:750;line-height:1.2;color:#fff;margin-bottom:8px}
.sf-unit-stats{color:#ffd27a;font-size:12px;line-height:1.6;margin-bottom:10px}
.sf-unit-copy .sf-unit-description{color:#bbcbd8;font-size:14px;line-height:1.6;margin:0 0 14px}
.sf-unit-copy .sf-unit-use{border-top:1px solid #34485b;padding-top:12px;font-size:14px;line-height:1.6;color:#e8ecef;margin:0}
.sf-unit-use strong{display:block;color:#ffd27a;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;margin-bottom:5px}
@media(max-width:600px){.sf-unit-grid{grid-template-columns:1fr}.sf-unit-art{height:220px}}
`;
export function renderHelpRoster(tab,resolveImage=key=>HELP_ART[key],loading='eager'){
 // A modal tab replaces its scrolled content in-place. Eager loading here avoids
 // native lazy-image observers retaining stale positions from the previous tab.
 return `<style>${HELP_ROSTER_CSS}</style><div class="sf-unit-grid">${helpRoster(tab).map(c=>`<article class="sf-unit-card" data-unit="${c.key}"><div class="sf-unit-art"><img src="${escape(resolveImage(c.key))}" width="480" height="360" loading="${loading==='lazy'?'lazy':'eager'}" decoding="async" alt="${escape(c.name)} — in-game artwork"></div><div class="sf-unit-copy"><div class="sf-unit-name">${escape(c.name)}</div><div class="sf-unit-stats">${escape(c.stats)}</div><p class="sf-unit-description">${escape(c.description)}</p><p class="sf-unit-use"><strong>How to use</strong>${escape(c.use)}</p></div></article>`).join('')}</div>`;
}
