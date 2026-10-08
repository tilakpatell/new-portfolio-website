# Garrison defence: the fleets at a planet fight for it

The galaxy's wars park capital ships at nearly every system: the fleet pieces in `systems.js` (Hoth's and Mustafar's Star Destroyers, Naboo's Lucrehulks, Kamino's and Geonosis's Republic ships) and, where the holder has none of its own there, the two escorts `warEffects.js`'s `garrisonFleet` puts in orbit. Today they are scenery. They ride at anchor and block your flight, and that is all. A pilot sworn to the Rebellion can fly under a Star Destroyer's hangar at Mustafar and nothing happens; only a war battle (`universe/battle.js`, within its own ring) or the director's hunt, which comes wherever you are, ever shoots back. The galaxy's drop-in Star Destroyer launches its fighters but never fires its turbolasers (`scene.js` hands `pieces.update` no ship and never drains its events).

This is the design for making those fleets a live defence, scaled to how firmly their side holds the system, and for the robustness the owner asked for round it: hunter packs that fall back on their fleet, war-battle fighters that come out for a pilot skirting the battle, and the drop-in Star Destroyer's guns.

The owner's answers, 8 October 2026:

- **How hard it hits:** by the blockade and the holder's grip on the planet (how much they control it).
- **Unsworn pilots:** warned, then fought if they linger or shoot.
- **Your own side's fleet:** covers you when you come in with enemies on your tail.
- **Scope:** the parked fleets, the hunter packs, the war battle's fighters and the drop-in Star Destroyer's guns.

## What it is not

- **Not a second battle engine.** The war battle (`universe/battle.js`) keeps its tickets, its tally and its phases. A garrison launches through the hunters the galaxy already flies and fires its own turbolaser bolts; nothing it does posts to the war.
- **Not a change to who holds what.** `gcw.js` and the tally are untouched; the garrison reads the war table, it never writes it.
- **Not new voices.** The new lines are text on the comms, kept out of the voices job (`scripts/voices/export-lines.mjs`).
- **Not a dependency.** The brains are pure rules on `src/lib/ai` (perception, tokens) with tests beside them.

## 1. Stance and grip (`warEffects.js`)

`effectsFor` gains two fields, both pure and tested.

**`stance`**: how the holder's fleet treats you.

| stance | when | what the fleet does |
| --- | --- | --- |
| `friend` | the holder is your side | covers you (section 4) |
| `enemy` | sworn to the other side of this war, or a deserter from this owner | challenges, scrambles, fires |
| `wary` | unsworn; or Hutt space, for anyone | warns you off with a countdown; fights only if you stay or shoot |

The Hutts are nobody's friend but they are mercenaries: they warn first, whoever you are.

**`grip`**: how firmly the holder holds the system, from its war table row (`gcw.js`'s `tableOf`), as a band `0, 0.1 … 1` and a `tier`. The score starts at the row's `control`. It is cut by 40% when the system is out of supply (`cut`) and by 0.15 when it is a front or under attack. It gains 0.25 for a blockade (`kind === 'blockade'`: Bespin, Naboo, Kashyyyk, Kamino, Sorgan) and 0.15 for a stronghold (`worth >= GCW.stronghold`: Hoth, Endor, Yavin, Scarif, Lothal, Coruscant). The result is clamped to 0..1 and rounded to a tenth. Rounding matters: `scene.js`'s `effectsNow` compares effects as JSON once a second and rebuilds the world's fleets when they differ, and a raw `control` moves every second.

| tier | grip | the garrison |
| --- | --- | --- |
| `thin` | under 0.5 | rings ×0.8; waves of 2 from a reserve of 4; a volley every 2.4–3.4 s a ship; bolts 10 |
| `held` | 0.5 to 0.85 | rings ×1; waves of 3 from a reserve of 8; a volley every 1.6–2.4 s; bolts 12 |
| `fortress` | over 0.85 | rings ×1.25; waves of 4 from a reserve of 14, an ace one wave in three; a volley every 1.0–1.6 s; bolts 14 |

A blockade world held whole and in supply is a fortress; a cut-off system on the front is thin. Damage is in shield points (the shield is 100), the same scale as a hunter's laser (12).

## 2. Posts (`world.js`)

`world.posts()` returns the parked capitals shown now: the fleet pieces whose holder the effects show, and the garrison escorts, none while the war's battle is on here (`quiet`). Each is a plain object:

```
{ id, kind, side, size, at: { x, y, z }, yaw, hangar: { x, y, z }, batteries: [{ x, y, z }], spheres: [{ c: { x, y, z }, r }] }
```

`at` and `yaw` are read live from the model's holder (with its bob and a Lucrehulk's spin). The maths that turns a kind, a size and a yaw into battery, hangar and hull points is pure and lives in `garrisonRules.js` as `postOf`, from the tables the galaxy already shares with the war (`universe/wars.js`'s `TURRETS` and `HULLS`). The hangar is under the hull's middle sphere, clear of it, as the war battle's carriers have it (`battleFlights.js`'s `hangarOf`). The side is the war's spelling (`separatists`, not the fleet piece's `separatist`). The objects are kept and refreshed, not made each frame.

