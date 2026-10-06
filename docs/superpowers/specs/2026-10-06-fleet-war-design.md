# Fleet war: massive battles at a front you can move: design

Date: 2026-10-06. Status: approved by the user in conversation; built in
five PRs (A–E below), each merged once CI is green.

## Intent

What the user said: “Make it so we can fight massive battles in the
universe like Star Destroyer. Like Star Wars Battlefront 2, the ship
assault game. Find the models online and make them or check with the
custom model generator. We wanna make it high quality. Also make it so if
we are going in super speed that if we hit the rocks we get shield damage.
Fix the coronal ejection disk thing, it looks bad.” Then, answering the
design questions: a fixed front “where we can influence the galactic map”,
“same with Rick and Morty, like the Federation vs the Council of Ricks”;
every crew gets its own war; Battlefront 2’s Fleet Assault objectives;
about 32 fighters a side; pick a side at each front; Breaking Bad’s war is
Gus’s empire against the cartel.

What that means here: the universe map (`src/components/universe/`) has
fights already, but small ones: a pack of hunters after you, a lone Star
Destroyer that drops in and launches three TIEs (`setpieces.js`),
someone else’s skirmish (`skirmish.js`), the Citadel’s siege
(`siege.js`). None is a battle: no fleets, no objectives, nothing that
lasts beyond the fight. Done looks like this. Each crew’s universe has a
war between two sides, fought along a line of sectors out in deep space.
Where the two sides’ sectors meet is the front, a battle always going on:
two fleets of capital ships trading turbolaser fire and some sixty
fighters dogfighting between them. Fly there, pick a side, and play
Battlefront 2’s Fleet Assault: knock out the enemy flagship’s shield
generators, then its bridge, then its reactor, while your own flagship
takes bomber runs. Win and your side takes the sector and the front moves
on; lose and the other side pushes back. The nav map, and for Star Wars
the galaxy’s holotable, show who holds what.

## Decisions

Made with the user (the questions above), or for them where they left it
open.

- **One war per side, as data.** `universe/wars.js` (pure, tested) holds
  each side’s war the way `sides.js` holds the side: its two factions
  (names, colours, lasers, fighters by role, capital ships), its sectors in
  order from one faction’s home to the other’s, and the crew’s lines. The
  three wars:
  - Star Wars: the Rebel Alliance against the Galactic Empire. Sectors
    Yavin, Hoth, Bespin, Endor, Scarif, Mustafar, Coruscant (each one of
    the galaxy’s systems, so the holotable can show it). Nothing after
    Return of the Jedi (the standing rule).
  - Rick and Morty: the Council of Ricks against the Galactic Federation.
  - Breaking Bad: Gus Fring’s empire (Los Pollos Hermanos and Madrigal)
    against Don Eladio’s cartel. The DEA stays where it is, a hunter that
    comes after you.
- **The war’s state is a front on a line.** `universe/war.js` (pure,
  tested): sectors 0…n−1, side A holds 0…f−1 and side B holds f…n−1. The
  side that won the last battle attacks (A first). The battle is fought over
  the defender’s sector on the front: `f` when A attacks, `f−1` when B
  does. The attacker takes it on a win. Taking the enemy’s last sector wins the war: a victory
  moment, and then the war starts again from the middle. The state is kept
  per visitor (`localStorage`, `tp-war-<side>`, read and written in
  try/catch). It isn’t shared online: every pilot’s war is their own.
- **You pick your side at the front.** You arrive and choose which side to
  fly for, the way Battlefront asks. The sim treats you as one more fighter
  on that side: the other side’s fighters and point-defence come after you,
  your own side’s don’t. Your side’s wins move the front.
- **A battle is Fleet Assault.** The defender’s flagship has three phases
  of objectives, each a subsystem at a point on its hull:
  1. two shield generators (while either stands, the shield bubble is up
     and nothing else on the flagship takes damage)
  2. the bridge
  3. the reactor; when it goes, the flagship breaks in two and the
     attacker wins
  The attacker loses when its tickets run out (each side starts with 150;
  a fighter down costs one) or the battle clock (12 minutes) runs out. The
  AI’s bombers make slow progress on the objectives by themselves, so a
  battle you only watch still moves; your own shots count for much more.
- **The battle is its own tested engine, not the hunt’s.**
  `hunterRules.js` flies a pack at one prey. A battle is many against many,
  so `universe/battle.js` (pure, tested) is a new sim:
  - fighters with roles: fighters dogfight with lead pursuit, overshoot
    breaks, jinks when someone’s on their tail, and steer round capital
    hulls; interceptors go for bombers first; bombers fly torpedo runs at
    the current objective and pull out
  - capital ships with turbolaser batteries that fire at enemy capitals,
    and point-defence that fires at fighters in range
  - bolts that are real: each one swept against what it could hit
  It reuses `targeting.js`’s `sweptHit` and the hull shapes in
  `galaxy/world.js`’s `HULLS`. Its face is the skirmish’s
  (`targets`, `hit(from, to, damage)`, `update(dt, you) → events`), so
  the scene wires it in the same places.
- **About 32 fighters a side**, from the device tier: 32 on a strong
  desktop, 20 on a middling one, 10 on a phone. Three or four capital ships
  a side.
