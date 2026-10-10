# The war, played: the look, the pilot, the deploy card, fleet command and the Death Stars

Date: 2026-10-10. Written against main at `544559ae`, after a gap map of
what main already has (the session’s `gcw-gap` workflow). It replaces the
“Revision 3: the war, played” draft written on 2026-10-06 against a main
2,649 commits older, which planned much of what other lanes have since
built.

## What the owner asked

- “The bloom is a lot: reduce it, make it high quality.”
- “We already have a Death Star: use that model and do stuff with it.”
- “We have a system to generate anything on my PC (gen3d): use it if you
  need ships.”
- “Power-ups and a heal ability in the space battles. If we die, spawn us
  back behind the side we chose. Better targeting and ship-to-ship combat,
  various enemy types, and unique weapons based on the ship.”
- “When we join, let us choose a ship or what we want to play: a capital
  ship and strategy, or in the ships. Think big scale.”
- After this: battles and factions on the universe map too (Star Wars kept
  to itself, then Rick and Morty, then Breaking Bad).

They chose: either side can be flown when you join; full fleet command for
a capital ship (a tactical camera, the helm, focus fire, broadsides,
abilities, squadron orders, shared online, two commanders sharing a fleet,
and a fighter to drop into at any time).

## What main already has (not rebuilt)

- **Sides.** You swear to a side in a war (`galaxy/allegiance.js`,
  `sides.js`, the war card’s “Fly for the …”). The Empire can be sworn,
  and the war scores for the side you swore to (`warState.js` keys by side
  code). Set pieces count your shots for the side a target is theirs to
  take (`ctx.mineAs`).
- **The shared battle.** `universe/battleDirector.js` gives every pilot in
  a system one course, one end and one winner from the wall clock. Plans
  (`galaxy/battlePlans.js`) lay objectives, zones, aces and bomber waves;
  stages are said as they open, and an end card says who won and why.
- **Fleets.** Capitals fight as fleets (`battleTactics.js`,
  `battleFleet.js`): a focus for their batteries, the final push,
  broadsides and jumping out. Fighters fly in flights of three, go home
  hurt and come back in waves (`battleFlights.js`). The fight round you
  follows how you’re doing (`battleDifficulty.js`).
- **Pickups.** Five kinds, dropped by kills, drawn spinning, flown through
  (`galaxy/pickups.js`, `pickupFx.js`), with chips on the HUD and dots on
  the radar.
- **Crew powers** on G and X with cooldown rings (`galaxy/powers.js`,
  `battlePowers.js`), and they reach the war’s battles.
- **The Shipyard** in the galaxy (H): parts, paint and builds.
- **The flight cluster and radar** (`galaxy/cluster.js`), with the lock.
- **The look** (`components/worlds/looks.js`): each world names its bloom
  in its `look.js`, and the post reads it.

## Work in flight elsewhere (not duplicated)

- **PR #793, “Space battles”** (its spec
  `2026-10-09-space-battles-design.md`): the roster (each war flies its own
  ships), wrecks, turret arcs, broadsides, salvos and capital courses on the
  shared clock (§5), AI guns per ship (ion, missile, torpedo, bomb, tail
  gun; §6), a fleet ledger every pilot shares (§7) and a Venator hangar
  launch (§9). It changes nothing of the player’s own ship. Fleet command
  here drives §5’s courses and arcs and writes into §7’s ledger, and waits
  for them.
- **PR #746, “Squads”**: no friendly fire within a team, a safe respawn,
  the seat handover rule (“two claims at one epoch: the lower seat wins”)
  and the `wire2.js` rate pattern. A `cmd` action here follows `wire2.js`.

## The design

Each part is its own pull request, merged when green, in this order. Rules
live in pure, tested modules beside the scene; `galaxy/scene.js` (2,812
lines, already over the ceiling) gets hooks only. The big-files budget is
at 30 of 30, so no touched file may cross 1,500 lines; `lint-disables`,
`kbd-styles` and `hud-kit` are at their budgets too, so new HUD cards add
no `kbd` rule (they use `src/index.css`’s `.kbd`) and no eslint-disable.

### 1. The look: the galaxy’s own bloom, kept high quality

Measured at a forced Endor battle (1600×950, the HUD hidden, the same
frame for each setting), the bloom isn’t clipping: under 0.5% of pixels are
over 0.9 luma. It is a veil. The darkest half of a dogfight sits at a mean
luma of 0.09–0.15 against 0 with no bloom. Three things make it:

- r186’s bloom adds 3 × strength × the five mips’ weights, and radius 0.55
  makes those weights nearly flat (0.56–0.64). The gain is 7.2×, and the
  1/32-scale mip counts as much as the sharpest, so it spreads over the
  whole frame.
