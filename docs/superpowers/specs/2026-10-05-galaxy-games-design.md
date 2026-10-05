# The galaxy's missions: design for the games still to build

The galaxy (`/galaxy`, `src/components/galaxy/`) gives every one of its eighteen Star Wars systems a mission. Two are live (Yavin's trench run and boarding the Death Star at Alderaan, both on `/deathstar`); the other sixteen are briefings (`/galaxy/:id/mission`: an opening crawl from `crawls.js`, three objectives, who you fly as, how it'll play). This is the plan for turning them into games, in a later session. Each mission's own data (`title`, `film`, `role`, `pitch`, `how`, `objectives`) is in `systems.js`; when one ships, flip its `status` to `'live'` and give it a `to`.

## One engine, many missions

Most missions are the same game underneath: fly something low over a planet, among its weather and its landmarks, against something that fights back. So build one surface engine first, then each mission as data and a small rules file on it, the way the site's other worlds keep their rules pure and tested (`rules.js`) and their drawing apart.

`src/components/galaxy/surface/`:

- `terrain.js` (pure, tested): `height(x, z)` per biome from seeded noise (dunes, ice plains with ridges, forest floor, salt flats, lava fields, city canyons, ocean with islands), plus what's solid on it (trees, arches, walls, towers as circles and boxes). The same function draws and collides.
- `vehicle.js` (pure, tested): a hover vehicle with an altitude band (`[min, max]` above the ground), banking turns, a boost, brakes, ground and obstacle collisions (bump, or crash past a speed); covers the speeder bike `[0.8, 3]`, the podracer `[0.8, 2]`, the snowspeeder `[2, 40]`, the airspeeder `[5, 200]` and a starfighter low `[3, 150]`. The universe's `ship.js` can stand in for the starfighter missions (space with a floor).
- `scene.js`: a heightfield chunked round the camera, the biome's sky and fog, weather particles (snow, rain, ash, mist, salt), instanced props, the chase and cockpit cameras and the HUD the galaxy already has (the universe map's classes), the guns (`universe/targeting.js`), and the mission's actors.
- `missions/<id>.js`: what's there and what winning is: spawns, paths, the objective checks, the clock. Pure where it can be (tested in Node).
- `Mission.jsx`: the page (`/galaxy/:id/play`): the briefing's crawl first (`crawls.js`), then the game, then a debrief with the score; back to the system after.

Reuse rather than rebuild: the galaxy's ship and station models (`fleet*.js`, `models.js`), its effects (`fx.js`: bolts and flashes), the universe's crash and pops (`universe/crash.js`), sounds (`universe/sounds.js`, `lib/sfx.js`), clips (`lib/clips.js`), flight settings (`universe/controls.js`), the GPU gate and pacing (`lib/three/pace.js`), and `games/` (gamepad, the hardware check).

## Multiplayer

Every mission should work alone and online. The galaxy already puts pilots in the same system in the same room (`online/where.js`: `/galaxy/hoth`); a mission is a room of its own (`/galaxy/hoth/play`), and its pilots see each other's vehicles and shots through the same `client.js` poses (they're position, heading, pitch, bank, speed: any vehicle).

For a shared fight (everyone sees the same walkers), drive the enemies from the wall clock, as the galaxy's set pieces already are (`world.js`: everything moves by `Date.now()`), so every pilot computes the same walker in the same place, and send only what changes it: a new small action (`ev`, rate-limited like the rest in `protocol.js`) saying "walker 3 tripped", believed only from a pilot who was near it. The rush in Bree (`middleearth/rush/online.js`) shows the other way, a host running the round, if a mission needs it (the podrace's grid, say).

## The missions

### Tatooine: The Boonta Eve Classic (podrace)
- You: Anakin's podracer (two engines on energy binders, the pod behind). Steer each engine (A/D or left stick, a little lag in the pod), boost when the binder's hot (it overheats), brake with the air flaps.
- Course: Mos Espa arena start, the Dune Sea, Beggar's Canyon, the Arch Canyon (arches as gates), Laguna Caves, Tusken Raiders sniping from the rocks, three laps.
- Rivals: Sebulba (rams, flame-cuts), and a pack of others on racing lines (splines with noise). Crashes: engines tear off, pit droids put you back.
- Win: first across the line. Online: race each other; the host holds the grid and the laps.

### Hoth: The Battle of Hoth
- You: a T-47 snowspeeder, Rogue Group. Fast and low over the snow; blasters do nothing to AT-AT armour.
- Walkers: four AT-ATs (a slow stride, head turrets firing), a few AT-STs (blasters work on these), probe droids early.
- Tow cable: fire it as you pass an AT-AT's legs, then circle (the cable wraps: count the turns); three wraps trips it, and its neck is open for a shot.
- Lose: a walker reaches the shield generator (the clock is its stride). Online: shared walkers (wall clock + "tripped" events).