- **Drawing it is cheap where it can be.** `universe/battleScene.js` draws
  the sim:
  - the capitals through `galaxy/models.js`’s slots (LOD and stand-ins)
  - the fighters: the nearest ten or so as full models; the rest as the
    galaxy’s LOD meshes (`public/models/galaxy/lod/`, one vertex-coloured
    mesh each), instanced, one draw per kind
  - bolts in one instanced draw
  - explosions from a pooled flash-and-sparks system
  - the flagship’s shield as a fresnel bubble that ripples where it’s hit
  - holo markers over the objectives
  - fire and smoke where a subsystem has gone
  - the flagship’s end: a chain of explosions down its length, then two
    copies of the model cut by clipping planes, drifting apart
- **The front is a place on the map.** It sits at its war’s contested
  sector in deep space. It has a name card like the wonders’ (“THE FRONT ·
  Battle of Endor”) and a glow of fire seen from far off. The nav map draws
  the war’s line of sectors in each side’s colour with the front marked,
  and the autopilot can take you there. Inside the battle zone the pulse
  drive is held down (as interdiction does) and the director waits.
  Leaving the zone pauses the battle; coming back resumes it.
- **Influencing the galactic map.** For Star Wars, the galaxy’s holotable
  (`galaxy/HoloMap.jsx`) tints the systems that share a name with a
  sector by who holds them.
- **High-quality models, found or made.** The Star Wars capitals come from
  Sketchfab under CC BY: Daniel Andersson’s Imperial II Star Destroyer
  (240k triangles), MC80 Home One (198k) and Nebulon-B (328k). They’re
  brought down to about 100k triangles and 2K textures by
  `scripts/sketchfab-import.mjs`, credited in `src/data/modelCredits.json`
  and loaded only when a battle is near. Phones keep today’s smaller
  models. The fighters are the galaxy’s existing models. Rick and Morty’s
  and Breaking Bad’s capitals don’t exist anywhere to download, so the
  model generator (Meshy, `scripts/meshy.mjs`) makes them, after the scout
  (`model-scout.mjs`, on its own branch) has checked Sketchfab first.
- **Rocks hurt at super speed.** `universe/rockHits.js` (pure, tested)
  takes a field’s rocks (centre, radius), hashes them into a grid and sweeps
  the ship’s path from last frame to this one against them. The fields
  are:
  - the home belt (turning: the path goes into the belt’s frame first)
  - deep space’s two debris streams
  - the rim
  Each field’s placement becomes a pure function that both the mesh and the
  collider read, so the collider is never out of step with what’s drawn.
  Above the boost, a hit takes shields: more the faster you’re going and
  the bigger the rock, at most 45 a hit. It shatters the rock (gone for a
  minute), shakes the camera and knocks the ship out of pulse and super
  speed. At the boost or below it’s a bump, no damage.
- **The flare’s ejection, redone.** Today’s `setpieces.js` flare is one
  sphere with a flat additive material, drawn from both sides: from outside,
  a flat disc of one colour that grows until it fills the sky. In its
  place:
  - a coronal mass ejection: a cone of plasma, about 70° across, launched
    from the star’s limb toward the ship. It is three nested sphere caps,
    each with a shader of moving fbm filaments, a bright fresnel leading
    edge, a white-hot to gold to deep-red ramp, and edges that fade.
  - prominence loops that rise off the limb as it erupts
  - the star’s glare as before
  The shockwave’s arrival and its hit on the shields are unchanged.

## Out of scope

- Shared, online wars (every pilot’s front is their own). The battle’s
  rules are deterministic given a seed, so a later lane could sync it.
- Ground battles and boarding.
- New fighter models (the galaxy’s are used as they are).

## Delivery

- **PR A — the ejection and the rocks.**
  - `setpieces.js`’s flare rebuilt, with its shader pieces in a new
    `cme.js`
  - `rockHits.js` and its tests
  - the placement functions pulled out of `belt.js` and `deepspace.js`
  - the scene wiring, and the crew’s line on a hit
- **PR B — the battle and the Star Wars front.**
  - `wars.js`, `war.js` and `battle.js`, with tests
  - `battleScene.js`
  - the HUD (`BattleHud.jsx`): the phase banner, objective bars, tickets,
    the clock, the side picker, and the end card with the war’s strip
  - the front on the map and the nav map
  - the holotable’s tint
  - the crews’ lines
  - a check script (`scripts/battle-check.mjs`) that forces a battle and
    takes screenshots
  - the existing Star Wars models, so it plays before the new ones land
- **PR C — the high-quality Star Wars capitals.** The imports, the
  credits, and the battle switched to them on desktop.
- **PR D — Rick and Morty’s war.** Its data, its Meshy capitals and its
  lines.
- **PR E — Breaking Bad’s war.** Its data, its Meshy capitals and its
  lines.

## Testing

- Pure modules first, tests before code:
  - `war.js`: the front moves; the war is won and resets; the save
    survives a missing or bad entry
  - `battle.js`:
    - a fighter turns onto a target and fires inside its cone
    - bolts hit and kill
    - tickets fall
    - phases advance only in order, and the shield stops damage while it’s
      up
    - bombers reach their objective
    - a battle left alone ends within its clock
    - the player is targeted only by the other side
  - `rockHits.js`: a fast sweep through a rock hits it; a sweep beside it
    doesn’t; a rock in the turning belt is hit where it’s drawn
- `npm run lint`, `npm test` and `npm run build` before every push.
- In a browser: `scripts/battle-check.mjs` forces a battle and a flare
  (through `window.__universeDebug`) and takes screenshots, and they’re
  looked at. Frame time is measured at the mid tier with 64 fighters up.
