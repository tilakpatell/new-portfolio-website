# Aboard the Death Star: both battle stations, walked room by room

Status: design, written 7 October 2026. The owner asked for it on 7 October; the brief and the choices made for them are below.

## What the owner asked for

“Make it so we can go inside the Death Star. Get version 1 and version 2 textures that are HD for the actual Death Star. Make it so we can explore the Death Star, has AI and functioning NPCs and battles, Easter eggs. The various rooms. Focus on making it perfect and in depth with models and stuff.”

Asked during the design:

- **Core loop:** a story run *and* free roam. The station is open to walk room by room; a chain of film beats sits on top of it, with side encounters, people going about their work and Easter eggs everywhere.
- **Side:** either. A Rebel infiltrator, whom the garrison hunts once found out, or an Imperial, who serves aboard and catches the intruders.

Chosen for the owner when they said “keep going” (each can be changed):

- **Both stations, one world.** The first Death Star (0 BBY, *A New Hope* and *Rogue One*) and the second (4 ABY, *Return of the Jedi*) share one engine, one corridor kit and one cast; each has its own rooms and story.
- **A world of its own on the runtime**, at `/deathstar/inside`, not galaxy-surface zones. The zones can’t do zone-to-zone doors, walls for enemies, walls for bolts, more than four lamps, or rooms built only when near, and `galaxy/surface/scene.js` is 2,800 lines that three open PRs touch. A new world can do all of that properly and keeps the Death Star island its own.
- **Third person over the shoulder, with a first-person switch (V).** The camera never passes through a wall. Third person shows the disguise; first person suits the corridors.
- **Ways in:** the Death Star page, the galaxy (Alderaan’s tractor beam pulls you into Docking Bay 327; Endor’s second Death Star lets you dock once its shield is down; Yavin’s puts you in the TIE launch bay), and the terminal.
- **HD exteriors** from the two models already on the site, re-exported from their 4096-pixel sources, plus a new detail normal map; used in the galaxy, in the skies of Scarif and Endor, and from inside (the hangar’s magnetic field, the overbridge, the throne room’s window).

## The real thing

Rooms, events and lines come from the films and current canon (Wookieepedia); the research is in the workflow notes of 7 October. Facts the build keeps to:

- DS1 is 160 km across, the dish in the northern hemisphere, an equatorial trench, the exhaust port at the end of a meridian trench. Eight tributary beams meet at the dish’s focus.
- DS2 is unfinished, its dish also north; the Emperor’s Tower stands at the north pole with the throne room at its top. The main reactor glows blue a long way below the throne room’s shaft.
- Docking Bay 327; Detention Block AA-23 on Level 5 with cell 2187; garbage compactor 3263827; the tractor beam coupled to the main reactor in seven places, the terminal Obi-Wan uses on a ledge over the Level 6 core shaft; the central core shaft’s chasm with its retractable bridge; the conference room by the overbridge with Krennic’s chair empty; Hangar 272 where the Emperor arrives; Lambda shuttle ST 321 and Code Clearance Blue.
- Names on screen and in canon differ in places the Easter eggs use: Tarkin is “Governor” in dialogue and Grand Moff by rank; Jerjerrod is “Commander” on screen and a Moff in canon.
- No sequel trilogy: no FN-2187 (2187 is Lipsett’s *21-87*), no Starkiller Base, no First Order models. A banned-word test runs over the world’s data.
- The site’s own words: short famous lines may be quoted; signs, logs, barks and everything else are written fresh.

## Architecture

`src/components/deathstar/inside/` is one world module on `src/runtime`, in the Death Star island. Pure rules under `rules/` (no three.js, no DOM, seeded, tested beside each file) run at a fixed 30 Hz; `scene/` draws what the rules say; `module.js` joins them; `Inside.jsx` is the page’s UI.