- The bright pass passes a texel’s whole energy once it clears 1.7, not the
  part above it, with a hard edge.
- The sides’ bolts differ in luminance by up to 2.4× (the Rebels’ red 1.81,
  the Empire’s green 4.10), so the Empire’s green floods it.

The change:

- **The galaxy names its own bloom** in `galaxy/look.js`:
  `{ threshold: 1.4, knee: 0.5, strength: 0.5, radius: 0, falloff: [1, 0.6, 0.3, 0.12, 0.04] }`,
  with its `why.bloom`. `createPost(renderer, scene, camera, { small, bloom })`
  takes it; without one it is the universe map’s, so `/universe`, the
  landings and the surfaces look as they do. `falloff` is written to the
  composite’s `bloomFactors`, so the wide mips stop fogging the frame.
- **A soft-knee bright pass** that passes only the excess over the
  threshold, edited in place in the material post.js already patches (no
  new GLSL site). It samples four bilinear taps half a source texel apart,
  so a thin bolt doesn’t shimmer as it moves.
- **The bloom’s resolution** is capped at 960 on the long side on a large
  screen (up from 640), and stays a quarter of the frame when `small`.
- **Flares compose with the look.** `flare(k)` scales the look’s strength,
  and a look may cap it (`flareMax`). The galaxy caps it at 1.25 while a
  battle is on, so a boost no longer lifts the whole frame’s haze.
- **Even light by side.** A pure `glowAt(rgb, luminance)` keeps a colour’s
  hue and sets its luminance. Battle bolts: lasers 3.0, turbolasers 3.6,
  flak 2.4, torpedoes 4.8; fighter engines 1.8. The player’s own bolts take
  3.0 too (today the Falcon and X-wing shots never glow). One helper covers
  the galaxy and the universe map’s wars.
- **Flashes** fade to their rim instead of a hard disc and cool faster. A
  capital’s death flash is at most min(0.45 × size, 24) at brightness 1.0
  (the Executor’s was 77 units across at a core luminance of 10).
- **Tuning.** The galaxy’s `?debug` panel gets the bloom sliders
  (`bloomGroups`, with the knee). A user-facing glow setting is out of
  scope.
- **Measured, not eyeballed.** `scripts/galaxy-bloom-check.mjs` forces a
  battle at Endor and reads the canvas with the HUD hidden: the darkest
  half’s mean luma in a dogfight at most 0.02 (from 0.09–0.15), and pixels
  over 0.9 luma at most 0.5%. The numbers and the before-and-after shots
  go under `docs/superpowers/evidence/war-played/`.

### 2. Back in the fight: respawn behind your line

- **Where.** `battleFlights.js` exposes `homeFor(team)`: your side’s live
  carrier’s hangar, else a point behind your line, out of `avoid` and the
  hulls, facing the enemy (pure, tested). `battle.homeFor` passes it on.
- **When.** Shot down or crashed in a battle you took part in, while it is
  on: `warfront.respawn()` gives the point, and `scene.js`’s comeback uses
  it before `arrival()`. Otherwise you come back as now.
- **Safe for real.** For 4 s you are a ghost to the battle’s AI as well as
  to pilots (`ghost` passed to `war.update`, the path `battlePowers.js`
  already has), shown as a bubble chip. Firing ends it.
- PR #793’s Venator launch (§9) can later use the same `homeFor`.

### 3. Targeting and the fight between ships

- **Tap or click** a battle fighter, objective or capital to lock it
  (`pickHunter` takes the war’s targets).
- **Y** locks whoever last hit you. **U** locks your side’s current
  objective, held out to 250 units (a pinned lock: range only, no cone).
  Both are new options on `targeting.js`’s `track()`; its defaults stay.
- **Which way the hit came from.** The battle’s `hurt` event carries a
  direction; an arc fades at the screen’s edge on the side it came from.
- The keys go in `galaxy/keyRows.js` and the guide.

### 4. Power-ups and a heal

- **Battle drops.** An ace’s kill (`hitFighter` says `ace`), an objective
  and a battery each drop a pickup. Two new kinds: **amp** (damage ×1.5 for
  12 s; buffs take the larger value, never the product) and **ammo**
  (ordnance refilled).
- **Repair, the heal.** A pure `galaxy/repair.js`: 15 shields a second for
  3 s, broken by a big hit, every 30 s, as a third tile on the power bar
  (C). It takes the crews’ designs already drawn up in the overhaul’s
  powers report: Artoo in the X-wing, Chewie in the Falcon, “Keep Summer
  safe” in the cruiser, Jesse’s patch in the RV.