## 3. The garrison mind (`garrisonRules.js`)

One mind for the system, pure, seeded, tested. Each step it reads the posts, you (your ship, or null while you jump, crash or land), your stance and tier, what its own fighters are doing, and whether the war's battle is on here. It returns what happened: lines to say, waves to launch, bolts fired, hits on you, hits on what's chasing you, a recall.

### Seeing you

Every post perceives (`lib/ai/perception`'s `createSenses` and `sense`, as the hunters and the surface's hostiles do). Sight is all round and reaches past the warn ring. The detection timer is quicker close in. The planet blocks sight: the scene hands the mind a `seesThrough` that tests only the planet's sphere, never the hulls, or a ship would be blind inside its own. A shot of yours that lands near a post is a stim it hears even behind the planet. Losing you, a post coasts on your last course for its intuition (3 s) and then its confidence fades over its memory (12 s). Ducking behind the planet buys you time; it doesn't wipe you from their minds.

### Rings

The rings are measured from each post. They scale with the ship's size and with the tier:

- **fire:** `24 + 1.2 × size`. A Star Destroyer of 30 reaches 60; a corvette of 2.8 reaches 27.
- **scramble:** the fire ring + 40.
- **warn:** the scramble ring + 60.
- **leash:** the warn ring + 40.

At the boost (12 a second) a Star Destroyer's fire ring is five seconds across; at the cruise (3.3) it is eighteen. The war table's planets put the arrival point (`systems.js`'s `arrival`, 3.2 planet radii out) outside most scramble rings and inside some warn rings, so a pilot who jumps in has the arrival grace below.

### States

```
calm → hail → scramble → engage ⇄ pursue → stand down → calm
```

- **calm:** nothing seen inside the warn ring.
- **hail:** a post is sure of you inside the warn ring.
  - Enemy: a challenge, then a scramble as soon as you're inside the scramble ring.
  - Wary: a warning and a countdown (8 s; 5 s at a fortress). Leave the warn ring and they thank you and stand easy. Stay inside the scramble ring past the countdown, or shoot, and they scramble.
- **scramble:** the nearest post with a hangar launches a wave, from the reserve, sized by the tier. The scene sends it through `hunters.pack(faction, ship, { from: hangar, tag, home })`. The next wave comes when half the last is down or it's gone, at least 6 s later, while you're inside the scramble ring and the reserve lasts. At most two waves' worth of the garrison's fighters fly at once. The reserve refills one fighter every 40 s, so a garrison can be bled dry.
- **engage:** you're inside a post's fire ring and it can see you. Its turbolasers fire, one battery a volley: the battery nearest you with a clear line.
- **pursue:** you're out of every fire ring but inside the leash. The fighters chase; the guns hold.
- **stand down:** you've been out past the leash for 6 s, or it lost you for good, or you left. The fighters are recalled to their hangar (they fly home and are gone there; they don't vanish), and the mind is calm again.

The mind remembers. Its `alarm` rises with what you did (scrambled at, shot at them, downed their fighters) and falls over two minutes. Coming back while it's raised skips the hail and scrambles at once.

### Turbolasers

