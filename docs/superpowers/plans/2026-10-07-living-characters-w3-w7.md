# Living characters, W3–W7: every other world

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring every remaining world's player and NPCs onto the shared layer to the bar W2 set for Rick and Morty and Star Wars: no foot sliding, no bind pose, no lockstep, no plank deaths, no snapping turns; heads that look, actions in context, brains whose modes show, ambient people with errands and company.

**Architecture:** One task per world group, each on its own files, each using what W1–W2 built: `lib/three/animator.js` (through `figureCalls.js` / the meshyCast and footScene adapters, or `rig.js` figures), `lib/three/gait.js` for figures without clips, `lib/ai/body.js` + a world `MODE_BODY`, `lib/ai/react.js`, `lib/ai/needs.js`, `lib/ai/social.js`, `lib/emote.js` (the wheel, the wire) and `lib/three/animBudget.js`. The clip library has Rick's, Meshy's 13 shared, the troopers', 36 UAL and 113 Meshy `act-*` clips.

**Tech Stack:** three.js, vitest, the W1–W2 modules.

**Spec:** `docs/superpowers/specs/2026-10-07-living-characters-design.md` (W3–W7). **The per-character findings:** `docs/research/2026-10-07-character-audit.md` (each world's characters, files, problems and opportunities).

## Global Constraints

As the W2 plan's (callers' shapes, keys/lines/events/saves/achievements/dev hooks unchanged, bodies never change decisions, player reactions short and cut by input, 0.15 m/s foot slide, `lib/ai` free of three.js and `Math.random`, emote key `B` where free else `Z`/`U`/`T`, art styles kept). Plus: Middle-earth's humanoids move to the Meshy toy cast in `public/models/middleearth/cast/` (29 figures, each with its own `-idle|walk|run.glb`), the creatures stay procedural on `gait.js`.

## Review Focus

- A world whose figures fail to load (soft WebGL, a 404): the old procedural figure still draws and moves.
- Phones: `animBudget` and the device tier keep crowds within today's frame time.
- Online ghosts from older clients (no `emote`/`motion`) still walk.
- A seeded puzzle or chase (Infiltration, Rush, the Shire hunt, Weathertop) gives the same outcomes before and after.
- A reaction during a base state (seated, swimming, driving, riding) stays on the upper layer and doesn't stand the figure up.

---

### Task W3: the universe on foot, the cockpits, the wire (`src/components/universe/` landings and footScene's people beyond troops, `src/components/cockpit/`)

