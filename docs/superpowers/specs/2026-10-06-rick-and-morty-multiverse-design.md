# The Rick and Morty multiverse: design

Date: 2026-10-06. Status: written from the user's brief without a live
question round (the session ran unattended), so every decision below is
either the user's words, something the repo already settled, or an
assumption marked as one. Review the assumptions and the open questions at
the end before the plan is executed.

Companion documents:

- The harvested catalogue: `docs/research/2026-10-06-rick-and-morty-wiki.md`
  (every category of the wiki that matters here, who appears most, and what
  the site already has).
- The plan: `docs/superpowers/plans/2026-10-06-rick-and-morty-multiverse.md`.
- The worlds this builds on: `docs/superpowers/specs/2026-10-05-c137-world-design.md`
  (the Smiths' street and its rooms), `docs/superpowers/specs/2026-10-05-citadel-world-design.md`
  (the Citadel), and the universe map's specs under `docs/superpowers/plans/2026-10-05-universe-*.md`.

## Intent

What the user said: "go through the entire wiki and make almost everything
(models, people). Basically a portal to the Rick and Morty universe, not
world. Make an entire plan on what we can get from this wiki and add to the
existing codebase, and approximate cost for models, and prioritise the big
things from the universe. The models have to be high quality and accurate."

Then, on the models: “Save credits by using Sketchfab and community models
from Meshy first, and if those are bad and not accurate then use Meshy.” So
a model is looked for before it is paid for (the sourcing order under
“Decisions and assumptions”), and a model that is found has to pass the
same gate as one that is generated.

Read as: today `/c-137` is one world (the Smiths' street and its rooms, the
alien street outside Blips and Chitz, and the Citadel). The ask is to make it
the door to the *multiverse*: the show's planets, dimensions, stations and
people, as far as the wiki goes, built on the code that is there, with the
people as rigged figures that look like the show (found where someone has
already made one well enough, made with Meshy where not), and a bill for
them. The deliverable of this round is the plan and its cost, not the build.

## What is there now

The site already holds more of the show than any other fandom on it. The
catalogue has the full cross-reference; the short form:

| Area | What exists | Code |
| --- | --- | --- |
| The Smiths' street | The house (inside, and upstairs), Rick's garage lab, the hatch to the clone lab and Morty's Mind Blowers, Harry Herpson High's classroom, Shoney's, the President's limo and portal to the Oval Office, the Federation's ship and agents, the cruiser to fly | `src/components/rickmorty/world/` (`rules.js` tested; `scene.js`; `interiors/*`) |
| Through the garage portal | The alien street and Blips and Chitz, with Roy: A Life Well Lived | `world/annex.js`, `world/arcade.js`, `world/roy/` |
| The Citadel of Ricks | A concourse over the city, five scenes (Day Care, Simple Rick's, the Council, Vote Morty, the escape), crowds of 28 Rick and Morty variants | `src/components/rickmorty/citadel/` |
| Portal panic | A wave shooter across four arenas with the Portal panic cast | `src/components/rickmorty/portal/` |
| The wardrobe | Rick and Morty bodies (15), colours, hats, the portal gun | `src/components/rickmorty/wardrobe/` |
| The universe map | The C-137 planet and its landing, the Citadel as a wonder (and its siege), the Council's hunters, the Federation's squads on foot, Birdperson as a wingman, Phoenixperson as a bounty hunter, a Cromulon leviathan, saucer, hauler, gearship traffic, Rick's cruiser cockpit | `src/components/universe/` |

Meshy models today: 31 rigged people (the Smiths, the school, the
President's party, the Federation, Portal panic's cast, three councillors,
seven Citadel Ricks, Cop Morty), 7 props and vehicles, 7 buildings, 28 crowd
copies. All made by `scripts/meshy.mjs` from a concept image, judged by eye,
then image-to-3D, rig, clips, fetch and compress, with every task id kept in
`scripts/meshy-tasks.json` so nothing is paid for twice.

Everything else of the show on the site is drawn in code (Birdperson's and
Phoenixperson's ships, the butter robot, the plumbus, the Meeseeks box, the
Citadel's exterior and city, the Council's ships).

## What the wiki holds

From the harvest (counts are wiki pages): 1,062 characters (97 recurring,
290 antagonists, 482 one-time), 343 locations (56 recurring, 78 planets, 91
dimensions, 14 places in the Citadel, 20 rooms of the Smith house), 131
races, 167 objects and 55 of Rick's gadgets, 12 vehicles (plus a long list of
minor ones), 39 groups. rickandmortyapi.com adds appearance counts for 826
characters: after the five Smiths, the people who turn up most are Jessica,
Mr. Goldenfold, Snuffles, Birdperson, Mr. Poopybutthole, Nancy, Principal
Vagina, Mr. Meeseeks, Tammy, the President, Tricia, Brad, the Council Ricks,
Squanchy, Evil Morty, Phoenixperson.

"Almost everything" is not one build. The catalogue is cut into tiers by
three signals: how often the thing appears, how iconic the episode is, and
how much of the repo it can reuse. The tiers are the phases of the plan.

## Decisions and assumptions

Decided by the brief or the repo:

- Models are found before they are paid for (the user's rule, under
  “Intent”). Each asset is sourced in this order, and the first source that
  passes the accuracy gate (“The model standard” below) is the one used:
  1. **An existing Sketchfab model** that passes the same gate as a
     generated one: judged against the wiki's reference sheet (silhouette,
     colours, outfit, face), rigged or riggable, under 80,000 faces, and
     under a licence the site can use: CC0, CC BY, CC BY-SA, CC BY-NC or
     CC BY-NC-SA, never an ND licence and never a model that isn't
     downloadable. `scripts/model-scout.mjs` finds the candidates with the
     site owner's `SKETCHFAB_API_TOKEN`; a hit is imported to web size and
     credited in `src/data/modelCredits.json`, as the site's other
     Sketchfab models are.
  2. **A Meshy community model** (meshy.ai's Discover page), only if the
     user downloads it by hand into `lab/meshy/community/<name>.glb`. Meshy
     has no API for its community models and this environment has no
     browser login to meshy.ai, so the plan never fetches one itself. A
     file left there is judged by the same gate, imported the same way and
     credited in `public/games/credits.json` (as `meshy/community/<name>`,
     with its page, its maker and the terms the page gives).
  3. **Meshy generation** (`scripts/meshy.mjs`), the pipeline every Rick
     and Morty figure on the site already went through, so a generated
     figure shares Rick's skeleton and clips, the wardrobe's recolouring,
     the Citadel's crowd baking and Portal panic's cast loader.

  A Tripo pipeline exists as a skill in the repo but there is no Tripo key
  in the environment and nothing on the site uses it; it is not used here.
- Every person is a rigged figure, found or generated, in the show's cel
  look (the C-137 world's `STYLE`). No code-built stand-in for a person in
  a new place (the Citadel's rule): a figure that fails the quality gate is
  left out, never replaced with a box.
- Copy is in the site's voice: plain sentences, curly quotes, British
  spelling, no quoted dialogue from the show beyond a line a person is known
  for.
- The page keeps its sections (the hero, Portal panic, the toys); the world
  grows under them.

Assumed (say so if wrong):

- **A1.** The portal to the multiverse lives where the show puts it: the
  portal gun in Rick's garage. The hero's "Fire the portal gun" button on the
  page picks a destination and takes you to the world, dialled to it. There
  is no new route for the multiverse; the Citadel keeps `/c-137/citadel`.
- **A2.** New places are built in the C-137 world's own pattern (an area in
  `rules.js`, a builder, people, hotspots, tasks), loaded only when entered.
  They are not landings on the universe map, except the four planets Phase 6
  adds there as well.
- **A3.** Rigged people are made at the HD settings the site already uses
  for Rick and Morty (2k textures; 30,000 faces, 40,000 and Meshy's ultra
  geometry for the heroes), unrigged props and buildings at 2k and 30,000,
  crowd copies at the crowd settings. This is the "high quality" of the
  brief; the "accurate" is the gate in the standard below. A model that is
  found is brought to the same budgets when it is imported.
- **A4.** The budget is the user's Meshy account. The balance when this was
  written was 58 credits: a purchase is needed before the first generated
  asset, sized once the scout has said what is left to generate.
- **A5.** Phases ship in order and each is a merge to main on its own; a
  phase can be stopped after any task without leaving the site broken.

## The shape: the garage portal as the door to the multiverse

Six pieces, in the order the plan builds them. Each stands alone.

### 1. Destinations: the portal gun's dial

The portal on the garage's west wall goes to the alien street today. It
becomes a dialled portal: a hotspot on the portal gun's stand beside it
opens a dial (a list of destinations with a line each), the chosen one is
kept as `tp-rm-dial`, and the swirl takes Morty there. The hero's "Fire the
portal gun" on the page sets the same dial and scrolls to the world. Each
destination has the portal home at its arrival point.

Data, pure and tested, in `src/components/rickmorty/world/dimensions/destinations.js`:

```
DESTINATIONS: [{ id, name, note, kind: 'outdoor' | 'room',
  area: { x0, x1, z0, z1 },         // 140 × 50 m outdoors; rooms as today's
  sky, ground,                      // the builder's presets
  arrive: { x, z, face }, back: { x, z },   // where Morty comes out; the portal home
  people: [{ id, who, x, z, face, sits?, until? }],    // rules.js PEOPLE shape
  hotspots: [...], tasks: [...], lines: { id: [...] } }]
```

The destinations stand in a column of their own west of the rooms
(`x −470…−330`, one per 100 m of `z` from 900), so nothing today moves.
`rules.js` spreads them into `AREAS`, `OUTDOOR`, `PEOPLE`, `HOTSPOTS`,
`TASKS` and `LINKS` (one `<id>-portal` link back each, and the garage
portal's target read from the dial: `portalTarget(dial)`). `RmWorld.jsx`'s
`TO`/`OUT` tables are generated from the list instead of hand-kept.

Loading: `scene.js` builds every area at start today. Destinations are lazy:
`AREA_BUILDERS` keeps the street and the rooms; `LAZY` maps a destination id
to `() => import('./dimensions/<id>.js')`, built the first time the portal
is dialled to it, awaited behind the swirl (the swirl holds and a "Opening a
portal to <name>…" line shows until the builder and its figures are in). The
alien street becomes the first lazy area, to prove the mechanism before any
new content. The figures a destination needs are loaded with it
(`cast.need(kinds)`), not at start, so the page's first download stays what
it is (`WORLD_MB['/c-137']` 15).

A destination's builder has the annex's contract:
`build<Id>(kit) → { group, update?(t, dt, state), noInk?, light?, sky? }`,
drawn in the world's toon materials, everything solid outside the walkable
box or in its colliders.

### 2. The Smith house, the rest of the family

The people who appear most and are not here yet live in the house: Mr.
Poopybutthole on the sofa, Snuffles, Space Beth in the garage with Rick, Dr.
Wong (her office, a new room off the street), Nancy and Tricia at Summer's
sleepover upstairs, Diane as the hologram in the clone lab. And the house's
own episode, **Total Rickall**: a memory-parasite egg on the living-room
shelf starts it. The room fills with the family and the parasites
(Pencilvester, Sleepy Gary, Hamurai, Amish Cyborg, Mr. Beauregard, Cousin
Nicky, Frankenstein's monster, Reverse Giraffe, Ghost in a Jar, Photography
Raptor, Tinkles, Baby Wizard, Mrs. Refrigerator), each with a memory card
when you look at them: a parasite only ever has a good one. You shoot (click,
or `F` with the crosshair on them) the ones whose memories are all good;
shooting a real Smith ends it; Mr. Poopybutthole must be spared. Rules in a
pure `interiors/rickall.js`: `newRickall(seed)`, `tell(game, id)`,
`shoot(game, id) → 'parasite' | 'family' | 'poopybutthole' | 'won'`, tested.

### 3. The Citadel's districts

"The Ricklantis Mixup" is the Citadel's biggest episode and its ghetto is
not on the concourse yet. Mortytown is a second district through a new door
(`DOORS.mortytown`): a street of low blocks under the city, Morty Mart and
The Creepy Morty as buildings, Big Morty at the club's door, Slick Morty,
the Mortytown Locos, Rick D. Sanchez III and Simple Rick at the factory's
door (the factory line already exists), Evil Rick among the crowd. One new
quest, `locos`: the Locos have robbed Morty Mart and are hiding in
Mortytown; find all three (the district's cover rules, from `layout.js`'s
`sightClear`) and walk each to Cop Morty. On the map, the Citadel's
code-drawn exterior is replaced with a Meshy model (its `CITADEL_PARTS`
stay for collision and the siege), found on Sketchfab if one passes the
gate, else made with Meshy.

### 4. The Vindicators

The show's superhero team is a destination of its own: the Vindicators'
ship, summoned by the beacon. Vance Maximus, Supernova, Alan Rails, Million
Ants, Crocubot and Noob-Noob stand in the hall, and the scene is "Vindicators
3": Rick's drunk Saw rooms, three of them, as a puzzle (the right lever, the
riddle with no answer, the button Noob-Noob is told to press), lost by a
wrong pick and won by the end with the party invitation. Rules pure and
tested (`dimensions/vindicatorsRules.js`).

### 5. The universe map

Two things the map's Star Wars side has and the Rick and Morty side does
not: a capital ship event and planets of its own.

- The Federation's **NX-5 Planet Remover** drops out of warp over the planet
  you are at, as the Star Destroyer does, with its cannon array charging;
  knock the array out (anything hurts it) before it fires, or it removes the
  planet for a minute (the siege's shared-damage rules, `universe/siege.js`).
  A model (found, else Meshy); the event in `director.js` with its own
  tested rules.
- **The Rick and Morty system**: four small landable planets round the
  Citadel on the map, Gazorpazorp, Planet Squanch, Bird World and Gear World,
  each a `landings.js` entry whose things are the destination builders'
  props and people, so landing there from the map is the same place as the
  portal's.
- Birdperson's and Phoenixperson's code-built figures on the map are
  replaced by the new models once they exist.

### 6. Cross-benefits

Every new rigged Rick or Morty variant joins the wardrobe's `BODIES` (Evil
Rick, Simple Rick, Rick Prime, Rick D. Sanchez III; Big Morty, Slick Morty)
and the Citadel's crowd (`scripts/crowd.mjs`). Gromflomite and Zigerion
figures join Portal panic's kinds. The model credits go into
`public/games/credits.json` as today for Meshy's, and into
`src/data/modelCredits.json` for what came from Sketchfab.

## The catalogue, prioritised

Reasons are in the third column: appearances (eps, from the API), the
episode's standing, and reuse. "Model" counts are new assets, each scouted
on Sketchfab first and generated with Meshy only if nothing found passes;
their costs, as ceilings, are under “Costs”.

### Tier 1 (Phase 1): the door, and the four places everyone knows

| Place | People and things | Why |
| --- | --- | --- |
| Interdimensional Customs (Pilot) | Gromflomite customs agents (have), Krombopulos Michael in the queue with a Zigerion and a Gear Person, the scanner, the Mega Seeds | The first alien place in the show; the agents already made, and the show’s best customer |
| Planet Squanch (Wedding Squanchers) | Squanchy, his cat-rack house, red grass and suckulents, the wedding arch with Birdperson and Tammy (have), the Federation's raid as a second mood (Gromflomites, have) | Squanchy 3 eps, Birdperson 7, Tammy 5; the most-remembered wedding |
| Gazorpazorp (Raising Gazorpazorp) | Male Gazorpians (have), Ma-Sha, adult Morty Jr., Gwendolyn, the women's domed city, two suns over red dunes; Portal panic's arena dressing reused | A whole planet already half built |
| Bird World (Get Schwifty) | Birdperson at home, his house on the ridge, Phoenixperson as the alternate; Unity visiting | Birdperson is the most-seen friend; the map's wingman and hunter get real models |

Models: Birdperson, Phoenixperson, Squanchy, Mr. Poopybutthole (made here,
used in the house), Unity, Ma-Sha (the wiki’s Mar-Sha), Morty Jr., Krombopulos Michael, a Zigerion
and a Gear Person (crowd), Gwendolyn, Squanchy's house, Birdperson's house. 13.

### Tier 2 (Phase 2): the house, the rest of the family, Total Rickall

Space Beth, Rick Prime (made here; stands in his fortress in Phase 6, and on
the map), Snuffles, Dr. Wong and her office, Nancy, Tricia, Diane's hologram;
the thirteen parasites. 20 models.

### Tier 3 (Phase 3): the Citadel's districts and the map's set pieces

Big Morty, Slick Morty, the campaign-manager Morty, three Mortytown Locos
(crowd), Rick D. Sanchez III, Simple Rick, Evil Rick, Supreme Guard Rick
and Garment District Rick (crowd), Morty Mart, The Creepy Morty, the
Citadel's exterior, the NX-5 Planet Remover. 14 models.

### Tier 4 (Phase 4): eight more destinations

| Place | People and things |
| --- | --- |
| Fantasy World (Meeseeks and Destroy) | The Thirsty Step tavern, Stair Goblins, King Jellybean, the giant's court; Meeseeks (have) |
| The Microverse (The Ricks Must Be Crazy) | Zeep Xanflorp, Kyle, the Microverse city round the battery |
| Anatomy Park | Dr. Xenon Bloom, Poncho, Annie, the diseases as monsters (Hepatitis A, Gonorrhoea, Tuberculosis, Bubonic Plague, E. coli), Ruben's insides |
| Needful Things (Something Ricked This Way Comes) | Mr. Needful and his shop |
| Jerryboree (Mortynight Run) | Six Jerry variants in the crowd, the receptionist Rick (have), Furp Rock Plaza |
| Purge Planet (Look Who's Purging Now) | Arthricia, Magdalian cat-people, purge night |
| Pluto (Something Ricked This Way Comes) | King Flippy Nips, Scroopy Noopers, Plutonians, mushroom buildings, the pyramid |
| Gear World (Mortynight Run) | Gearhead, Gear People, the gearship (have) |

28 models.

### Tier 5 (Phase 5): the Vindicators

Vance Maximus, Supernova, Alan Rails, Million Ants, Crocubot, Noob-Noob, the
ship. 7 models.

### Tier 6 (Phase 6): vehicles, the Story Train, Rick Prime's fortress, the Rick and Morty system

Space Beth's ship (parked in the street), Jerry's car as a spaceship, the
Gotron ferret and the combined Gotron (a set piece over the street), the
Zigerion mothership with Prince Nebulon and two Zigerions (a destination:
the simulation), the Story Train with Story Lord and the Tickets Please Guy
(a destination), Rick Prime's fortress (a destination, Rick Prime from
Tier 2), four planets on the map. 11 models.

### Tier 7 (optional, after): the long tail

Ten Interdimensional Cable figures as crowd cameos on the alien street (Ants
in My Eyes Johnson, the Real Fake Doors salesman, Mr. Sneezy, Baby Legs,
Regular Legs, Eyehole Man, Gazorpazorpfield, the Two Brothers, Jan-Michael
Vincent, Michael Jenkins), Jaguar and the Pickle Rick sewer run, Mr. Nimbus
and the beach, Heist-Con (Miles Knightly, Heistotron), Get Schwifty's
Water-T, the Gromflomite base (Krombopulos Michael is made in Phase 1), Mr. Frundles, Snake
Planet, Froopyland, the Immortality Field Resort, Nuptia 4, St. Gloopy
Noops. None of it is in the cost below but the long tail is priced per
asset the same way.

Left out on purpose: one-time characters with no place to stand, the
Interdimensional Cable *shows* (the TV toy has them), the comics, Pocket
Mortys, the Vindicators shorts, real people.

## The model standard: the accuracy gate

High quality is a setting; accurate is a process. Every figure and prop
goes through this, found or generated, and the plan's model tasks say so
step by step.

0. **Scout first.** Before anything is paid for, `scripts/model-scout.mjs`
   (built in the plan's Task 0.0) looks for the asset on Sketchfab:
   `node scripts/model-scout.mjs <name> "<query>" [--rigged]`, the query
   being the asset's wiki name and “rick and morty”, `--rigged` for a
   person. It keeps only downloadable models under a licence the site can
   use (CC0, CC BY, CC BY-SA, CC BY-NC, CC BY-NC-SA; no ND) and under
   80,000 faces, ranks them, and writes the candidates (thumbnail, licence,
   faces, rigged or not, the model's page) to `lab/meshy/scout/<name>/`.
   A Sketchfab figure is judged by the same checklist as a Meshy one,
   against the reference sheet (step 1, which costs nothing and comes
   first): the silhouette, the main colours, every garment, the face, and
   for a person a skeleton, or a clean A- or T-pose that Meshy's rigger
   can take. It is rejected the same way: a fan model with the wrong
   colours, a missing garment or a melted face is a miss, however much it
   would save. A hit is imported with
   `node scripts/model-scout.mjs fetch <name> <uid> <out.glb>` to the path
   the generated asset would have had, credited in
   `src/data/modelCredits.json` and recorded in
   `lab/meshy/scout/<name>/chosen.json`; its concept and model steps are
   skipped and it goes on to steps 5 to 7. A person that came without
   clips gets idle, walk and run retargeted onto its own skeleton, as
   Avengers HQ's Sketchfab people do (`scripts/sketchfab-avengers.mjs`), or
   one with no skeleton is rigged by Meshy's rigger for 5 credits, as
   `scripts/meshy-galaxy.mjs` rigs a Sketchfab model. A Meshy community
   model the user has left in `lab/meshy/community/<name>.glb` is judged
   next, the same way. Only when nothing passes is the asset generated:
   the prompt (step 1) and steps 2 to 7.
1. **A reference sheet first.** `node scripts/wiki-refs.mjs <wiki title …>`
   fetches each page's infobox image and its Appearance section into
   `lab/meshy/refs/<slug>/` (gitignored, like the concept images). The
   prompt is written against the sheet, naming every element on it: hair
   and brow, skin, eyes, each garment and its colour, shoes, what is held,
   in the repo's wording (`RICK`, `MORTY`, `BODY`, `AT_EASE`, `PROP`,
   `BUILDING`, `CAR` prefixes and suffixes in `scripts/meshy.mjs`). The plan
   carries the prompts, written from the sheets fetched for it.
2. **Settings.** Concept image `nano-banana-pro` (crowd-only figures
   `nano-banana`), A-pose for anything rigged. Image-to-3D on `latest`
   (meshy-7.1), `texture_resolution: '2k'`, `target_polycount` 30,000
   (crowd 9,000; heroes 40,000 with `geometry_resolution: '2k'`), remeshed
   to triangles. Textures are brought to 2048 px by the fetch step (1024
   for crowd copies and small props).
3. **Judge the concept.** Against the sheet: silhouette, the six main
   colours, every garment present, the face (brow, eyes, mouth), a clean
   A-pose with nothing fused to the body, no text, white ground. A miss is a
   reroll (delete the name's `image` entry, run `images` again), at most two;
   a third miss means the prompt is wrong: rewrite it.
4. **Judge the model.** The four thumbnails (front, back, left, right): no
   melted face, no merged limbs, colours as the sheet, feet on the ground.
   One reroll of the model; then back to the concept.
5. **Judge the rig.** Idle, walk and run in `scripts/preview/crew.html`:
   no twisted limbs, feet planting, the head up. A bad rig is rerolled (5
   credits) before anything else is rerolled.
6. **In the world.** A screenshot beside Rick at the figure's `height`
   (metres, the site's scale: Rick 1.85, Morty 1.5; the plan has a heights
   table) and in its place, judged once more; then it is committed with its
   credit (`public/games/credits.json` for Meshy's, `src/data/modelCredits.json`
   for a Sketchfab model).
7. **Never ship a miss.** A figure that fails at any step is left out of its
   scene and the scene still works; the plan's tasks say what happens to a
   place whose figure is missing (the hotspot stays, the line is read off a
   sign).

Rerolls are in the budget as a 20% contingency on every phase.

## Costs

Every figure in this section is a ceiling: what the plan costs if every
asset is generated. The sourcing order puts Sketchfab first, and every hit
saves its class's credits from the tables (all of them for a model that
comes rigged or needs no rig; all but the rigger's 5 and an idle's 3 for a
person that Meshy's rigger has to rig). The savings are expected to be
highest for the vehicles, the buildings and the main cast (Birdperson,
Squanchy, Mr. Poopybutthole and the others fans model most), and lowest
for one-episode characters (Total Rickall's parasites, Anatomy Park's
diseases, the Jerryboree's Jerrys), which few people will have modelled.
No saving is counted in advance: the tables stay as they are, as
ceilings, and a phase's bill is its ceiling less its hits, known once its
scout has run.

### Meshy's prices (read 2026-10-06)

API credits (docs.meshy.ai, pricing): image-to-3D with 2k textures 30, with
Meshy's ultra geometry +5; text-to-image `nano-banana` 3, `nano-banana-pro`
9; auto-rigging 5 (walk and run come with it); an animation clip 3; a
retexture 10. Plans (meshy.ai/pricing): Free 100 credits a month; Pro 1,000
a month at $20 ($240 a year); Premium 3,000 at $70; Ultra 8,000, listed at
$100 in the page's offer data (confirm at checkout). API credits are bought
prepaid from the subscription page; a per-credit price for top-ups is not
public, so the dollar figures below use the Pro rate ($0.020 a credit) with
the Ultra rate ($0.0125) as the floor.

### Per asset (ceilings: the asset generated)

| Class | Steps | Credits | ≈ $ (Pro / Ultra) |
| --- | --- | ---: | ---: |
| Hero, rigged, HD (H) | pro image 9 + model 30 + ultra 5 + rig 5 + idle 3 + sit 3 | 55 | 1.10 / 0.69 |
| Rigged person (R) | 9 + 30 + 5 + 3 | 47 | 0.94 / 0.59 |
| Prop, building, vehicle (P) | 9 + 30 | 39 | 0.78 / 0.49 |
| Big prop, building, vehicle, ultra (PH) | 9 + 30 + 5 | 44 | 0.88 / 0.55 |
| Creature, unrigged (Q) | 9 + 30 | 39 | 0.78 / 0.49 |
| Crowd-only figure (C) | 3 + 30 | 33 | 0.66 / 0.41 |

A reroll costs the step again (9 for a concept, 30 for a model, 5 for a
rig); the 20% contingency covers about one reroll in three assets.

### Per phase (ceilings: every asset generated)

| Phase | Models | Credits | With 20% | ≈ $ (Pro / Ultra) |
| --- | ---: | ---: | ---: | ---: |
| 0 Tooling, lazy areas, the dial | 0 | 0 | 0 | 0 |
| 1 The door and four places | 13 | 546 | 655 | 13 / 8 |
| 2 The house and Total Rickall | 20 | 900 | 1,080 | 22 / 14 |
| 3 The Citadel's districts, the map's set pieces | 14 | 623 | 750 | 15 / 9 |
| 4 Eight more destinations | 28 | 1,315 | 1,580 | 32 / 20 |
| 5 The Vindicators | 7 | 342 | 410 | 8 / 5 |
| 6 Vehicles, the Story Train, the fortress, the system | 11 | 474 | 570 | 11 / 7 |
| **1–6** | **93** | **4,200** | **5,045** | **101 / 63** |
| 7 The long tail (optional) | ~18 | ~560 | ~670 | 13 / 8 |

The plan's model tasks list every asset with its class, so the totals can be
rebuilt if a tier changes.

### Buying

The balance is 58 credits; one hero figure is 55. The cheapest way to the
whole of Phases 1–6 is one month of Ultra (8,000 credits, ≈ $100), which
also covers the long tail. Premium (3,000, $70) covers Phases 1–3 and half
of 4; a second month finishes. Pro (1,000, $20) is one phase a month.
Plan credits reset monthly and do not carry over, so buy for the phases
that will run in the month. Run those phases' scouts first (they cost
nothing) and buy for what is left: the figures above are what a phase
costs if nothing is found.

### Download weight

A rigged HD figure is about 1.0 MB plus 0.15 MB of clips; a standard rigged
figure 0.4–0.9 MB; a crowd copy 0.12 MB; a building 0.3–0.5 MB. A
destination with its people is 1–3 MB and loads only when dialled; the
page's first download does not grow (`WORLD_MB['/c-137']` stays 15, and the
README's "about" note says a destination is 1–3 MB more).

## Success criteria

- The garage portal dials: the dial lists every destination with a line,
  the hero's button picks one and lands in the world dialled to it, each
  destination has its portal home, and a destination not yet loaded shows
  its line behind the swirl and never a blank canvas.
- Every new person is a rigged figure that passed the gate (found on
  Sketchfab, a Meshy community model, or generated), stands at its height,
  idles, walks and (where it sits) sits, has a line when you come up to
  them, and is credited: in `src/data/modelCredits.json` if it came from
  Sketchfab, in `public/games/credits.json` if it came from Meshy.
- Every asset was scouted before any credits were spent on it.
- Each destination has at least one task in the world's list, kept between
  visits like today's, and an achievement where the plan says so.
- Total Rickall, the Locos quest, the Vindicators' rooms and the NX-5 event
  have pure, tested rules; `npm run lint`, `npx vitest run` and
  `npm run build` are clean at every commit.
- The first download of `/c-137` does not grow; a phone or a low tier draws
  fewer crowd figures and skips the scatter, as the worlds do today.
- Browser screenshots of every destination, every scene and every new
  person in place, in `docs/superpowers/shots/`.

## Out of scope

Voices for the new people (the `scripts/voices` pipeline can add them
later), online play inside destinations beyond the ghosts the street has,
the comics and games of the franchise, any model that has to be bought
(Sketchfab's store included: the scout takes free downloads under the
licences above), and the long tail's places until Phase 7 is chosen.

## Open questions

1. Which Meshy purchase, once the scouts have said what is left: one month
   of Ultra for everything (recommended at the ceilings), or Premium phase
   by phase?
2. Phase order: the four Tier 1 places first, or the house (Tier 2) first
   because its people appear most? The plan takes Tier 1 first because the
   dial is what makes the page a portal.
3. Total Rickall as click-to-shoot in the room (assumed) or with the map's
   gunplay brought into the house (more work, more feel)?
4. The Vindicators as a destination (assumed) or a route of its own with a
   page section, like the Citadel?
5. Replace the map's code-built Birdperson and Phoenixperson with the new
   models (assumed yes)?
6. Phase 7 at all, and which of its places.
7. Will the user hand-download Meshy community models into
   `lab/meshy/community/<name>.glb`? Meshy has no API for them and this
   environment has no login to meshy.ai, so without that the order is
   Sketchfab, then Meshy generation. If yes, the assets worth looking for
   there are the ones the scout found nothing good enough for.
