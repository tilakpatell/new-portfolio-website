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

## Revision: battles as shared events in the universe

Date: 2026-10-06, after PR B (#315) merged. The user said: “The battle is not
a game but in the universe itself and as events. Make it robust. Make the
battle multiplayer compatible. Make sure ship scaling is correct. A capital
ship should be huge but planets are bigger, so our ship, then the capital
ship, then the planet.” They approved this reading.

- **No game layer.**
  - The side picker, the Victory/Defeat card and the Battlefront ticket bar
    all go.
  - You're simply in the battle on your crew's side. The war's first side is
    the crews' own: the Rebels, the Council, Gus.
  - A one-line status, in the Citadel siege's style, says what's going on.
    The crew's lines carry the rest.
- **Battles are events on a shared clock.**
  - Each war's battles start at the front on a fixed wall-clock schedule:
    every 15 minutes, 12 of fighting and 3 of lull. The schedule is counted
    from a weekly epoch, when the war starts again from the middle.
  - When one starts, the crew calls it out and the nav map marks it. It's
    seen from far off and fought within sight of it.
- **Shared by every pilot online.**
  - The AI's progress on the objectives is a scripted curve, seeded by the
    battle's number. Every pilot's battle advances alike.
  - Your damage on the objectives is shared through the Citadel siege's
    model (`battleNet.js`). Each pilot speaks for their own share, and the
    totals are merged and taken as the largest anyone's heard of.
  - A battle's outcome is the same for everyone: the attacker wins if the
    reactor falls before the fight's time is up.
  - Outcomes the players caused are remembered and passed on, as the set of
    battle numbers players won. The front is replayed from the week's
    battles. A pilot who wasn't there learns of those battles from anyone
    who was.
  - The dogfighting itself stays each pilot's own spectacle.
- **One scale for every ship.** `shipScale.js` (tested) puts a ship's length
  in map units from its real one, the X-wing's 12.5 m to the ship's 0.26
  units. That gives the Star Destroyer about 33 and the MC80 about 25.
  - Capital ships are capped below the smallest world's diameter, and no
    smaller than a station is to the ship.
  - The traffic's Star Destroyer (11) and the director's (16) move to the
    same table as the battle's.

## Revision 2: the Galactic Civil War, in the galaxy

Date: 2026-10-06. The user said: “Make it so the Star Wars battles happen in
the Star Wars universe, accurate to the planet. You can't have a Battle of
Endor with no Endor (think Helldivers). And more ships, and crazy, unique
things to do in the battles.” They chose: the Star Wars war lives in the
galaxy (`/galaxy`), and all four kinds of set piece (Endor, Hoth, Scarif, and
a hangar run anywhere). This supersedes the Star Wars front on the universe
map, and `shipScale.js` (tasks 17 to 22): the universe map keeps its wars for
Rick and Morty and Breaking Bad (PRs D and E), at their own real places.

### The war (`galaxy/gcw.js`, pure, tested)

- **One war, every pilot on the Rebellion's side**, against the Empire, as
  Helldivers' players are against its AI. No side to pick.
- **The map:** the galaxy's systems with a planet, but Dagobah (nobody's
  there) and Alderaan (gone). Each has a Rebel `control` from 0 (the
  Empire's) to 1 (the Rebellion's). Neighbours are the systems near it on the
  map (the nearest few, by `pos`).
- **A campaign** runs three days of wall-clock time, from a fixed start the
  same for everyone (`campaignAt(ms)`), then the war starts again from the
  opening map: the Rebels at Yavin, Hoth, Lothal, Kashyyyk and Sorgan, the
  Empire everywhere else.
