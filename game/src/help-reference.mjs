// Detailed rules retained from the existing guide. Shared by the app and website.
export const HELP_REFERENCE={
  "basics": [
    {
      "title": "Left-click a bordering country",
      "body": "Invade along the whole shared frontier with the share of your army set by the <b>Send into attack</b> slider. The advance stops when that country falls; click again to reinforce."
    },
    {
      "title": "Right-click your land",
      "body": "Build menu (or cancel a construction site)."
    },
    {
      "title": "Right-click enemy land",
      "body": "Send a transport, launch a missile, diplomacy, missile-command focus."
    },
    {
      "title": "Right-click water",
      "body": "Send a ship from your nearest port, or a port on your own coast."
    },
    {
      "title": "Click a ship · Shift-drag",
      "body": "Select ships. Right-click water to move them, an enemy port to blockade. Esc deselects."
    },
    {
      "title": "Scroll · drag · Space",
      "body": "Zoom · pan · pause."
    },
    {
      "title": "Saves and replays",
      "body": "Logged-in players get saves and replays on their account. The game autosaves every 30 seconds; Save & quit on the pause card (Space or ⏸) keeps a named copy and returns to the site; 💾 saves without leaving. Every finished match is kept as a replay. Games & replays on the start card lists them: Resume picks a match up where you stopped on any device, Watch plays a replay at 1–8× with a Take over button, and Download keeps a .state copy. "
    },
    {
      "title": "Hotkeys",
      "body": "Press a key, then click a tile. Each key is shown as a badge in the build menu. <kbd>C</kbd> city · <kbd>F</kbd> factory · <kbd>P</kbd> port · <kbd>S</kbd> SAM · <kbd>H</kbd> shield · <kbd>M</kbd> silo · <kbd>K</kbd> missile command · <kbd>D</kbd> bastion · <kbd>G</kbd> shore guns · <kbd>B</kbd> coastal battery · <kbd>T</kbd> Big Bertha · <kbd>A</kbd> airfield · <kbd>O</kbd> flight operations · <kbd>U</kbd> submarine base · <kbd>Y</kbd> troop command · <kbd>E</kbd> engineering command · <kbd>R</kbd> radar · <kbd>L</kbd> long-range radar · <kbd>J</kbd> jammer · <kbd>I</kbd> satellite site · <kbd>N</kbd> missile · <kbd>Space</kbd> pause · <kbd>Esc</kbd> cancel · <kbd>[</kbd> <kbd>]</kbd> previous / next song."
    },
    {
      "title": "Economy slider",
      "body": "Shift growth between troops (1.6× at the end) and gold (1.6× at the other end)."
    },
    {
      "title": "Density",
      "body": "Troops ÷ tiles. Land costs more to take the denser its defender; a thin army is cheap to invade and invites neutrals and allies to turn on you."
    },
    {
      "title": "Neutrals",
      "body": "Never attack first. Once hit they mobilize and push back for ~40 s, but only against an attacker spread thinner than they are. Conquering one pays plunder — tripled in the first minutes."
    },
    {
      "title": "Landmasses",
      "body": "Own every tile of an island or continent for a one-time troop windfall and a lasting growth bonus. Rivers block land attacks; cross them by transport."
    },
    {
      "title": "Nuked",
      "body": "When a missile lands on your land, a red card at the top of the screen names the attacker (\"NUKED BY EGYPT\"), an air-raid siren sounds, the launching silo flashes red rings for as long as the siren sounds (about 9 s), and if the silo is off screen a flashing red arrow at the screen edge points toward it with the attacker's name. Right-click their land to concentrate missile command on them."
    },
    {
      "title": "Fallen nations",
      "body": "When a named nation is wiped out, a banner takes the centre of the screen for a few seconds — its flag struck through, \"EGYPT — FALLEN, killed by France\", the killer's flag at the right — without interrupting play, and a short bugle call sounds (quietly if you weren't involved). Fallen nations stay at the bottom of the sidebar list, struck through, with who killed them. The same banner in gold announces a continent unified — by anyone — or any landmass you unify yourself, with the windfall and the hold bonus it now pays, and a short fanfare."
    },
    {
      "title": "Collapse",
      "body": "A nation whose army hits zero while you're taking its land falls at once on the landmasses you're fighting on — the rest of its territory there is yours without painting it tile by tile. The same happens to anyone reduced to under 25 tiles. Holdings across water are not touched: the nation survives there as a rump state until someone lands on it."
    },
    {
      "title": "Unclaimed land",
      "body": "Craters and burnt ground cost nothing to take — the troops you commit set the speed and come home in full when it's done. Fighting a nation costs troops per tile — more the denser the defender, up to 8 per tile — and never more in total than about 1.5× what the defender has left, plus attrition of 10% of what the fight cost. Everything you didn't spend comes home."
    },
    {
      "title": "Force and speed",
      "body": "An attack that can afford many sweeps of its front advances up to 3× faster; one that can barely pay crawls."
    }
  ],
  "build": [
    {
      "title": "Spacing",
      "body": "Buildings need 6 tiles of clearance from each other. You don't have to be exact: click within 5 tiles of a valid spot and the building lands on the nearest tile that fits (coastal buildings on the nearest coast)."
    },
    {
      "title": "Supply lines",
      "body": "A factory links to every city and port of yours within 34 tiles (4 per factory, 3 per city, 2 per port). Each line: +30% gold for the factory; +1.2 troops/s per line for a city; +1 gold/s and 15% cheaper ships for a port."
    },
    {
      "title": "Construction",
      "body": "Sites do nothing until finished, can be captured (progress kept) or bombarded, and cancelled for half the gold. A city with three linked factories speeds nearby building by 25%."
    },
    {
      "title": "Cities",
      "body": "+300 troops the moment they're built."
    }
  ],
  "ships": [
    {
      "title": "Cruise missiles",
      "body": "Select a battleship within 34 tiles of one of your level II ports and right-click water: <b>Refit with cruise missiles</b>, 400 gold, 30 s at anchor. It then fires two cruise missiles every 40 s at targets up to 120 tiles inland — shield generators first, then SAM sites, then anything of a nation it's fighting. They fly straight and low at 25 tiles/s (a silo missile lobs at up to 60), so a 120-tile shot takes about 5 s. Each hit craters a 3-tile radius like a bomb; SAMs engage them at 60% of normal effectiveness; a shield dome absorbs one for 1 hp. The ship shows a \"CM\" badge."
    },
    {
      "title": "Submarines",
      "body": "A submarine base (450 gold, coast, needs a level II port within 34 tiles) builds <b>attack subs</b> (300 gold, 3 hp, torpedoes: 3 damage, one-shot ordinary transports, 10 s reload, 14 tiles) and <b>hunter subs</b> (300 gold, 3 hp, torpedo only other subs, spot them at 20 tiles). Subs are invisible — and untargetable — unless within 8 tiles of a destroyer or radar ship, or 20 of a hunter; under fog they're hidden outright. Their torpedoes aren't: a torpedo leaves a long foam wake you can see whenever the water is in view, which tells you a sub is out there and roughly where. Guns, batteries and heavy transports can't fire at them at all. They carry no SAM and don't shoot land. Attack subs engage transports headed for their owner and ships of nations they're fighting, plus loitering cruisers and battleships."
    },
    {
      "title": "Transports",
      "body": "Right-click a country you don't border. Embarks from your coast nearest to them, lands on theirs; no port needed. One hit sinks it — unless it's a <b>heavy transport</b>: once you own a level II port (per area with Garrisons, everywhere without), every transport you send — invasions, reinforcements, gifts — sails as a heavy: 4 hp, 25% slower, and a 12-tile gun that returns fire at whatever shot it last (never at subs). A lone destroyer loses the exchange; shore guns in pairs still win."
    },
    {
      "title": "Upgrades",
      "body": "Right-click a finished port or airfield to upgrade it to level II (port 500 gold / 60 s; airfield 600 / 90 s). Level shows as \"II\" on the icon; captured buildings keep their level; bombardment knocks a level II back to I instead of destroying it. Port II: built-in shore guns with 4 hp of their own, shown as pips under the icon (red when low; right-click the port to repair them, 25 gold per pip) — ships and heavy transports shoot back at them, and when they're shot out the port drops to level I — plus heavy transports and the submarine-base unlock. Airfield II: 6 hangar slots, light shield dome, stealth troop transports."
    },
    {
      "title": "Salvage",
      "body": "Sinking a transport pays 30% of the troops aboard in gold; a merchant pays 60."
    },
    {
      "title": "Barrage",
      "body": "Craters land, kills troops (20 + 0.8% of the army per hit, max 150, plus whoever was standing on the cratered tiles) and suppresses the area for 30 s: half cost to invade, bastions and SAM sites there knocked out. Hunts SAM sites first."
    },
    {
      "title": "Merchants",
      "body": "Every port sends one every ~20 s to any port you aren't fighting. Both sides earn gold on arrival. Blockade an enemy port to starve it — or send privateers: they grapple any non-allied merchant within 8 tiles — it heaves to while the privateer comes alongside, then 2 s of boarding, which then sails to your nearest port and pays double cargo on arrival. One capture per 10 s per privateer; piracy starts hostilities."
    }
  ],
  "air": [
    {
      "title": "Airfield",
      "body": "600 gold, 90 s. 4 hangar slots (6 at level II). Buy aircraft from its right-click menu; aircraft have a combat radius from their home field (fighters 160, bombers 260, transports 200). Losing the field loses its aircraft. Upgrade to level II (600 gold, 90 s) adds a light shield dome (6 hp, 8 tiles) and the troop transport."
    },
    {
      "title": "Flight operations",
      "body": "400 gold, 60 s. Buys aircraft with a 300-gold reserve, keeps patrols over SAM belts, airfields, silos and guns, recalls fighters at 2 hp or when outnumbered, and strikes enemy targets not under fighters or a dome. Toggle in the Air panel."
    },
    {
      "title": "Dogfights",
      "body": "Overlapping enemy patrols exchange air-to-air missiles every 3 s — 85% to hit if you're outnumbered in the overlap, 60% otherwise. A recalled fighter takes parting shots while it escapes; at 0 hp it's gone."
    },
    {
      "title": "Recall",
      "body": "Air panel in the sidebar (per aircraft, Recall damaged, Recall all) or right-click near a patrol."
    }
  ],
  "systems": [
    {
      "title": "Diplomacy",
      "body": "Right-click a nation: 3-minute pact or lasting alliance. Nobody can attack, land on, bombard or nuke the other; allies' SAMs and ships defend each other and trade automatically. Bots accept more readily when you're stronger, when they're already at war, and when your reputation is good — and break pacts with soft partners once the neutrals are gone. Declaring war halves your growth for a while and costs reputation."
    },
    {
      "title": "Allied aid",
      "body": "Right-click an ally to send gold or troops (by land if you share a border, else by transport) or to request either from their surplus. Allies under attack ask you for help in the Diplomacy panel. Each Send button uses its own amount. Transfers support up to one billion gold or troops; an overseas troop gift still needs a safe sea route."
    },
    {
      "title": "Air defense",
      "body": "SAM sites and ship SAMs engage missiles passing through their range — flight path, not just target — when the missile is aimed at their owner's or an ally's land, or their owner is at war with the launcher. 96% kill, 2.5 s reload: one site can stop two spaced missiles, not three together. Hover one of your SAM sites or ships to see your whole network (allies' too); enemy coverage isn't shown."
    },
    {
      "title": "Coast & artillery",
      "body": "Shore guns (14 tiles, rapid fire) sink transports and light ships; against armored hulls their damage is divided by 2 (destroyer), 3 (cruiser), 5 (battleship). Guns never fire on merchant ships. They fire at warships of nations you're in conflict with — attacks, bombardment, missiles or ship-to-ship fire in the last minute — plus any transport at all that comes within range (unless its owner is your ally or pact partner — sinking one starts hostilities), and any cruiser or battleship loitering in range. Nothing fires until the progress arc completes. Coastal batteries outrange a battleship's guns (34 tiles) and hit for 3 every 8 s. Both are knocked out while under bombardment, destroyed if overrun, and have hit points (shore guns 3, batteries 6): any armed ship of a nation you're fighting — or one your gun has fired on — shoots back with its main gun, and cruiser and battleship barrages target guns first. Big Bertha lobs an uninterceptable shell every 20 s at the nearest enemy building within 60 tiles — SAM sites, bastions and guns first — cratering and suppressing like a barrage. Ships hunt guns the way they hunt SAM sites, and a level II port's guns count as guns."
    },
    {
      "title": "Air",
      "body": "<b>Airfield</b> 600 gold, 90 s: hangar for 4 aircraft, bought from its right-click menu; spy planes need one within 150 tiles. <b>Stealth fighter</b> 350 gold: right-click → Fighter patrol here — a 25-tile circle for 10 minutes, then 2 minutes refueling. Untouchable by SAMs. Kills any enemy bomber or spy plane in its circle. Overlapping enemy patrols dogfight: every 3 s each fighter risks 1 HP — 85% if outnumbered, 60% otherwise. Recall from the Air panel in the sidebar, or right-click near the patrol; a recalled fighter takes parting shots while it escapes, lands, repairs 1 pip per 20 s, and flies again — or dies en route at 0 HP. <b>Stealth bomber</b> 450 gold: right-click → Bomber strike here — flies to the point and runs a 30-tile strip dropping 8 bombs, each 1/8 of a nuke, cratering and suppressing. Bombs are held over your own or allied ground and the run extends until all 8 have found enemy land. Ignores SAMs and guns; stopped only by fighters and shield domes (1 dome HP per bomb). Big Bertha, batteries, silos and shields shrug off a single bomb 30% of the time. <b>Flight operations</b> 400 gold, 60 s: buys aircraft (2 fighters and 1 bomber per field, keeping a 300-gold reserve), patrols your SAM belts, airfields, silos and guns, recalls fighters at 2 HP or when outnumbered, and strikes enemy targets that aren't under fighters or a dome. Toggle in the Air panel."
    },
    {
      "title": "Shield generator",
      "body": "900 gold, 150 s. A 12-tile dome that stops every missile aimed inside it — the SAMs shoot first, and whatever they miss the dome absorbs at 100% — at a cost of 2 of its 10 hit points per missile. A nuke landing nearby can't reach under the dome either — the ground inside is untouched and the dome takes a hit for it. It never decays; it dies to hits, to barrages (cruisers hunt it first), or to being overrun. Right-click it to repair at 25 gold per pip, one pip per 6 s (pauses for 15 s after each hit; never instant). Naval guns, barrages and Big Bertha pass through the dome, so a shielded strongpoint has to be taken by fleet or by land."
    },
    {
      "title": "Missiles",
      "body": "280 gold from a silo (20 s reload each). A hit craters a 20-tile radius, destroys buildings and kills the troops standing on the cratered ground: a quarter of a big area's garrison if the circle covers a quarter of it, all of a small island's if it covers the island. To get through a defended coast, bombard the SAMs with cruisers first, or salvo."
    },
    {
      "title": "Engineering command",
      "body": "450 gold, 60 s. Keeps up to four repair trucks. Whenever something repairable on your contiguous land is damaged — a shield generator, an airfield II's shield, a coastal battery, shore guns, Big Bertha, a port II's guns — a truck drives out over your own land, repairs one pip every 8 s at 15 gold a pip (keeping a 150-gold reserve), and drives back. Any repair — truck or manual — pauses for 15 s after the target takes a hit. Trucks are lost if the ground under them is captured, and they can't cross water."
    },
    {
      "title": "Troop command",
      "body": "400 gold, 90 s. Each center adds 10% to troop growth, stacking to four (+40%). With Garrisons on it also runs logistics: every 4 s it looks for areas of 40+ tiles that are threatened — bordering a nation it's fighting or a provoked neutral, or under attack — and brings the most threatened up toward 60% of the home area's density (bare areas under 20% get topped up to 20%), counting troops already in transit, one shipment per area per 20 s, never more than 15% of home per shipment and never below a 30% home reserve. Before a convoy sails it checks the route: hostile warships within 20 tiles of the path, subs it can see, and enemy guns at the landing. If the lane is contested it paradrops instead when a troop transport is in range; otherwise it holds the convoy and tells you — except when the destination is actually under attack, when it runs the lane with half the shipment. Toggle in the sidebar."
    },
    {
      "title": "Command links",
      "body": "Command buildings draw dashed links to what they control — orange from missile command to the silos in its 45-tile range, cyan from flight operations to airfields, green from troop command to nearby cities and ports — with a pulse running along each, like the gold supply lines between factories and cities."
    },
    {
      "title": "Missile command",
      "body": "Controls silos within 45 tiles and fires them at the most valuable targets of nations you're fighting, waiting to fire the full salvo a SAM site needs. Overlapping centers cut missile prices 15% each (max 45%). Right-click a nation to focus it; toggle in the sidebar."
    },
    {
      "title": "Teams",
      "body": "Permanent alliances dealt round-robin; a team's combined land wins. Map colors tint toward the team color."
    },
    {
      "title": "End game",
      "body": "72% wins; you can keep playing. If only allies remain you choose between a shared victory proposal and war. 100% ends the match outright."
    },
    {
      "title": "Map seed",
      "body": "The seed on the start card decides the map, rivers, neutral borders and start positions. Restart keeps it, so you can retry the same opening; type a friend's seed to play their map; press New for a fresh one."
    },
    {
      "title": "Maps",
      "body": "Generated: Continents, Land (lakes and rivers, no ocean), Large / Medium / Small islands, Atoll. Real: World, Europe, Americas, Africa, Asia, Middle East — real countries in place, big ones split into provinces."
    }
  ],
  "garrisons": [
    {
      "title": "Watch the list",
      "body": "The sidebar area list is your early warning. A beachhead reading 80 troops next to an enemy at 3,000 is about to be pushed back into the sea."
    },
    {
      "title": "Cities on the front",
      "body": "A city's +300 lands in its own area, so building one on a beachhead is the fastest way to stiffen it."
    },
    {
      "title": "Bridge the river",
      "body": "Two areas split by a river merge the moment you own both banks all the way around — often cheaper than ferrying reinforcements for the rest of the match."
    },
    {
      "title": "Escort the convoys",
      "body": "Ordinary transports sink in one hit. Upgrade the source area’s port to Port II for armored heavy transports, and escort both kinds across contested water."
    }
  ]
};
