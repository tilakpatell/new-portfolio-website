# Kamino, rebuilt round its people: every one a model. The design

Date: 2026-10-09. Status: design, written by an architecting session from the owner's brief, for the sessions that carry it out (phases in order, one pull request each, merged as each is done). The plan is `docs/superpowers/plans/2026-10-09-kamino.md`.

## What the owner asked

“Architect a way to make the planet Kamino better. Make sure ALL NPCs are models and not the weird custom blobs. Make it robust, and make a PR and merge to main regularly.”

So three things: Kamino better as a place to be; no person or creature on it drawn as primitives, ever, including when something fails; and the work landed in small merged steps, not one long branch.

## Where Kamino is today

Read from `main` at 657d67573 in this session (three read-only sweeps and a browser run at `?quality=high`).

**The site.** `SITES.kamino` is `sites/core.js:352-568`, beside Geonosis; Taun We and the one quest come from `sites/quests.js:99-104`. Tipoca City is nine round decks (`kpad`, floor at y 22.3) and six bridges (`skybridge`) over a sea at 0 and a sea floor at −40, with 16 placed Meshy domes, 3 towers, 30 and 10 more scattered past 360 m, 6 discharge towers that take the storm's lightning, rain, spray off the stilts, an Acclamator overhead. Six places, one quest (Taun We sends you to shoot Jango by Slave I), no zones, no interiors, no assault. Two decks, at (−260, 330) and (460, 260), have floors and no bridge.

**Its people, and how each is drawn** (`scripts/galaxy-figures-audit.mjs`, `actors.js:455-460`'s `anyFigure`):

| who | kind | count | drawn as | the problem |
| --- | --- | --- | --- | --- |
| clones on the parade pad, cadets, roamers | `clone` | 28 | crew model (`troops/clone.glb`, Meshy skeleton, shared clips) | none |
| Jango Fett | `jango` | 1 + the quest's | crew model (`crew/jango.glb`) | if the file fails, nothing; the prop `jango` in `props/core.js:1345` is capsules |
| Phase I clones | `clonephase1` | 4 | Sketchfab statue, legs found at run time (`legRig.js`) | legs only: arms, head and torso rigid, no clips |
| Kaminoans, Lama Su, Taun We | `kaminoan` | 5 | Sketchfab statue, legs found at run time | the same; the built `PEOPLE.kaminoan` (`figures.js:29`) if the file fails |
| R5 | `r5` | 1 | static model, hums | fine for a droid |
| young Boba Fett | `villager` | 1 | **built in code**: capsule limbs, sphere head, robe cylinder (`figures.js:111-450`) | a blob |
| aiwhas | `aiwha` | 4 | static Meshy model, bobs and dives | frozen wings; the prop fallback (`props/core.js:1376`) is capsules |
| the ground war's Hutt side | `mercenary` | up to 28 (`ground/population.js` POP) | **built in code** (`figures.js:53`, no crew or catalogue row) | blobs; one attacked in the run |

So the blobs on Kamino are young Boba always, every mercenary whenever the Hutt side holds or contests the world, and whoever's file fails to load (the resolver's last two steps are `buildFigure` and `propFigure`, `actors.js:459`; `activity.js:358-379` and `ground/groundFigures.js:102` end the same way). Nothing anywhere stops a built figure from reaching a site.