- **Steps:** the campaign is worked through in 12-minute steps, from its
  start, the same for everyone: `history(campaign, until, tally)`.
  - **Liberation:** an Imperial system next to a Rebel one is a front (at
    most four at once, the campaign's seeded order picks which). Its control
    rises by the Rebellion's other fleets' seeded rate (some fronts stall,
    some go backwards) plus what players did there that step. At 1 it's the
    Rebellion's.
  - **Defence:** every four hours the Empire attacks a Rebel system that
    borders its own (a seeded pick, Hoth four times as likely), for 96
    minutes. Its control falls at the
    attack's seeded rate, and players push it back up. It falls to the Empire
    at 0; holding out to the end, it's the Rebellion's again, whole.
  - **The major order:** each campaign names one front (the set-piece
    systems first: Endor, Scarif, Hoth), shown on the war table.
- **What players do counts:** points per system per step, a shared tally.
  Each objective down is 3%, a fighter down 0.1%, and a battle won 10%, once
  however many pilots were in it.
- **Pure functions** give the war table everything: owner, control, rate,
  attack timer, the battle on now and its clock, the major order.

### Shared (`universe/tally.js`, pure, tested)

The Citadel siege's model, made general:

- Every pilot keeps their own share of each key.
- Other pilots' shares are kept as they're heard.
- The floor is the largest total anyone has told of.
- A key's value is the larger of the sum of shares and the floor.
- Shares only grow; an epoch starts everything over.
- Two tallies run on it:
  - **`war`**, keyed by system and step, epoch the campaign. Wins are keyed
    `win:<battle>`, counted once.
  - **`fight`**, the objectives' damage in the battle on now, epoch the
    battle's id.
- Both go over the wire as new actions (`war`, `fight`), rate-limited and
  checked like `siege`, and only from pilots in the same system (for
  `fight`). The war's tally is kept in `localStorage` for the campaign.

### The battles, at their planets (`galaxy/battles.js` data, `galaxy/warfront.js`)

- **Every front and every defence has a battle on**, back to back, one per
  12-minute step: 10 minutes fighting, 2 of lull.
  - The battle's id is campaign, system and step.
  - Its seed comes from the id, so every pilot's battle is laid out alike.
- **The fight is Fleet Assault** (`universe/battle.js`), now taking its own
  `lines` and `radius`, sized to its ships.
  - **Liberating:** the Rebels attack the Imperial flagship's objectives.
  - **Defence:** the Empire's bombers go for the Rebel flagship's, and
    holding out is a Rebel win.
- **Templates per system** (`battles.js`) say:
  - where it's fought, off the planet on its sunward side, clear of its
    surface and its stations;
  - which fleets, with more ships than before. Each side has a flagship
    and four to seven escorts: Star Destroyers, Victory-sized Arquitens,
    Gozantis and an Interdictor for the Empire; MC80s, Nebulon-Bs, CR90s,
    Hammerheads, GR-75s and the Ghost for the Rebels;
  - which fighters: TIEs, interceptors, bombers and the TIE Advanced, against
    X-, Y-, A-, B- and U-wings.
  - Endor's is the Executor and three Star Destroyers under the second Death
    Star; Hoth's, the Executor's Death Squadron over Echo Base; Scarif's, two
    Star Destroyers at the Shield Gate.
- **In it, not playing it:**
  - As you drop in or fly near, the crew calls it out and you're in it,
    already on the Rebels' side.
  - The world's own ambient battle there (`world.js`) steps aside while the
    war's is on.
  - Your shots, the lock and the HUD's markers work as they do for hunters.
  - The status is a line of comms and the shared numbers on the war table.
- **Scale:** ship sizes are the galaxy's (X-wing 0.3, Star Destroyer 30,
  MC80 26, Executor 110). `galaxy/fit.js` grows each planet till it's at least
  2.5 times as wide as the longest ship near it is long, and moves what's off
  its surface out with it. So Hoth is 137 across the middle, not 36, and
  Endor's moon is 175, under a Death Star 140 wide. Fleets keep their
  formation, and everything is as far off the surface as before.

### The war table (`HoloMap.jsx`)

Helldivers' galactic map on the holotable:

- each system ringed in its owner's colour;
- a front's liberation as an arc, with its rate (+3.1%/h);
- a defence's timer and how much is left;
- the major order;
- the battles on now, with their clocks;
- how many pilots are in each.

Picking a system shows its war card (owner, control, the battle on, what
it's for), and Jump takes you to the fight.

### The set pieces (PR G)

- **Endor**
  - The second Death Star's superlaser fires at a Rebel cruiser every couple
    of minutes, and kills it.
  - The shield generator is on the moon's surface. It's a target: knock it
    out and the station's shield (`world.js`'s) drops.
  - The Executor's bridge is the flagship's.
  - With the shield down, the reactor run: into the Death Star through a
    superstructure tunnel (`galaxy/tunnel.js`, a flown tube with walls that
    hurt), the reactor at its heart. Out before the blast.
- **Hoth**
  - The ion cannon fires on the Star Destroyers; one it hits is disabled for
    20 seconds (its guns quiet, its shield down: a window for its objectives).
  - GR-75 transports run from the planet for the jump point, and the
    Empire's fighters go for them. Each one out is a share of the win, and
    the battle's won when enough are out.
- **Scarif**
  - The Shield Gate is shut while the shield's up. Disable the Star
    Destroyer *Persecutor* (its objectives), and the Hammerhead rams it into
    the *Intimidator*, and both fall on the gate. The gate goes, the shield
    drops, and the plans go out: the Rebels win.