- **Resupply.** Shields come back faster near your side’s carrier.

### 5. Unique weapons by ship

- The galaxy gets the universe map’s armoury (`createArmory`): a secondary
  and ordnance on R and 1/2/3, homing missiles that land through the war’s
  `hit`, through a new `galaxy/arms.js`. Torpedoes are told apart from
  lasers on the way in (`by` carried through `war.hit`), so a port can
  want a torpedo.
- Each crew’s stock arsenal becomes what its name says (today all four
  fire spread and heavy): the X-wing’s proton torpedoes and ion scatter,
  the Falcon’s flak and concussion missiles, the cruiser’s and the RV’s
  their crews’ own. Objective damage per hit is capped at a quarter of the
  objective’s most (the powers’ `sub` rule), and ordnance stays off pilots.
- The AI’s guns per ship are #793’s §6.

### 6. The deploy card

- A pure `galaxy/deploy.js` says when the card comes up and what it
  offers; `DeployCard.jsx` reuses the assault card’s classes and focus
  handling, as an aria-modal that holds no keys from flight until opened.
- **On arrival** at a battle, a prompt (not modal): Enter or a tap opens
  the card. **On a death** in a battle you took part in, the card is up
  through the comeback; Enter or a tap deploys at once, and after 4 s it
  deploys your last choice.
- **What it offers:** the side (swearing, or turning coat, through the
  oath’s own `onSwear`; locked for the rest of that battle once you
  deploy), the role (pilot now; command once part 9 lands, shown greyed
  until then) and, from part 7, the craft.
- **Taking part** is set when you deploy, not by distance, so a commander
  counts.
- Under reduced motion there is no battle, so no card.

### 7. Fly your side’s own fighters

- The craft you fly in a battle is its own choice (`galaxy/craft.js`,
  stored as `tp-galaxy-craft`, on `heroes.js`’s pattern); your crew (its
  comms, voices and cockpit) stays as it is.
- The list comes from your side’s fighters in the roster (#793’s
  `rosterOf(war, side, 'fighter')`), with a model:
  - the Rebels: the X-wing, A-wing, Y-wing and B-wing;
  - the Empire: the TIE fighter, TIE interceptor, TIE bomber and TIE
    Advanced (the gen3d TIE fighter and interceptor already exist);
  - the Republic and the Separatists as the roster has them.
- A non-crew craft flies stock (no Shipyard build, the side’s paint), from
  its MODELS GLB, with its own stats and a battle tune clamped apart from
  the Shipyard’s, so a TIE interceptor out-turns a TIE bomber. The cockpit
  view falls back to the chase camera where a craft has no cab.
- The online hello carries the craft, and other pilots draw it through
  `fleet.make`.
- AI fighters of gen3d kinds load the light cut (`.lo`); only your own
  craft loads the device’s.

### 8. The Death Stars

The simulation of six campaigns has the Rebels attacking Endor in 97–238
steps and Scarif in 88–157 a campaign, and the Empire attacking Yavin in
0–24, so Scarif and Endor come first.

- **Scarif.** The 150 s superlaser cycle is held while the war battle is
  on. When the gate falls, the GLB Death Star drops out of hyperspace and
  fires on the planet from its dish (the dish’s direction in the model is
  (0, 0.351, 0.936)).
- **Endor.** The second Death Star’s spin is held during the war, its dish
  turns onto its target before it fires, and when it blows there is a
  shockwave ring and a core-and-sheath flash (a new `galaxy/stationFx.js`),
  not just the model hidden.
- **Yavin, the trench run.** The first Death Star is registered as a
  station, so the war can blow it up. A new `warpieces/yavin.js` lays the
  exhaust port in the trench with its flak and Vader’s wing on the Yavin
  template, and wants a torpedo inside the port’s window. Pinned both ways:
  when the Rebels attack, the port is their last stage; when the Empire
  attacks, it is the defender’s counter, a new `counter` end in the
  director (a no-op for plans without one). Touching a Death Star during a
  war battle doesn’t board it.
- The Death Stars’ glow (emissive 2.2) and beams are brought under part 1’s
  numbers.

### 9. Fleet command, one commander

After #793’s §5 (arcs and courses on the clock) has landed.

- **The seat.** On the deploy card, command offers your side’s capitals
  that no set piece holds. Your fighter is parked out of the battle while
  you command, and you count as taking part.
- **The tactical camera** (`galaxy/commandCam.js`) orbits the battle,
  framed from the laid battle. Fighters beyond the draw distance are drawn
  as team-coloured squadron marks, and the marks are what you pick.