**What's thin.** One thing to do. No way inside a single dome, though the cloning facility, Lama Su's chamber and Jango's flat are the film's Kamino. Taun We and Lama Su stand where they're put. The army the film reveals is twenty clones. The Clone Wars' Battle of Kamino isn't there. The surface's `look` and `grade` are the defaults (the living-layer design's brief for Kamino is “steel blue, high contrast”).

**Robustness found on the way.** A shader fails to compile on Kamino every load: a `MeshBasicMaterial` whose vertex program has no `mvPosition` gets `skyfog.js:52-56`'s line `vSkyFogDir = transpose(mat3(viewMatrix)) * mvPosition.xyz;` (`THREE.WebGLProgram: Shader Error … 'mvPosition' : undeclared identifier`), so that material draws nothing. Five far domes stand past the 590 m reach. `validity.js:19-26` counts `kpad` as a deck and not `skybridge`.

**Budget at high** (`lab/baseline/surface-high.json`): 99 calls, 1,084,196 triangles, 6.6 MB of models, against the row's 700 calls, 3M triangles and 60 MB (`src/lib/budgets.js`).

## What done looks like

1. No person, droid or creature on Kamino is ever drawn from primitives: not in `life`, a zone's `life`, a quest's spawns, the ground war, the assault, or after a failed download. A kind with no model is hidden and reported, never built. A test proves it from the data; the browser run proves it from the scene.
2. Every named person on Kamino is a rigged model that plays the shared clips (idle, walk, talk, turn their head): Taun We, Lama Su, Nala Se, Jango, young Boba, Obi-Wan, the Phase I clones. The aiwhas beat their wings.
3. Kamino has three ways in (the cloning facility, Lama Su's chamber, Jango's quarters), four things to do (the tour, Jango's departure, the army, the Battle of Kamino), and its own look.
4. Zero console errors on the surface. Every deck you can stand on is reachable from the landing. High stays under 220 calls, 1.8M triangles and 16 MB of models.
5. Each phase lands as its own merged pull request, green on the four gates and the surface check.

## The design

### 1. Models only: a site's figure policy

A site may say `figures: 'models'`. Kamino says it; the other sixteen don't yet, and nothing changes for them.

`src/components/galaxy/surface/figurePolicy.js` (new, pure where it can be, tested):

```js
export const STANDINS = { … };                       // kind → model kinds to try, in order, when its own fails
export function modelChain(kind, { CREW, SURFACE_MODELS, WALKERS }) → [kind, …standins]   // pure: the kinds that have a model, in order
export async function modelOnly(kind, spec, i, models) → figure | null                    // walker → crew → catalogue, down the chain; never built, never a prop
export function missing() → [{ kind, why }]                                                // what came back null, for the QA run
```

`modelChain` keeps only the kinds that have a crew row, a catalogue row or a walker. `modelOnly` walks it with the resolvers that exist (`walkerFigure`, `crewFigure`, `modelFigure`), each behind `.catch(() => null)`, and returns null when all fail; it never calls `buildFigure` or `propFigure`. A null figure already leaves an actor hidden (`actors.js:538`), so the world plays on without it; `missing()` records it and `__surfaceScene.life.missing` shows it to the QA script.

Each kind in the chain is tried as a walker, then its crew model, then its catalogue model, so a kind with both (the rigged Kaminoan of phase 3 and the Sketchfab statue it replaces, kept at its catalogue path) falls back from one to the other by itself. `STANDINS` is data for what comes after: another real model of the same role, never a blob. `clonephase1: ['clone']`, `jango: ['bobafett']`, `mercenary: ['hondo', 'rodian', 'gamorrean']`, `youngboba: []` and `aiwha: []` (hidden rather than wrong).

The wiring is one option, passed down where the site is known: `scene.js` reads `site.figures` and gives `createActors`, the activity layer and the ground war's figure pool `only: true`; each of those three swaps its resolver for `modelOnly` when it's set (`actors.js`'s `anyOf`, `activity.js`'s `figure`, `groundFigures.js`'s `make`). About ten lines across four files; nothing else in them moves.

The test (`sites/kamino.test.js`) walks every figure Kamino can make, from the data: its `life`, every zone's `life`, its quests' spawns, its assault's `kinds` on both sides, the ground war's `kindFor` for every side that can hold it (`ground/troops.js`), and asserts each has a non-empty `modelChain` whose first entry is the role's own model, except kinds listed as hidden-until-made. `galaxy-figures-audit.mjs` gains `--site kamino --strict`: exit 1 if any Kamino kind is `built` or `none`.

The ground war's `mercenary` gets models for every world, not only Kamino: it becomes a family of the cartel's crew (`hondo`, `rodian`, `gamorrean`, `greedo`, picked per soldier the way `garrison.js` picks), in `ground/troops.js`. The built row stays in `figures.js` for the sixteen sites that haven't opted in.

### 2. The cast: models for every role

| role | today | becomes | how | credits |
| --- | --- | --- | --- | --- |
| young Boba Fett (`youngboba`, 1.3 m) | built villager | crew model on the Meshy skeleton | `scripts/meshy-galaxy.mjs`: concept image, model, rig (a ten-year-old boy, dark hair, blue-grey quilted jacket, A-pose; no franchise names in the prompt) | 44 |
| Kaminoans (`kaminoan`, 2.6 m): Taun We, Lama Su (×1.08), Nala Se, technicians | statue on found legs | crew model on the Meshy skeleton | first `rigurl` on the existing Sketchfab file (5); if Meshy refuses the pose, a new one from a concept image in A-pose (44). The old file stays as the catalogue's `kaminoan`, the fallback | 5 to 44 |
| Phase I clones (`clonephase1`) | statue on found legs | crew model | `rigurl` on the existing file (5), else a new one (44); the old file stays as the catalogue's, the fallback | 5 to 44 |
| Obi-Wan Kenobi | not on Kamino | crew `obiwan` | exists | 0 |
| R4-P17 | not on Kamino | catalogue `astromech` (an R-series droid; its dome is not recoloured) | exists | 0 |
| aiwhas | static | the same file, wings beating (§3) | code | 0 |
| clone cadets, Domino squad, Rex, Fives, Echo | 6 anonymous cadets | crew `clone` (cadets at ×0.9) and `rex`, named, with lines | exists | 0 |
| the droid army (the battle) | not on Kamino | crew `battledroid`, `superdroid` | exist | 0 |

At most 132 credits (all three new), at least 54 (both rigs take), from the third Meshy account (`~/.tilakverse-meshy3.env`). Each asset stays on one account from image to rig. Outputs go through the pipeline's own compression into `public/models/galaxy/crew/<kind>.glb`, under 1 MB each, credited in `public/cc0/README.md` and `src/data/modelCredits.json`. Nothing on the site calls Meshy.

Lama Su, Nala Se and Taun We are the one Kaminoan file: Lama Su at ×1.08, the others as they are (crew rows take no tint today, and the film's three read alike at a distance; Lama Su's crest is not modelled).

### 3. Aiwhas that fly: a wing beat in the vertex program

`src/lib/three/flap.js` (new, pure core, tested): `flapPatch(material, { span, amp, rate, phase })` patches a material's vertex program to bend each vertex about the body's long axis by `amp · sin(rate·t + phase) · smoothstep(0.15, 1, |x| / span)²`, so the body stays put and the tips travel most; `flapAt(x, t, opts)` is the same sum in JavaScript for the test. The catalogue row says `flap: { span: 7, amp: 2.2, rate: 1.6 }`; `modelFigureOf` applies it to the figure's own material copies and steps a `uTime` in `update`, faster on the climb and held through the glide of a dive (`floats.js`'s `diveAt` phase). One uniform a figure, no new draw call, no rig.

### 4. The site in its own file, and its look

Kamino moves out of `sites/core.js` into `sites/kamino.js` (the pattern the Naboo lane uses for `sites/naboo.js`, PR #768) once #768 has merged: that PR deletes Naboo's block up to the line before Kamino's, so a move now would conflict with it. Until then Kamino is edited inside its block. Taun We and the quest fold in from `sites/quests.js` when the quests are reworked (phase 6). The move changes no pixel (shots before and after, `scripts/autopilot-check.mjs --before`). The site says `figures: 'models'` and gains:

- a `look` block (`look.js`'s `lookOf`): cool shadow (`#2c3c4c`), a steel edge, fog held low over the sea; the `grade` block (contrast up, saturation down, a cyan shadow and a white high) goes in when the living-layer lane's phase 3 gives `post.js` its split-tone uniforms, and until then is left out rather than unread;
- bridges to the two lone decks, so every floor is reachable;
- the five far domes pulled inside the reach;
- `skybridge` counted as a deck in `validity.js`, so soldiers and spawns may stand on bridges.

### 5. Ways in: three interiors

The zone engine Coruscant, Bespin and the others use (`zones: [{ door, back, inside: { build, spawn, bounds, rooms, light, lamps }, things, life }]`), with three builders in `props/insideKamino.js` (new, under 800 lines, tests beside it; registered with one line in `props/index.js`):

- **The cloning facility** (door on the facility dome's deck): a long curved white hall; racks of growth jars either side, instanced (one draw for the glass, one for the glowing fluid, the embryos inside a single low shape), the fluid's glow pulsing slowly; an observation walk at the far end over a classroom of cadets at a holotable. Nala Se and two Kaminoan technicians; the cadets (Domino squad) at their lesson.
- **Lama Su's chamber** (Prime Minister's tower): an oval white room, the egg-shaped chairs, a wide window onto the storm. Lama Su and Taun We.
- **Jango's quarters** (the quarters dome): a small flat, Jango's armour on a stand, a window streaked with rain. Young Boba; Jango when he's home.

Interiors are code-built rooms (they are architecture); everyone in them is a model, under the policy. Each is drawn only while you're inside, as zones are now.

### 6. Things to do

1. **The tour** (Taun We, on the landing pad): walk with her to Lama Su's chamber, then to the growth hall, then to the parade balcony; she talks the way, on the film's beats in the site's own words. Steps are `reach` steps; she walks ahead on the bridges (`life`'s `path`, `speed`), so the step's place is wherever she is.
2. **Jango's departure** (the existing quest, reworked): it starts in his quarters with Boba at the window; Jango leaves for Slave I; you catch him on the pad in the rain and fight; won, Slave I lifts off (the prop's `signal('lift')`: it rises, turns and goes into the clouds, and is back next visit).
3. **The army**: from the parade balcony, the ranks: the 20 clones on the pad plus a far army of 400 in blocks on the two outer decks, one instanced static clone at a few hundred triangles (a low cut of `surface/clone.glb`, made once with the pipeline's simplifier), a single draw. A place, “the army”, found by seeing it.
4. **The Battle of Kamino** (an assault, `missions/assaults.js`'s `kamino`): the Republic (`clone`, Rex, Fives and Echo named) holds the pad, the parade ground and the facility; the Separatists (`battledroid` 3, `superdroid` 1) come up out of the sea onto the decks' rims. The assault engine assumes ground under its posts and staging lines; this phase starts with a spike (an hour, its answer written into the plan) on spawning attackers on floors rather than land. If the engine can't take it in a day, the battle ships as a quest instead (Rex gives it): three `shoot` steps whose spawns are droid waves standing on the decks' rims (`activity.js` spawns at the step's `at`, on a floor), and the assault waits.

### 7. Robust

- The shader: find the `MeshBasicMaterial` whose program lacks `mvPosition` (by name, in the page), and make `skyfog.js` patch only programs that have it (`vertexShader.includes('mvPosition')`), with a test on a stub shader; then that material is fixed or skipped. No console errors becomes a check line in the QA run.
- Every deck reachable: a pure `sites/decks.js` (decks and bridges as nodes and edges, from `things`) and a test that every floor is reachable from `land.at`; every `life` row, quest step and zone door stands on a floor.
- Every figure a model: §1's test and audit line.
- Budgets: `scripts/galaxy-check.mjs surface kamino` with `BUDGET=1` at high and mid in every phase; a phase that adds triangles re-makes Kamino's line in `lab/baseline/surface-high.json` and `surface-mid.json` and says the numbers in its commit. Interiors cost nothing outside.
- A QA script, `scripts/kamino-check.mjs` (kept): lands, waits for walk, lists every actor's kind, mesh count, skinned or not and geometry types, fails on any `CapsuleGeometry`, `SphereGeometry` or `BoxGeometry` body in `life`, any `missing()`, any console error; shoots each named person close up and the four wide views; runs the tour and the departure by `__surfaceDo`.

## Decisions (for the owner to overturn)

1. **Policy, not deletion.** Built figures stay in `figures.js` for the sites that haven't opted in; Kamino opts in. Other worlds can opt in one at a time later.
2. **Hidden beats wrong.** A role with no model is hidden and reported, never drawn as a blob or as someone else of a different role. Young Boba is hidden between phase 2 and phase 3 if the order holds.
3. **Meshy for the three gaps, rig first.** The cheaper `rigurl` on the files we have is tried before a new model. Up to 132 credits, third account.
4. **The mercenary gets models everywhere,** since its fix is a data row in `ground/troops.js` and no world wants it built.
5. **Rooms built, people modelled.** Interiors are code, as every zone on the surface is; nothing alive in them is.
6. **The grade waits for its plumbing.** Kamino's `look` now; its `grade` when the living-layer lane's phase 3 lands.

## What this is not

- Not the other sixteen worlds' figures (beyond the mercenary row).
- Not a new animation system: the Meshy skeleton's shared clips, `legRig.js` and `walkers.js` as they are.
- Not the space scene, the galaxy map's Kamino, or the fleets overhead.
- Not the Bad Batch's Kamino, its fall, or the sequel trilogy.
- Not a new dependency.

## Phases, one pull request each

| PR | what | gate beyond the four |
| --- | --- | --- |
| 1 | this design and its plan | none |
| 2 | `figurePolicy.js`, the three resolvers' `only`, the mercenary family, `figures: 'models'` on Kamino, the shader fix, `sites/decks.js`, the two bridges, `kamino.test.js`, the audit's `--strict`, `kamino-check.mjs` | `kamino-check` clean but for young Boba listed hidden |
| 3 | the cast: young Boba, the rigged Kaminoans and Phase I clones, Lama Su and Nala Se, Obi-Wan, R4-P17, the named cadets | `kamino-check` clean, nobody hidden; `anim-check.mjs` on Kamino holds feet; models under 1 MB each |
| 4 | aiwha wings (`flap.js`), the far army, Kamino's `look` | budget at high and mid, re-baselined |
| 5 | the three interiors | each zone's shot; budget outside unchanged |
| 6 | the tour, Jango's departure, Slave I's lift-off | both quests run to done in `kamino-check` |
| 7 | the Battle of Kamino (spike first) | the battle runs to a result in the check |

Each phase: branch from fresh `main`, the work, `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, the phase's surface check, a trial merge against the open branches that touch the surface (#768 Naboo's split moves Kamino's prop builders to `props/core/kamino.js`: this design adds no lines to `props/core.js` so the two don't meet), then the pull request, merged with a merge commit.
