# The portal gun's kills, Rick's gadgets, and the planets up close: design

Date: 2026-10-06. Branch: `claude/portal-gun-fx`. Status: written from the
owner's brief without a live question round (the session ran unattended),
so every decision below is the owner's words, something the repo already
settled, or an assumption marked as one.

## What the owner asked for

"For the portal guns and stuff make cool animations when you shoot like it
opens a portal and it sucks it inside or the model starts ragdolling as the
portal cuts it in half like typical Rick and Morty stuff with portals and
make custom gadgets and have better textures in the planets and stuff."
Work goes up as branches and pull requests, merged to main as each lands.

## Where the portal gun is

- **The universe map, on foot** (`src/components/universe/footScene.js`):
  Rick carries it (`PARTY.cruiser`, `gunplay.js`'s `portal`) against the
  Federation's squads, who are Meshy-rigged figures on the 24-bone skeleton.
  This is the one place the gun is fired today. A kill tips the trooper over
  like a plank (`fallTurn`).
- **The galaxy's worlds** (`src/components/galaxy/surface/`): the gun has
  numbers in `weaponRules.js` but no hero carries it and the hero panel never
  offers it (`PICKABLE`). Targets are figures built from shapes
  (`figures.js`) or models (`catalog/*.js`); a kill sets `down` and the
  figure is left as it stands.

## Decisions

- **One set of effects, in `src/lib/three/`**, so both worlds draw the same
  thing and neither reaches into the other (docs/health/RULES.md: what two
  worlds need moves down to lib). The portal's GLSL moves from
  `rickmorty/swirl.js` to `lib/three/swirl.js`; the old path re-exports it,
  so no caller changes.
- **A portal kill** (`lib/three/portalFx.js`): the shot lands; a portal
  opens on the ground just behind the figure, tilted up at it (0.2 s, the
  swirl's own opening); the figure is pulled off its feet toward the eye,
  tumbling (ragdoll over the clip), and clipped by the portal's plane as it
  goes through, so it sinks into green rather than behind the disc; at a
  random point between the waist and the shoulders the portal snaps shut
  (0.12 s, a flash of the lip) and what was still on this side stays cut at
  that plane, ragdolls to the ground and lies there until the troop's own
  despawn. Nothing comes out the other side: the show's rule.
- **The ragdoll** (`lib/three/ragdoll.js`): no physics engine. Each joint
  in a chain is a damped angular spring from where the clip left it, given
  an impulse at the start (the way the shot pushed, plus noise) and pulled
  by gravity through its own length; the root falls and rolls. Works on
  Meshy's bones and on a built figure's groups alike, because it is given
  named Object3Ds and their parents. Pure stepping, tested in Node.
- **Clipping** uses `material.clippingPlanes` (the universe scene already
  sets `localClippingEnabled`; the galaxy scene too). A figure's materials
  are shared across copies, so they are cloned for the figure the moment it
  is portalled and put back on dispose.
- **Rick's gadgets** (assumption: the owner's "custom gadgets" means more
  of Rick's inventions to shoot with, as the show has them, not Portal
  panic's upgrades): the **freeze ray** (a trooper hit stops dead where it
  stands, ice grows round it, 1.5 s later it shatters to shards) and the
  **shrink ray** (a trooper hit shrinks over half a second to a tenth,
  squeaks, and pops). Each is a `GUNS` kind built in code, each with its own
  flash colour and bolt. On foot the one carrying the portal gun cycles
  gadgets with **B** (portal → freeze → shrink); the galaxy's hero panel
  offers all three under Elsewhere.
- **The planets**: the galaxy's worlds (procedural, `galaxy/bodyShaders.js`)
  get the ground scans the surfaces already wear (`public/cc0/galaxy/`)
  blended in up close, triplanar, colour and normal, fading in below a few
  radii, so a world skimmed by the ship shows sand, snow, forest floor and
  rock rather than a smooth noise field. Far off nothing changes (the
  screenshots in `lab/` and `docs/readme/` are the check).

## Non-goals

- Physics libraries, new models, Meshy or Sketchfab (no network for them).
- The sequel trilogy, anywhere.
- Portal panic's own game (its shapes aren't rigged; its upgrades stay).

## The parts, in order (one pull request each)

1. `lib/three/swirl.js`, `lib/three/ragdoll.js` (+ test), `lib/three/portalFx.js`;
   the universe's foot combat portals a trooper the portal gun kills.
2. The gadgets: `gunplay.js` kinds, the foot combat's B key and effects, the
   guide's rows, the HUD line.
3. The galaxy's worlds: `PICKABLE` grows the three, `struck()` carries the
   gun kind, `activity.js` plays the same effects on its targets.
4. The planets' detail layer.

Landed: 1 (#400), 2 (`claude/rick-gadgets`: the freeze ray and the shrink
ray, `lib/three/gadgetFx.js`; shots in `docs/superpowers/shots/`).

Each: `npx eslint .`, `npx vitest run`, `npx vite build`,
`node scripts/health.mjs --check --skip build`, a browser check through the
dev server, then the PR and the merge.