```
pages/DeathStarInside.jsx     route /deathstar/inside, WorldHost + Inside.jsx
deathstar/inside/
  module.js                   { id: 'deathstar-inside', shading: 'glsl', mb } — input, fixed step, events
  Inside.jsx, inside.css      start screen, HUD, dialogue, map, pause, touch controls
  voicelines.js               VOICELINES for the voices pipeline
  rules/
    stations/ds1.js, ds2.js   the room graph of each station (data)
    layout.js                 graph → walls, floors, doors, lifts, ledges, nav grid, camera rooms; validates
    walker.js                 capsule against wall segments and boxes on stacked floors; steps, ledges, falls
    nav.js                    nav grid per level, A* with string pulling, doors and lifts as links
    doors.js                  door and blast-door states; who may open; lockdown
    alarm.js                  station security by section: calm, wary, alert, lockdown, hunt, stand-down
    disguise.js               how sure the garrison is that a trooper is not a trooper
    cast.js                   the people and droids: model, height, tint, weapon, health, voice, role
    brains.js                 roles on src/lib/ai: patrol, post, work, officer, squad soldier, droids, Vader…
    combat.js                 weapons, heat, bolts that fly and stop at walls, damage, knockdown
    saber.js                  strokes, guard, parry, deflection; the Force: push, pull, choke, lightning, the mind trick
    talk.js                   conversations with choices, keyed on station, side, disguise and story
    story/*.js                the story chains as steps: reach, talk, use, hide, escort, fight, choose, timer, scene
    eggs.js                   Easter egg triggers
    game.js                   the sim: new game, step, events; save shape and version
  scene/
    kit.js                    the Imperial material library and geometry helpers, merged by material
    rooms/*.js                one builder per room kind
    stream.js                 builds rooms when near, shows rooms seen through open doors, frees the far ones
    figures.js                rigged people on the shared 24-bone rig, clips, held guns and blades
    fx.js                     pooled bolts, sparks, scorches, flares, smoke, explosions, lightning
    camera.js                 third and first person, kept out of walls
    views.js                  what windows show: space, Alderaan, Yavin, Endor, the fleet, the HD station
    cinematics.js             scripted camera moves: the tractor beam, the Emperor’s arrival, the escape
    sounds.js                 the station’s hum, doors, lifts, alarms, blasters, sabers
```

Shared code moves down rather than across islands: `rickmorty/portal/clips.js` (borrowClips, retarget) to `src/lib/three/clips.js` and `office/world/paths.js` (findPath) to `src/lib/ai/path.js`, each leaving a one-line re-export so their worlds don’t change. `worldAt` picks the longest match, so `/deathstar/inside` gets its own download size and phone gate.

### Rooms and streaming

A station is a graph: rooms with a kind, a level, a box (or round) in metres, doors on their walls (to another room), lifts (to another level) and ledges (a drop with nothing under it). `layout.js` turns it into walls with openings, floors, door leaves, the nav grid and the camera’s rooms, and refuses a graph with unreachable rooms, unmatched doors or overlaps. Rooms are built when within two doors of you, shown when you are in them or can see them through an open door, and freed when four doors away, so only a handful exist at once.

### Moving, doors and lifts

The walker is a capsule (0.35 m) against wall segments and boxes on stacked floors, with a 0.4 m step, jumping, running, crouching, and falls off ledges into shafts (respawn at the last safe spot, with the fall counted). Doors slide when someone allowed comes near; a lockdown seals blast doors in the alerted section; some doors need a code, a key card or R2 at a scomp link. Lifts are rooms that move between levels: you ride, the doors open on another floor.

### People and their minds

Every person is a rigged model on the shared 24-bone rig, walked on borrowed idle, walk and run clips, with the troops’ hit, die, kneel and taunt clips and the Meshy shoot and punch clips. Who is aboard: stormtroopers, Death Star troopers and gunners, officers, a detention officer, scanning crew, TIE pilots, Vader, Tarkin, Motti and Tagge (DS1), Jerjerrod, the Emperor and his Royal Guards (DS2), Leia, Luke, Han, Obi-Wan, Threepio, Artoo, mouse droids (one of them G7), a GNK droid, an R5 and the IT-O interrogator. Chewbacca, the dianoga, the Royal Guard and a better Tarkin are asked of the desktop’s gen3d; until they come, Chewbacca and the dianoga are built in code and the Royal Guard is the senate guard in red.