The landing figures (Portal-cast Beth, Jerry, Birdperson…; the site's own Saul, Mike, Gus, Dwight with their unused `look/wave/nod/shrug`; the Avengers HQ heroes; the static Gandalf, Sam, Mario, resort guests) turn their heads to you, greet, gesture while their lines play, breathe; the crewmate takes hits and stops shuffling; the player crew's one-shots (cheer on cleared, hit, fall) and emote wheel (the universe on foot uses `B` for gadgets: use the next free key); multiplayer guests carry hurt/down/action and emotes; the built-box troopers swapped for the rigged trooper GLBs; the cockpit crews (Chewie's clip forward, the cruiser's Morty on `scared`, Walt and Jesse react to the RV's driving).

### Task W4a: Invincible (`src/components/invincible/`)

`rig.js`'s figures on the animator where their templates have clips (Mark's walk/run stride-synced, no restart at frame 0), townsfolk heads instead of turret turns, reacting to fresh craters (`scared`, flee), Eve's patrol as a utility pick that answers fights and waves, Omni-Man/Allen/Thragg face Mark and use their own talk clips, Think, Mark!'s hover/fly/hit/cheer, the Flaxans' telegraph and shot tokens, the pavement walkers steered with separation, the rescue victim's flail and relief. `rig.js` changes (act() stride-synced crossfade, pose() as a weighted layer over clips, look via ROLES) live in `src/lib/three/rig.js` and are this task's.

### Task W4b: the Avengers (`src/components/avengers/`)

The compound's Thor, Natasha, Hulk and the training bot greet, gesture, train (`pushup`, `boxing`, `curl`, `jacks` from the clip library) instead of standing rooted; Spider-Man's walk within its rate and his run used; Smash Run's Chitauri fire and their idle doesn't slide; Infiltration's guards snap their heads on alert (drawn only: the solver unchanged); Iron Man's armour stays as built (no rig) but bobs and banks naturally.

### Task W4c: Cybertron (`src/components/cybertron/`)

No idle↔pose pop, an aim pose standing, the area people breathe and talk (sim.talk drawn), foot soldiers' real velocity (no marching in place on hold), deaths that fall instead of flailing upright, bosses taunt, charge and stagger, the stages on real `dt`, Roll out's run stride-matched and no running mid-air, the Vehicons strafe with hips turned and stop facing the camera, Predaking's flyover with wing flaps; one clip loader instead of three.

### Task W5: the office, Albuquerque, the Caribbean (`src/components/office/`, `src/components/albuquerque/`, `src/components/caribbean/`)

The office's seventeen and Albuquerque's fourteen on borrowed idle/walk/sit under their existing procedural passes (look, reach, typing), stride-matched, sitting down and standing up through `base`, breathing seated, with a working day (`needs.js` + the world clock: desks, the kitchen, the conference room, Michael's office) and conversations; Albuquerque's cast on phones at a lower count, looking at the car, Saul waves, Tuco taunts, Hector's bell, the Metherria queue walks up instead of teleporting, sidewalk civilians with errands; Jack Sparrow answers the helm, the broadsides and the kraken; the kraken's tentacles bend (a procedural chain, not poles); the navy ships keep formation and don't fire blind.

### Task W6: Middle-earth (`src/components/middleearth/`)

The humanoids become the Meshy toy cast (by role: the player's Frodo/Sam/Gimli/Pippin/Gandalf, every town's cast and townsfolk, the followers, Boromir, Saruman, the orcs/Uruks/Easterlings/goblins as the watchers' and extras' bodies) loaded through the cast adapters (their own idle/walk/run; the library for the rest), sized to the towns' scale, tinted/lit to the world's look; the procedural toy figures stay as the fallback. Then: the watchers' patrol and chase on their walk and run, an attack on a catch (`jab`/`kick`), suspicion and search drawn (`look.around`, `walk.search`); the followers off the conga line (steer separate, their own pace); the goblins fight; the story cast's idles out of step with heads that look and the map hub's greeting brought to every town; Rush's hobbits carry and chop on clips (`walk.carry`, `interact`); Saruman's duel on clips (`cast`, `hit.chest`, `knockdown`). The creatures on `gait.js` (Shelob walks home unreared and flinches at the phial; the Balrog's Moria chase stride-matched; one Gollum and one Balrog builder; the horses' gallop cadence uncapped by speed; the Shire's dogs on `watchers.js` with their `far` and `search` read; the sheep in the rules, seeded). Online ghosts as the cast's figures.

### Task W7: the stylised rest (`src/components/mario64/`, `src/components/dotmatrix/`, `src/components/minecraft/`, `src/components/deathstar/`)

Mario: no pop between actions (eased pose blends), the run matched to speed, Goombas and Toad turn eased, the Bob-ombs' fuse only on sight (perception), King Bob-omb's defeat on time since, the Chain Chomp's tell. Dot Matrix: the hero's feet on `gait.js`, villagers who notice and greet the hero, walkers that turn instead of flipping. Minecraft: if mobs or a player body exist, on `gait.js` with Minecraft's own limb swing; otherwise nothing. The Death Star: TIEs that react to the player and Vader seen. Each keeps its look.

### Checks (every task)

- [ ] Tests first for what's testable (rules, pure helpers, adapters on fixtures); `npx vitest run` on the world's directory and `src/lib`; eslint on changed files.
- [ ] A list of exact browser checks (hash route, what to do, what to see).
- [ ] The lead runs `npm run lint`, `npm test`, `npx vite build`, `node scripts/anim-check.mjs` on each world's route, takes shots, merges.