### Endor: The Speeder Bike Chase
- You: a 74-Z speeder bike, at full speed through the redwoods (instanced trunks, ferns, fallen logs, light shafts).
- Scouts: four, racing for the bunker; ram them into trees, or shoot them. They try the same on you.
- Win: none reach the bunker. Then, maybe, the Battle of Endor in space: into the second Death Star's superstructure to its reactor (the galaxy's `deathstar2` model has the open bite to fly into).

### Bespin: Escape from Cloud City
- You: the Falcon (Lando at the controls), off the platform, through the cloud layers (volumes of fog to lose the TIEs in), under the city's vane to catch Luke, then up to the jump, which fails until Artoo fixes it (a short timed hold).

### Dagobah: Do or Do Not
- Part one: run the swamp on foot with Yoda on your back (a third-person runner over roots and mud).
- Part two: raise the X-wing: hold steady (the mouse or a stick held still, breath-like); doubt (wobble) sinks it. A calm, short piece.

### Mustafar: The High Ground
- A duel on platforms floating down the lava river: rhythm-timed parries and strikes (the site's music room has timing code to borrow), jumping between collectors as they tilt; end on the riverbank above him.

### Coruscant: Chase Through Coruscant
- You: the yellow airspeeder. Through the skylanes after Zam Wesell: dense traffic (instanced, in lanes), drops between levels, the power couplings ("Pull up!"), a nightclub district. Lose her for too long and she's gone.

### Naboo: Into the Droid Control Ship
- You: an N-1, on autopilot into the battle: a dogfight round the Lucrehulk (the galaxy has the model), then in through its hangar's shield, two torpedoes into the reactor, and out ahead of the blast. "Try spinning: that's a good trick."

### Kashyyyk: The Battle of Kashyyyk
- You: a Wookiee catamaran on the lagoon at Kachirho; droid boats and tanks coming across the water; spider droids on the shore. A twist at the end (Order 66) for anyone who knows.

### Kamino: Storm over Tipoca
- On foot on the landing platform in the rain against Jango Fett (jetpack, wrist rockets), then the tracker on Slave I as it lifts off. Leads into Geonosis.

### Geonosis: Seismic Charges
- You: Obi-Wan's Delta-7 in the asteroid ring (the galaxy's `rocks.js` ring, its big rocks solid) behind Slave I; seismic charges (a delay, then a blue ring that cuts through everything); cut your engines behind a big rock to make him think you're gone.

### Scarif: Rogue One
- Three acts: through the Shield Gate before it closes (a flight through the battle the galaxy already plays over Scarif), the beach (AT-ACTs, a U-wing gunner's view), then the Citadel tower climb against the clock, the Death Star's shot coming.

### Nevarro: The Siege
- You: the Razor Crest (the galaxy's own, built in `fleetExtras.js`), Din Djarin at the controls. First save the stolen trooper transport from the scout troopers on its tail, then up out of the lava canyons with the TIEs that scramble from the burning Imperial base behind you; flip her round (a quick-turn button) and take them on one at a time. The canyon walls are the cover: low enough and they can't line up a shot.

### Mandalore: The Return
- You: Bo-Katan's Gauntlet (`fleetExtras.js`), over the glassed plains in the battle the galaxy already plays there. Keep Moff Gideon's TIEs and interceptors off the Mandalorians' capital ship until it's evacuated (a bar that fills), then fly escort as Axe Woves takes it down onto the base, and pull up before it hits. A coda on foot (the surface engine): into the base after Mando.

### Lothal: The Star Map
- You: Sabine's speeder bike from the ceremony out across the grass plains (rock spires as the obstacles, loth-wolves running alongside), then the old tower: hold out against Shin Hati and her mercenaries while the map unlocks (a timer), with a lightsaber she hasn't practised with in years. Low stakes, a ride and a fight.

### Sorgan: Sanctuary
- On foot (the surface engine), with Cara Dune: train the krill farmers (a few short drills), dig and hide the trap in the pond, then the night the raiders come: draw the AT-ST's fire through the trees, light the trap when it's in the water, and put a shot into its cockpit when it stumbles. Online: one plays Mando, one Cara.

## Build order

1. The surface engine with Hoth (it exercises everything: snow, walkers, a special mechanic, a defend clock).
2. Endor (the engine's obstacle density and speed), Tatooine (racing, rivals, laps).
3. The space missions on the galaxy's own scene (Naboo, Geonosis, Nevarro, Mandalore): they need little new.
4. The rest, then shared online fights on the ones that suit it.

## Tests

Every mission's rules in Node with Vitest (spawns, the win and lose checks, the tow cable's wraps, the lap counter), as the other worlds do; the engine's `terrain.js` and `vehicle.js` likewise. Screenshots through headless Chromium (SwiftShader) for each biome, as the galaxy's own were checked.