Brains are built on `src/lib/ai`: perception (sight cone, hearing shots and alarms, seeing takes time), utility choices in a fight (hold, take cover, flank, advance, fall back, search), squads with shot tokens (at most three firing at you at once), and a shared search where you were last seen. They walk real paths through doors and lifts (`nav.js`) and never through walls. Out of a fight they keep a routine: a patrol round, a post, a console, a chat, a march; mouse droids scurry and flee a Wookiee’s roar.

The station’s security (`alarm.js`) rises by section: wary when something is odd, alert when someone is seen doing what they shouldn’t (the intercom names the place), lockdown seals blast doors and calls squads, hunt sends them to search, and it stands down after a while unseen. A Rebel in armour is disguised (`disguise.js`): running, shooting, walking a prisoner without orders, a restricted room or an officer’s close look raises the garrison’s doubt; helmet off is seen at once.

### Fights

Blasters fire bolts that fly, stop at walls with sparks and scorches, and can be dodged. Guns heat and vent (E-11, DL-44, DH-17, A280). Hits stagger, knock down or kill; you heal when out of the fight. With a lightsaber you strike, guard, parry and deflect bolts; the Force pushes, pulls and distracts (Obi-Wan’s noise down a corridor, the mind trick); Vader chokes; the Emperor’s lightning is blocked with a saber or not at all.

### The stories

Each is a chain of steps the free roam keeps running around.

- **DS1, Rebel, “That’s no moon”:** hide in the Falcon’s smuggling holds through the scan; take two troopers’ armour; Docking Control 327 (“TK-421, why aren’t you at your post?”) and Artoo at the scomp link; as Obi-Wan, cut the tractor beam’s power at its terminal past the guards; the prisoner transfer from cell block 1138 into AA-23, and Han’s intercom; cell 2187 (“Aren’t you a little short for a stormtrooper?”); the garbage chute; the compactor, its dianoga and its walls, until Threepio answers; the chasm and the swing; back to the bay, Vader and Obi-Wan, and the run to the Falcon.
- **DS1, Imperial, “Intruder alert”:** you are a stormtrooper in Bay 327 as the freighter comes in; escort the scanning crew; find out why TK-421 doesn’t answer; answer AA-23’s emergency; sweep the compactors and the core shaft; then Vader’s order to let them go, and put the homing beacon on the Falcon. Free roam opens the conference room and the overbridge, where Alderaan’s countdown plays.
- **DS2, Rebel, “The Emperor’s Tower”:** as Luke, given up to Vader; the lift up the tower; the throne room, the Emperor and his window on the battle; the duel, hiding under the stairs, the lightning; carry Vader to the shuttle; the mask; out as the reactor goes.
- **DS2, Imperial, “Fully armed and operational”:** clear ST 321 in; stand in the ranks in Hangar 272 as the Emperor arrives (don’t move); the command centre and “Fire at will, Commander”; the reactor breach, and a way off before it goes.

### Easter eggs

Each has an achievement: the trooper who hits his head on a door in Docking Control 327; TK-421’s armour; G7, the fastest mouse droid in the fleet, to race; a mouse droid fleeing a roar; the transfer form from cell block 1138; 3263827 on the compactor’s hatch; Han’s conversation on the intercom; “Aren’t you a little short…” with the helmet on; Krennic’s empty chair; talking back to Vader in the conference room; the dianoga’s eyestalk; the librarian watching the security camera; the robe on the floor of Bay 327; Luke’s lightsaber on the throne’s armrest; “It’s a trap!” heard in the command centre’s chatter; Jerjerrod’s nameplate; Han’s charge down the corridor and back; the exhaust port’s maintenance note; the plans at a terminal; the mind trick on two guards.

## The look