- **Anywhere**
  - A Star Destroyer's hangar run: when its shield's down, fly into its belly
    hangar, down a short tunnel to its reactor, shoot it, get out; it breaks
    up.
  - Hull trench runs: along a capital's spine, its turrets are targets in a
    row as you fly it.

### Out of scope (revision 2)

- A server.
  - The war is everyone's from the shared clock and the shared tally.
  - Pilots who haven't heard of a contribution see the AI's war until they
    do.
  - Divergence is bounded to what wasn't shared, as with the siege.
- Ground battles (the surface missions stay as they are).
- The sequel trilogy.

## Revision 3: the war, played

Date: 2026-10-06, after the set pieces (#338). The user asked:

- Battles on the universe map too, faction by faction: Star Wars kept to
  itself, then Rick and Morty, then Breaking Bad. That comes after this
  revision.
- "The bloom is a lot: reduce it, make it high quality."
- "We already have a Death Star: use that model and do stuff with it."
- "We have a system to generate anything on my PC (gen3d): use it if you
  need ships."
- "Power-ups and a heal ability in the space battles."
- "If we die, spawn us back behind the side we chose."
- "Better targeting and ship-to-ship combat, various enemy types, and
  unique weapons based on the ship."
- "When we join, let us choose a ship or what we want to play: a capital
  ship and strategy, or in the ships. Think big scale."

They chose:
- **Either side:** you pick the Rebellion or the Empire as you deploy.
- **Full fleet command:** a tactical camera, the helm, focus fire,
  broadsides, abilities, squadron orders, shared online, and a fighter to
  drop into at any time.

The understand pass's maps are the evidence for what follows (the
session's `gcw-understand` workflow). Rules live in pure, tested modules.
Each part is its own PR, merged when green, in this order.

### H — the look: bloom, kept high quality

- **The bloom is the galaxy's own.**
  - `createPost` takes `opts.bloom`: strength, radius, threshold, knee,
    per-mip tints, and the size's cap and small scale. `BLOOM` stays the
    default, so `/universe`, the surfaces and Cybertron look as they do,
    and `post.test.js` holds.
  - `post.bloom(profile)` eases between profiles.
  - The galaxy's: strength 0.55, radius 0.3, tints [1, 1, 0.8, 0.5, 0.3],
    cap 960.
  - In a battle: strength 0.45, radius 0.2. `flare()` is capped at 1.15
    while a battle's shown.
- **The bright pass:**
  - A soft-knee subtractive threshold (only what's past the gate glows, by
    as much as it's past).
  - A 4-tap box downsample with a Karis average (no fireflies from a
    flash's core).
  - Each texel clamped at 16.
- **HDR by luminance, not raw RGB:** `hdr(hue, lum)`.

  | What | Luminance |
  | --- | --- |
  | Fighter lasers | 2.6 |
  | Turbolasers | 3.2 |
  | Torpedoes | 3.5 |
  | Flak | 2.0 |
  | Engine glows | 1.3–1.5 |

  This applies to every side, so the Empire's green no longer outshines
  the Rebels' red.
- **Two-layer bolts:**
  - A whitened core over the gate.
  - A sheath three to four times as wide, in the side's hue, under the
    gate. The glow is geometry, crisp at any resolution.
  - Your own shots get the same look.
- **Flashes:**
  - The core's peak luminance goes from 8.2 to about 5.4, and `bright` is
    capped at 1.2.
  - They dim near the camera, as bolts do.
  - A fighter's events get smaller flashes.
  - At most 8 impact flashes at once.
- **Engine glows** fade by their size on screen instead of a 1.5 px floor
  at full brightness. Their scale is in device pixels.
- **Set pieces:**
  - The tunnels' wall strips sit under the gate; only the mouth ring and
    the reactor core glow.
  - The superlaser is a core and sheath.
  - The ion slugs are smaller.
- **The Death Star GLB:** its laser materials (emissive strength 10)
  are clamped, or hidden until it fires.
- **Measured, not eyeballed:** the browser checks report two numbers.
  - The black-level veil: the mean luma of the darkest half of pixels, at
    most 1.3 times the system without a battle.
  - The share of pixels above 0.9 luma: under 1.5% outside flash frames.

### I — fighting as a pilot

- **Your craft is not your crew.**
  - The crew (Comms, the cockpit, the voices, `tp-universe-ship`) stays
    as it is. The craft you fly in a battle is its own choice, kept under
    `tp-galaxy-craft`, on main's `heroes.js` pattern.
  - Rebels:
    - your crew's ship (X-wing, Falcon, the cruiser, the RV);
    - the A-wing, Y-wing, B-wing and U-wing.
  - Empire:
    - the TIE fighter, TIE interceptor, TIE bomber and TIE Advanced;
    - the TIE Defender, once its model lands.
  - A craft is stats (speed, agility, shields, regen) plus a primary
    weapon, a secondary and an ability. Non-crew craft fly the galaxy's
    MODELS GLBs through a `buildShip` path.
- **Weapons per craft.** `weapons.js` is the one source; CADENCE,
  BOLT_COLOR and PLUME move into it.

  | Craft | Primary | Secondary |
  | --- | --- | --- |
  | X-wing | linked lasers | proton torpedoes (a 1.2 s lock, 4) |
  | A-wing | rapid lasers | a concussion salvo (6) |
  | Y-wing | lasers | an ion cannon, and proton bombs on capitals |
  | B-wing | heavy lasers | an ion cannon, and torpedoes (slow, tough) |
  | U-wing | lasers | cluster missiles |
  | Falcon | a quad turret that aims itself at the nearest threat | concussion missiles |
  | TIE fighter | fast twin lasers | — |
  | TIE interceptor | quad lasers, and a faster lock | — |
  | TIE bomber | — | proton bombs and concussion missiles |
  | TIE Advanced | heavy lasers | cluster missiles |
  | Cruiser, RV | their crews' own arsenals | |

  - The Y-wing's and B-wing's ion cannon disables a fighter, or a
    battery or objective on a capital, for a moment (`battle.disable`).
  - Guns overheat, Battlefront-style, rather than having a pure cadence
    (main's `surface/weaponRules.js` heat and vent).
  - The galaxy gets the universe map's armory, bolt pool and missiles
    through a shared `universe/guns.js`.
  - Battle damage has its own scale, so a heavy round doesn't one-shot an
    objective.
- **An ability on a cooldown, per craft.** H, or a touch button.
  - Repair: +40 shields over 2 s, every 25 s. That's Artoo in the X-wing,
    Chewie in the Falcon, Rick's gadget, Jesse's patch.
  - Evasive boost: TIEs.
  - Overcharge: the Advanced.
- **Power-ups** (`galaxy/powerups.js`, pure, tested, drawn instanced and
  warmed):
  - Repair, shield cell, rapid fire (cadence ×0.6 for 15 s), overcharge
    (damage ×2 for 15 s) and ammo.
  - They drop from 20% of your kills and from every objective.
  - Field drops at seeded points on the battle's clock are shared: one
    taken is a `pu-<n>` key in the fight tally, gone for everyone.
  - A buff lies over `state.stats`, never changing it. The name is
    `powerup`, since "pickup" is a Breaking Bad truck.
- **Respawn behind your line.**
  - `battle.home(team, k)` (pure, tested) is behind the line, out of
    `avoid` and the hulls, facing the enemy.
  - Shot down in a battle you were in:
    1. The deploy card comes up for 4 s, where you can change craft.
    2. You come in out of hyperspace at the rally point, with a hard cut,
       not a swoop.
    3. You're protected for 4 s: no damage, and the AI lets you be.
  - Hunters aren't cleared while a battle's on.
- **Targeting.**
  - T and Q cycle as now.
  - Y locks the nearest attacker.
  - U locks the current objective, which locks from further off.
  - A touch Target button; the war's targets are in tap-to-pick.
  - Five threat arrows, and a direction indicator for where a hit came
    from (battle `hurt` carries its origin).
  - Enemy capital hulls become targets too.
- **The battle HUD:**
  - the battle's name, the phase's objective and the clock;
  - both sides' tickets and both flagships' hulls.
- **Enemy types** (battle.js traits, by FIGHTERS `trait`, `weapon` and
  `damage`, the last of which is now read):
  - aces (Vader's TIE Advanced: hunts you, tough, called out);
  - TIE Defenders (fast, ion; flown as an interceptor until the model
    lands);
  - assault gunboats (hold off, fire missiles);
  - strafing bombers (go for batteries).
  - They come in by phase. The Rebel AI gets its own (B-wings on
    capitals, aces) for when you fly for the Empire.

### J — sides and the deploy card

- **The deploy card** comes up when a battle starts in your system (and
  you're not mid-fight) and on every death. You pick:
  - the side;
  - the role: pilot (and which craft), or command (and which capital).

  A frozen page stops the battle, so the card is its own `deploying`
  state.
- **Empire points push control down.**
  - Keys are split by side: `r:sys:step` and `e:sys:step`, and wins
    `win:r:…` and `win:e:…`. The old keys read as the Rebels'.
  - Imperial wins are counted once.
  - The war table's major order has an Imperial mirror ("Hold Endor").
- **Online:**
  - The hello carries side, role, craft and seat.
  - Same-side pilots are allies: no friendly fire.
  - Pilots draw non-crew craft through `fleet.make`, sized from FIGHTERS.
  - The galaxy sends weapon codes and damage on the wire.

### K — fleet command

- **Seats.**
  - The first commander on a side takes the flagship; the next take
    escorts. Seats are deterministic from the sorted peer ids of the
    side's commanders in the system.
  - Set-piece ships (the Executor diving, the ram's three) can't be
    commanded while their set piece has them.
- **The tactical camera.**
  - It orbits the battle, framed from `laid` (at, radius).
  - You pick by tap or click, with the capitals and squadrons projected.
  - Your fighter is parked, out of the sim.
- **The helm:**
  - `battle.steer(cap, { throttle, turn, climb }, dt)` at capital speeds,
    keeping its separation and out of `avoid`.
  - The AI capitals use the same helm (hold the line, close to turbo
    range, turn their broadside).
  - The fighters' leash and spawns follow the ships, not the old line.
- **Fire.**
  - Focus a target: a capital, an objective or a battery.
  - A broadside fires only the batteries that bear.
  - Bolts carry an owner, so the commander's damage counts in the war
    (with a `commandShare`).
- **Abilities** (each on its own cooldown):

  | Ability | Cooldown |
  | --- | --- |
  | Ion barrage (the target disabled for 10 s) | 60 s |
  | Torpedo salvo | 45 s |
  | Launch a squadron (four fighters from the hull) | 60 s |
  | Damage control (+15% hull) | 90 s |
  | Micro-jump | 120 s |

- **Squadrons.**
  - Rebels: Red, Gold, Green and Blue.
  - Empire: Black, Obsidian, Onyx and Saber.
  - Orders, each with a timeout:
    - attack my target;
    - escort my ship;
    - screen the line;
    - free.
- **Online:**
  - A `cmd` action `{ b, s, c, o, t, k }`, with its own RATES entry, from
    the same place only. Orders are idempotent by battle clock.
  - Capital hulls are shared through the fight tally (`hull-<i>`), so a
    ship goes down for everyone.
  - Commanders send no pose.
- **Launch:** drop from command into a fighter at your capital's hangar,
  and back.

### L — the Death Star

- **Fit the model.** Fix `normalise` for skinned meshes, so the GLB's
  hull fills its size, centred. Re-check Yavin's trench band, Alderaan's
  tractor and Scarif's beam origin.
- **The Battle of Yavin**, when the Empire attacks Yavin. The GCW raises
  the odds of that, as it does for Hoth.
  1. The Death Star comes round the gas giant.
  2. Phase 3 is the exhaust port: a trench laid over a stretch of the
     hull, which is cut open there.
  3. The ship's kept in the channel, with Vader and his wingmen on your
     tail.
  4. The port takes a torpedo in its window.
  5. The station goes up, and that's the win.

  Boarding on contact is off during the run. The X-wing cockpit's
  targeting computer shows the trench.
- **Scarif:** when the gate falls, the GLB Death Star drops out of
  hyperspace and fires on the planet, from its real dish, during the
  war battle (the ambient 150 s cycle is held).
- **Endor:**
  - The second Death Star is drawn from the GLB, with the unfinished bite
    cut away by UV and the code-built girders and core inside.
  - It keeps the `deathstar2` id and its hooks.
  - Its spin is held during the war, and the superlaser fires from the
    dish.

### M — new ships

- **gen3d** (an issue labelled `gen3d`, made on the PC) for fighters and
  big-feature hulls:
  - the TIE Defender, prompt-only first;
  - the assault gunboat;
  - the Hammerhead, from pictures;
  - later, the Rick and Morty and Breaking Bad capitals.
- **Sketchfab or Meshy** for greebled capitals (PR C's Imperial II, Home
  One and Nebulon-B), which gen3d turns into blobs.
- **Wiring a model:** a MODELS entry, a STAND_IN, a LOD
  (`galaxy-lod.mjs`, taught gen3d URLs), the war kinds, and WIDTH.
- **The runner's three-cut bug** (only the mid cut committed) is that
  lane's to fix. Until then, point new kinds at the plain URL.

### Out of scope (revision 3)

- Universe-map battles (task 14, the next revision).
- A server.
- Voiced recordings of the new lines, which go through the voices runner
  later.