- **The helm** is a set of stances, not a stick: hold, advance, flank,
  close to turbo range, and turn your broadside. Each is stamped on the
  shared clock, and the ship’s pose follows from the stances in order, the
  way #793’s courses follow from the clock. Nothing streams a pose, and a
  ship a set piece holds can’t be ordered.
- **Fire.** Focus a capital, an objective or a battery (it overrides the
  fleet’s focus); a broadside fires only the batteries that bear (#793’s
  arcs).
- **Abilities** (`universe/battleCommand.js`, pure, composed in
  `battle.js` the way `battleFleet.js` is), each on its own cooldown:

  | Ability | What | Cooldown |
  | --- | --- | --- |
  | Ion barrage | the target’s guns quiet for 10 s | 60 s |
  | Torpedo salvo | six torpedoes at the target | 45 s |
  | Launch a squadron | up to four of your side’s downed fighters back from your hangar, paid from the reserve | 60 s |
  | Damage control | 15% of the hull back (on the defender’s flagship, of the current objective) | 90 s |
  | Micro-jump | a short jump sideways or astern, capped | 120 s |

- **Squadrons.** Rebels: Red, Gold, Green and Blue; Empire: Black,
  Obsidian, Onyx and Saber; their count from the side’s fighters (two on a
  phone, four on a desktop). Orders, each with a timeout: attack my
  target, escort my ship, screen the line, free.
- **Numbers.** A commander alone can’t take an objective in under about
  60 s; a focused broadside sinks an escort in about a minute; a salvo takes
  5–8% of a Star Destroyer. Tested.
- **Input.** Keys 1–5 for the abilities, Shift+1–4 for the squadrons, the
  flight keys and stick for the camera; a command bar with labelled
  buttons and their cooldowns for touch and screen readers; the phase and
  tickets said in the page’s live region. B drops you into a fighter at
  your ship’s hangar, and back to the bridge from the hangar or after 20 s.

### 10. Fleet command online: two commanders share a fleet

After part 9, #793’s §7 (the ledger) and #746’s `wire2.js`.

- **A `cmd` action** carries each seat’s order log: `[n, t, verb, arg]`,
  `t` in ms on the shared clock, never the battle’s local clock. It is
  latest-wins per seat and resent every 5 s while seated, so a late joiner
  replays the log and sees the same ships in the same places. Targets are
  only things laid from the seed (capital slots, turret and subsystem
  numbers, squadron names), never a runtime fighter id.
- **Seats are claims.** The hello carries the slot claimed; a claim is
  sticky; two claims on one slot go to the earlier claim, then the lower
  id; a seat is freed when its log hasn’t been heard for 5 s, and the ship
  goes back to the fleet’s AI.
- **Outcomes go in the ledger**, not the order log: a commanded ship’s
  hits and repairs are its commander’s entries in #793’s ledger, and a
  ship that sinks sinks for everyone. A commander’s bolts are the AI’s on
  every other screen, never counted twice.

### 11. The universe map’s wars (task 14, after this)

- **Side, pacing and respawn.** The front gets the fleets’ tactics and the
  difficulty scaling; the side picker (`BattleHud.jsx`, deleted in
  `5ceb67ac`) comes back, remembered per war; a death comes back behind
  your line.
- **Every crew’s war.** One front per ready war (Rick and Morty, Breaking
  Bad), so any crew can fight either; the pickups and the heal there too;
  a Star Wars crew is pointed at `/galaxy`.
- **Shared online**, on the galaxy’s pattern: a wall-clock schedule, a
  director and the `fight` tally.
- **Their own ships.** Sixteen Rick and Morty and Breaking Bad kinds are
  built in code with no model. Each gets a gen3d request (an issue labelled
  `gen3d`, with a picture) once the desktop runner is healthy (21 of its
  issues are failed today), and is wired in a follow-up PR (a MODELS entry
  and a LOD).

## What is not in it

- No change to the AI fleets’ courses, guns or ledger beyond what command
  needs (PR #793’s).
- A server.
- Voiced recordings of the new lines, which go through the voices runner
  later.
- The sequel trilogy.

## How each part is checked

- `npm run lint`, `npm test`, `npm run build`,
  `node scripts/health.mjs --check --skip build`.
- Part 1: `scripts/galaxy-bloom-check.mjs`’s numbers and shots.
- Parts 2–8: `scripts/galaxy-war-check.mjs` (with `SIDE=` and `KIND=`) and
  `scripts/galaxy-setpieces-check.mjs`, extended for each part, with shots
  under `docs/superpowers/evidence/war-played/`.
- Parts 9 and 10: a scenario test that the same order log in a different
  arrival order gives the same capital poses, and a two-browser check.
