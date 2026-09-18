function deepFreeze(value){
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.freeze(value);
    for(const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export const WIN_SHARE=0.72, BOTS=9, TILES_PER_NEUTRAL=1300, QUICK_TILES=2200;

export const DIFFS=deepFreeze({
  supereasy:{label:'Super easy', eco:0.55, aggr:0.5,  build:0.25, brain:0, desc:'Bots grow at half speed, rarely pick fights and never learn. Learn the map.'},
  easy:     {label:'Easy',       eco:0.75, aggr:0.75, build:0.35, brain:1, desc:'Bots are slower and cautious; they place defenses sensibly but don\'t react.'},
  normal:   {label:'Normal',     eco:1.0,  aggr:1.0,  build:0.5, brain:2, desc:'Even footing. Bots build at half pace, place defenses sensibly and reinforce a winning attack, but don\'t react to being hit or manage their economy.'},
  hard:     {label:'Hard',       eco:1.2,  aggr:1.15, build:0.8, brain:3, desc:'Bots manage their economy, remember where they were hit and build answers, pick a focus enemy, break off losing attacks, and gang up on a runaway leader.'},
  superhard:{label:'Super hard', eco:1.4,  aggr:1.3,  build:1.4, brain:4, coalition:0.45, desc:'Everything in Hard plus a real economy: bots open with cities, never sit on gold, fortify their coasts, land where your guns are not, and turn on the leader together. Air power by minute six.'},
  impossible:{label:'Impossible',eco:1.7,  aggr:1.5,  build:4.0, brain:5, coalition:0.28, desc:'The Super hard brain with a city rush that ignores every cooldown, more guns, an earlier navy, and a coalition against anyone holding more than a quarter of the map.'},
});
export const DIFFICULTY_PROFILES=DIFFS;

export const FOG=deepFreeze({base:8,radar:45,lradar:110,rship:60,jam:30,plane:{r:35,dur:450,cd:900,cost:40,speed:6,grace:150,hit:0.15,maxShots:3},sat:{cost:400,dur:450,cd:1200}});
export const STRUCT=deepFreeze({
  city:   {key:'city',   label:'City',        cost:120, desc:'+300 troops now, +cap and growth; linked factories add troops'},
  factory:{key:'factory',label:'Factory',     cost:110, desc:'15 s to build. +2.2 gold / s, +30% per supply line'},
  port:   {key:'port',   label:'Port',        cost:160, desc:'Coast only, 20 s to build. Ships, trade, +gold', coast:true},
  sam:    {key:'sam',    label:'SAM site',    cost:220, desc:'30 s to build. Near-certain kill on hostile missiles in range, 2.5 s reload. Knocked out under bombardment'},
  silo:   {key:'silo',   label:'Missile silo',cost:420, desc:'2 min to build. Launches missiles; 20 s reload per silo'},
  fort:   {key:'fort',   label:'Bastion',        cost:90,  desc:'Doubles the cost of taking land within 16 tiles — and every extra bastion covering the same ground doubles it again, up to 64×. Each one you own makes the next 40 gold dearer. Upgrade to II and III for range. Fortified ground never falls to a collapse and always costs a wall toll to take, garrison or not. Shelling cancels it; overrun destroys it'},
  command:{key:'command',label:'Missile command',cost:350, desc:'90 s to build. Controls silos within 45 tiles and fires them at high-value targets. Overlapping centers make missiles cheaper'},
  shield: {key:'shield', label:'Shield generator',cost:900, desc:'150 s to build. 12-tile dome that stops every missile aimed inside it, 100%, losing 2 of 10 hit points per hit. Repair from the right-click menu'},
  battery:{key:'battery',label:'Coastal battery',cost:420, desc:'60 s to build, coast only. 34-tile gun, 3 damage every 8 s. Knocked out under bombardment', coast:true},
  shore:  {key:'shore',  label:'Shore guns',   cost:150, desc:'20 s to build, coast only. 14-tile rapid fire: shreds transports and light ships', coast:true},
  bertha: {key:'bertha', label:'Big Bertha',   cost:700, desc:'2 min to build. 60-tile artillery, one shell every 20 s at the nearest enemy building. Cannot be intercepted'},
  airfield:{key:'airfield',label:'Airfield',cost:600, desc:'90 s to build. Hangar for up to 4 aircraft; buy fighters and bombers from its right-click menu. Spy planes fly from here'},
  flightops:{key:'flightops',label:'Flight operations',cost:400, desc:'60 s to build. Runs your air war: buys aircraft (keeping a gold reserve), keeps fighter patrols over your assets, recalls damaged pilots, and strikes with bombers when the sky is clear'},
  subbase:{key:'subbase',label:'Submarine base',cost:450, desc:'60 s to build, coast only, needs a level II port within 34 tiles. Builds attack subs and hunter subs', coast:true},
  engcmd:{key:'engcmd',label:'Engineering command',cost:450, desc:'60 s to build. Sends up to 4 repair trucks over your contiguous land to fix shields, airfield shields, guns, Big Bertha and port II guns, 15 gold per pip'},
  troopcmd:{key:'troopcmd',label:'Troop command',cost:400, desc:'90 s to build. +10% troop growth each, up to four. With Garrisons it runs logistics: heavy transport or paradrop to any area under 40% of home density, keeping a reserve'},
  radar:  {key:'radar',  label:'Radar station',cost:180, desc:'20 s to build. Reveals 45 tiles around it (fog of war)', fog:true},
  lradar: {key:'lradar', label:'Long-range radar',cost:500, desc:'60 s to build. Reveals 110 tiles around it (fog of war)', fog:true},
  jammer: {key:'jammer', label:'Radar jammer',cost:400, desc:'45 s to build. Blanks enemy radar stations, long-range radar and radar ships within 30 tiles. Eyes still see: territory, warships, spy planes, satellites', fog:true},
  satellite:{key:'satellite',label:'Satellite launch site',cost:900, desc:'3 min to build. Launch a spy satellite for 400 gold: the whole map for 45 s', fog:true},
});

export const CMD_RANGE=45, CMD_DISCOUNT=0.15, CMD_DISCOUNT_MAX=0.45;
export const BUILD_TICKS=deepFreeze({city:0,fort:0,factory:150,port:200,sam:300,silo:1200,command:900,radar:200,lradar:600,satellite:1800,jammer:450,airfield:900,flightops:600,subbase:600,troopcmd:900,engcmd:600,battery:600,shore:200,bertha:1200,shield:1500});
export const SHIELD=deepFreeze({r:12,hp:10,hit:2,repairCost:25,repairTicks:60});
export const UPGRADE=deepFreeze({port:{cost:500,ticks:600},airfield:{cost:600,ticks:900},fort:{cost:200,ticks:300,max:3,cost3:400,ticks3:600}});
export const LSHIELD=deepFreeze({r:8,hp:6});
export const HEAVY=deepFreeze({hp:4,speedMul:0.75,gun:12,dmg:1,cd:5});
export const CRUISE=deepFreeze({cost:400,ticks:300,range:120,count:2,cd:400,speed:2.5,radius:3,samMul:0.6});
export const AIR=deepFreeze({hangar:4,reserve:300,
  fighter:{cost:350,build:300,speed:6,range:160,patrol:25,endurance:6000,refuel:1200,hp:5,heal:200,dog:30},
  bomber:{cost:450,build:400,speed:5,range:260,bombs:8,spacing:4,radius:2,rearm:300},
  carrier:{cost:500,build:400,speed:5,range:200,capacity:1500,rearm:200}});
export const GUNS=deepFreeze({battery:{range:34,dmg:3,cd:80,hp:6},shore:{range:14,dmg:1,cd:4,hp:3},bertha:{range:60,cd:200,radius:3,hp:8}});
export const ARMOR=deepFreeze({scout:1,rship:1,privateer:1,warship:2,cruiser:3,battleship:5,sub:1,hunter:1});
export const CMD_RESERVE=150;
export const SHIP_BUILD=deepFreeze({scout:0,sub:350,hunter:350,rship:200,privateer:300,warship:250,cruiser:450,battleship:900});
export const CANCEL_REFUND=0.5;
export const TRUCK=deepFreeze({max:4,speed:0.4,repairTicks:80,costPip:15,reserve:150});
export const CITY_POP=300, CONQUEST_GOLD=0.12, CONQUEST_EARLY=3, CONQUEST_EARLY_TICKS=4800;
export const NAP_TICKS=1800, BETRAY_TICKS=600, PROPOSAL_TTL=250;
export const PROVOKE_TICKS=400, FORT_RANGE=16, STRUCT_SPACING=6, WALL_TOLL=15;
export const REGION_MIN=120, LAND_MIN=40, CONTINENT_MIN=3500, CAPTURE_BONUS=0.22, HOLD_BONUS=0.003;

export const SHIPS=deepFreeze({
  sub:       {key:'sub',       label:'Attack sub',     cost:300, hp:3,  gun:0,  dmg:0, sam:0,  samHit:0,    samCd:99, speed:1.6, sub:true, torpedo:{range:14,dmg:3,cd:100}, desc:'Invisible beyond 8 tiles of a destroyer, hunter or radar ship. Torpedoes: 3 damage, one-shot ordinary transports, 10 s reload'},
  hunter:    {key:'hunter',    label:'Hunter sub',     cost:300, hp:3,  gun:0,  dmg:0, sam:0,  samHit:0,    samCd:99, speed:1.7, sub:true, hunter:true, torpedo:{range:14,dmg:3,cd:80}, desc:'Sees subs at 20 tiles and torpedoes them. Fires at nothing else'},
  rship:     {key:'rship',     label:'Radar ship',     cost:250, hp:3,  gun:0,  dmg:0, sam:0,  samHit:0,    samCd:99, speed:1.6, desc:'Unarmed picket that reveals 60 tiles around it. Easy prey — escort it'},
  privateer: {key:'privateer', label:'Privateer',      cost:300, hp:4,  gun:0,  dmg:0, sam:0,  samHit:0,    samCd:99, speed:2.2, pirate:{range:8,board:20,cd:100}, desc:'Boards merchants within 8 tiles and sails them to your nearest port for double cargo. Piracy starts hostilities'},
  scout:     {key:'scout',     label:'Scout boat',     cost:110, hp:2,  gun:12, dmg:1, sam:0,  samHit:0,    samCd:99, speed:3.2, desc:'Very fast, lightly armed, fragile. Picket and courier'},
  warship:   {key:'warship',   label:'Destroyer',      cost:200, hp:5,  gun:26, dmg:1, sam:16, samHit:0.6,  samCd:80, speed:1.4, desc:'Fast escort, deadly to cruisers. Short-range SAM'},
  cruiser:   {key:'cruiser',   label:'Missile cruiser',cost:450, hp:6,  gun:22, dmg:1, sam:26, samHit:0.75, samCd:60, speed:0.95, barrage:{range:30,count:4,radius:2,cd:150}, desc:'Bombards enemy land, hunting SAM sites first. Medium SAM. Thin armor: destroyers hit it twice as hard'},
  battleship:{key:'battleship',label:'Battleship',     cost:900, hp:12, gun:32, dmg:2, sam:26, samHit:0.75, samCd:60, speed:0.6, barrage:{range:36,count:6,radius:3,cd:250}, desc:'Heavy guns, land missiles and SAM. Slow reload, slow to arrive'},
});

export const WARSHIP_COST=200, SHIP_SPEED=1.1, WARSHIP_RANGE=26, WARSHIP_HP=5, SHELL_SPEED=4, TRADE_INTERVAL=220, TRADE_GOLD=18, TRADE_PER_TILE=0.12, TRADE_SPEED=1.3, SHIP_SAM_RANGE=16, SHIP_SAM_COOLDOWN=80, SHIP_SAM_HIT=0.6, SINK_BOUNTY=0.3, BARRAGE_KILL_FLAT=20, BARRAGE_KILL_PCT=0.008, BARRAGE_KILL_CAP=150, SUPPRESS_TICKS=300, SUPPRESS_RING=3, SUPPRESS_COST=0.5, LINK_RANGE=34, LINK_MAX_PER_CITY=3, LINK_MAX_PER_PORT=2, LINK_MAX_PER_FACTORY=4, LINK_GOLD_PER=0.3, LINK_TROOPS=1.2, LINK_PORT_GOLD=1.0, LINK_SHIP_DISCOUNT=0.15;
export const NUKE_COST=280, NUKE_RADIUS=20, SAM_RANGE=40, SAM_HIT=0.96, SAM_REACT=6, INTERCEPTOR_SPEED=9, SAM_COOLDOWN=25, SILO_COOLDOWN=200;
export const BOT_NAMES=deepFreeze(['Vardania','Kestrel Union','Orrin','Thalassa','Novgard','Serendib','Ashkar','Meridia','Cordova','Halvard','Zephyria','Ostmark']);
export const NEUTRAL_NAMES=deepFreeze(['Free Tribes','Hill Clans','Coastal League','Old Kingdom','Marsh Folk','Steppe Horde','Island Council','Mountain Holds']);
export const COLORS=deepFreeze(['#4da3ff','#e35d5d','#5fc76a','#e5a53c','#b06ee8','#3fc9c9','#f07ab0','#a8d15a','#ff8f4d','#8b93ff','#d4c34a','#5ad1a5','#e07b9f','#7fd0ff']);