A bolt is fat and slow (40 a second, radius 0.8), and the mind flies it itself, as `capitalRules.js` does. Each step it sweeps the bolt's segment against your sphere and against the planet, and a hit is decided there, not drawn and hoped. The drawing goes through the scene's shared bolt pool (`fx.js`'s `createBolts`), from the battery along the bolt's line to the end of its reach.

The aim **brackets**. A gunner leads you by the bolt's time of flight and misses by an error that shrinks the longer you hold a line: from 9% of the range down to 1.2% over three seconds of steady flight. Turn hard (your velocity swinging more than about 25° a second) and the tracking falls back to a third. Jinking is how a pilot lives under a Star Destroyer, and the rule rewards it.

A battery never fires through its own fighters: a shot whose line passes within a fighter's size of one of theirs is held.

### Fairness

- No fire and no scramble during the arrival grace (8 s after you jump in) or after a respawn (8 s, on top of the scene's `safeUntil`). You can always get your bearings.
- Nothing while you're in the tunnel, crashed or landed (you are null). The scene's `reset` clears the mind and its bolts when you jump, go down or respawn, as the hunters are cleared.
- While the war's battle is on in the system, the battle's own capitals fight and the world hides the parked ships (`quiet`). The mind stands down without a word and fires nothing.
- Under reduced motion the galaxy has no hunters, no wingmen and no drop-in, and it has no garrison either.

### Escalation

Your shot hitting a garrison fighter (the hunters answer with its pack's `tag`) or a post's hull raises the alarm and turns a wary mind enemy for 90 s. It is the system's grudge, not the war's. It is the only way an unsworn pilot or a Hutt's guest is fired on without staying past the warning.

## 4. Your own side's fleet

With stance `friend` the same mind runs, the other way round:

- **Covering fire:** the hunters on your tail (`hunters.targets`, not prey, not the garrison's own) inside a post's fire ring draw its turbolasers. The bolt is swept against the hunter and a hit is `hunters.damage(id, 2)` (a turbolaser bolt is two of a laser's hits), popped as the wingmen's are.
- **A flight to meet you:** two or more chasing you inside a post's scramble ring, and the post sends your side's wing out (`wingmen.join`, the escort the director already sends). Then nothing more for 60 s.

The comms say so: the post's commander tells you they have you.

## 5. Hunter packs

Two additions to `hunterRules.js`, both optional on a pack, both tested. It is 1,382 lines against the ceiling of 1,500.

- **A tag.** `pack(…, { tag })` marks a pack. `leave(faction, tag)` recalls only it, `targets` and the `hunted`/`escaped`/`cleared` events carry it, and so does a hit's answer. The garrison's waves are tagged with the system's id, so the scene can tell them from the director's packs, recall only them, and know when you shot one.
- **A home.** `pack(…, { home })` gives a pack somewhere to go. A pack that gives up (it lost you, or its nerve broke) or is recalled flies to its home and is gone there, rather than climbing away on its heading. The garrison's waves go home to their hangar. A director's pack sent into a system whose holder is the pack's own side is given the nearest post's hangar as its home, so a beaten pack falls back under its fleet's guns.

**Reinforcements:** a pack of the holder's side that breaks or is cut down near a post (`escaped` with `why: 'broke'`, or `cleared` while you're inside the warn ring) calls the garrison. An enemy mind that hears it scrambles at once, skipping the hail.

## 6. War-battle fighters (`universe/battle.js`, `battleTactics.js`, `battleAi.js`, `battleCapitals.js`)

Today a battle notices you only inside 1.4 battle radii and only if you're sworn to a side in it (`youIn`).

- **The edge ring.** Out to 2.4 radii, at most two of the nearest enemy fighters on each side that's against you peel off to intercept (`BATTLE.edge`, `BATTLE.edgeOn`). Bombers, aces, waves, fighters going home and frozen ones are not eligible. The pick is kept between steps and goes through the fighters in order with no random draw, so the fixed-step determinism test is unchanged. The battle's pull back to its edge doesn't apply to an interceptor on you. The batteries' point defence reaches you out there too, within its own range.
- **Unsworn and shooting.** An unsworn pilot's shots do nothing to a battle today. Now a hit on a team's fighter or hull makes that team angry at you for `BATTLE.grudge` seconds (the angry team, not the other one), and it hunts you as if you were sworn against it. Aces, runners, objectives and subsystems don't count: an unsworn pilot can't score the war.

## 7. The drop-in Star Destroyer

The galaxy plays it as the universe map does (`universe/scene.js`'s `capitalEvent`):

- `pieces.update(…, live)`, and its events drained every frame.
- Its waves come from its own `launch` events; the scene's timer that launched them is gone, so a wave never comes twice. When its fighters are cleared it launches its second wave (`pieces.cleared()`), as on the universe map.
- Its turbolasers hurt (`hurt(14)` a hit).
- Your shots meet its shield domes and bridge (`pieces.hit` in `strike`, before the pilots'), never paying or popping as a fighter. It shows among the guns' targets, and it pays `killCapital` when it goes up.
- It leaves when you jump, so it can't fire at you in the next system.

## 8. The comms

A new pure module, `galaxy/garrisonLines.js`, gives each moment an exchange: the post's commander on the radio (`warCast.js`'s `castFor` name and colour, or the side's colour), then your crew. Every crew (`cruiser`, `xwing`, `falcon`, `rv`) has a line for every moment. The moments are:

- `challenge`, `warn`, `clear`, `scramble`, `open`, `standdown`
- `cover`, `escort`
- `reinforce`

It also covers the drop-in's `capital` moments in the galaxy, so Rick doesn't call a Star Destroyer a Federation cruiser. `pages/Galaxy.jsx` turns `{ type: 'event', id: 'garrison', sub }` and the galaxy's `{ id: 'capital' }` into `{ type: 'lines' }` the way it does `battle`. Nothing goes into `GALAXY_LINES` or a `voicelines.js`, so the line tables' tests and the voices job are untouched, and a test of its own pins every crew and every moment to the copy rules. The countdown's warning also shows as the page's pilot note: "Restricted space · turn back".

## 9. Size, budgets, performance

- `garrisonRules.js` and `garrison.js` (the scene's glue) each stay under 800 lines. `scene.js` grows by tens of lines; it is already counted in `big-files`.
- At most five posts a system and twelve of a mind's bolts in the air (six on a phone). One perception step a post a frame. No allocation in the step past its kept objects.
- Turbolaser drawing shares the scene's bolt pool (180, or 90 on a phone). A full pool draws nothing; the rule still decides the hit.
- The scramble waits for the pilot to have flown (`state.flown`), as the director does, so `scripts/galaxy-check.mjs`'s draw-call baselines (a pinned ship, unflown) stand.

## 10. Testing

- **`warEffects.test.js`:** stance for each oath and owner (Hutts wary, deserters enemy); grip and tier for a blockade, a stronghold, a cut-off front, a raw control between bands; `KEYS` grows by the two fields.
- **`garrisonRules.test.js`:**
  - `postOf` against `TURRETS` and `HULLS`;
  - each state's way in and out, for each stance and tier;
  - the countdown, the arrival grace, the battle stand-down;
  - the planet's cover and the coast;
  - the reserve and the wave cap;
  - the leash and the recall;
  - escalation and its decay;
  - a steady target hit more than a jinking one, over seeded runs;
  - no fire through its own fighters;
  - covering fire and the escort's cooldown;
  - the reinforcement call;
  - a frame-rate check (1/30 against 1/120).
- **`hunterRules.test.js`:** `tag` on events, targets and hits; `leave(faction, tag)` leaves the others; a homed pack flies to its home and is gone there.
- **`battle.test.js` / `battleTactics.test.js`:** the edge ring's cap, both tactics paths, nothing past 2.4 radii, point defence out there, the unsworn grudge and its decay, aces not counted, determinism unchanged.
- **`world.test.js`:** posts for Hoth's fleet, a garrison's posts after `setEffects`, none under `quiet`.
- **`garrisonLines.test.js`:** every crew, every moment, the copy rules.
- **The gates:** `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, and a smoke of `/galaxy` in headless Chromium (`scripts/autopilot-check.mjs --only smoke`).

## Left for later

- Voicing the new lines (the ElevenLabs key).
- The drop-in Star Destroyer is drawn at the universe map's length (16), half the galaxy's own (30).
- Torpedo salvos (`powers.js`) don't home on the drop-in's domes.
- A garrison's posts can't be destroyed: shooting a hull provokes it, nothing more. Taking a fleet out is the war battle's business.