Glossy black floors, grey panels, the wall light grids, red alert light: that is the Death Star, and the build is judged against film stills. Walls and floors are `deathstar/plating.js`’s procedural Imperial plating at the tier’s size, worn with CC0 scans (ambientCG MetalPlates015–017, MetalWalkway, Grate, added through `scripts/data/hq-assets.json`, normals as KTX2), light grids and consoles emissive with animated Aurebesh screens, bloom from `rt.gfx.post`, and each room’s own reflection probe made once when it is built so the floors reflect its lights. A room keeps to the tier’s lamp budget; light comes mostly from its emissive panels. Big rooms (Bay 327, Hangar 272, the core shaft, the throne room, the superstructure) get haze. The house look (`houseOn`) applies.

## HD exteriors

- **DS1:** Quiznos323’s Death Star (CC BY-NC-SA 4.0, already on the site) re-exported from its 4096 maps as `death-star.hq.glb`, with a new 4096 detail normal map baked from the procedural plating (the source normal is nearly flat), loaded on high and ultra detail through `models.js`’ HQ pattern. `death-star.glb` stays for mid and low.
- **DS2:** N8’s Death Star II (CC BY 4.0, already credited for Endor’s sky) replaces the 512-pixel model as `deathstar2.glb` (2048) and `deathstar2.hq.glb` (4096), with a new LOD.
- Shown in the galaxy (Yavin, Alderaan, Scarif, Endor), Endor’s and Scarif’s skies, and from inside. Credits through `modelCredits.json` and `npm run credits`.

## UI, entry and saves

The start screen picks the station, the side and (for Rebels) who you are, and offers the story or free roam. The HUD shows health, the gun’s heat, the objective, the section’s security, prompts, subtitles and a blueprint map that fills in as you go. Touch gets a stick, a look pad and buttons. The save is `tp-deathstar-inside`, version 1, through `rt.saves`: story progress, rooms seen, eggs found, settings. Deep links: `/deathstar/inside?station=ds2&side=imperial&at=hangar272`.

## Budgets

Per tier, measured with `renderer.info`: draw calls 300 desktop, 150 phone; triangles 750k and 300k; texture memory 256 and 128 MB; animated people near you 24 high, 14 mid, 8 low (others idle cheaply or hide). `WORLD_MB['/deathstar/inside']` is set from what the first room needs plus the cast, and phones are asked before a download over 3 MB.

## Phases

All on the branch `claude/deathstar-inside`, each phase a commit series that passes lint, test, build and health on its own:

1. **Foundation:** the library moves and `worldAt`, the route and its registries, the module, layout, walker, doors, lifts, camera, streaming, the kit, the player, Bay 327, its control room, corridors and a lift; the start screen and HUD.
2. **People and fights:** figures, brains, nav, alarm, disguise, combat and its effects, talk.
3. **DS1 whole:** every DS1 room and both DS1 stories.
4. **DS2 whole:** every DS2 room, both stories, saber duels and the Force.
5. **Eggs, voices and sound.**
6. **HD exteriors and the ways in.**
7. **Proof:** budgets on every tier, a phone pass, a bot that plays each story through, the hand-off and docs.

## Testing

Rules are tested first, in Node: the graph validator over both stations; walker edge cases (a corner, a doorway edge, a ledge, a lift arriving); nav finds a way through doors and refuses locked ones; alarm and disguise transitions; brains in seeded simulations (a squad takes cover, a search ends, a patrol keeps its round); combat (heat, bolts stopped by walls); every story chain played through by a script; every conversation validates; every egg can fire. The scene is checked in Chromium through dev hooks (`window.__deathstar`): a canvas draws each room with no console error, screenshots of each room judged against stills, `renderer.info` under budget.

## Standing rules that apply

British spelling, curly quotes, plain sentences, comments that say why; no TODO notes; files under 800 lines; rules pure and tested first; every scene from the device tier, lowered under pace, loaded only when near, disposed on leave; every model through `lib/three/gltf.js`, every texture through `lib/three/textures.js`; no runtime calls to asset services; every asset committed and credited; keys never printed; new models through gen3d issues and voices through voices issues; never edit files in another open PR (#540 holds `pages/DeathStar.jsx`, so the page’s button waits for it).
