# WebGL games: Transformers and Rick and Morty

Date: 2026-10-04 · Status: approved by the brief (autonomous session)

## The brief

> Add WebGL and nice Transformers games and page. If they have hardware
> acceleration off, say sorry, needs hardware acceleration on. Improve the
> site, and add a Rick and Morty site and game as well. Make sure any game is
> very robust, features- and textures-wise. Use proper textures.

Design read: a developer portfolio whose fan "worlds" are its personality.
The new work keeps the house conventions (one world per fandom, rules apart
from drawing and unit-tested, everything painted in code so nothing is
downloaded, plain-English copy) and raises the bar for the games: real 3D,
lit, textured, with juice.

## What changes

### 1. Hardware acceleration gate (`src/components/games/GpuGate.jsx`)

The new games are WebGL only. Before one loads, the gate checks the probe in
`src/lib/gpu.js`:

- **Hardware WebGL**: the game loads.
- **Software WebGL** (SwiftShader, llvmpipe… which is what browsers fall back
  to when hardware acceleration is switched off) or **no WebGL**: a card says
  *"Sorry, this game needs hardware acceleration on."* It explains what
  happened in one line, shows the steps for the visitor's own browser first
  (Chrome, Edge, Brave, Opera, Firefox, Safari), and offers *Check again*. Where
  software WebGL exists, *Play anyway* runs it at reduced quality.
- The probe learns to tell those two apart: it asks for a context without the
  performance-caveat flag when the strict request fails.
- At runtime a lost context or a crash in the renderer shows the same card with
  a *Restart* button instead of a blank canvas.

### 2. Transformers: "Roll out" (on `/cybertron`, its own section)

A third-person highway game built around the one thing Transformers do.

- **Vehicle mode**: fast, steer across four lanes, hold to boost (burns
  energon, smashes debris), pick up energon cubes, launch off broken-road ramps.
- **Robot mode**: slower, auto-fires at what is ahead (aim assist), jumps
  barricades, drains energon. Out of energon, you fold back into the vehicle.
- Each obstacle is answered by a mode: barricades need a robot jump, broken
  bridges need vehicle speed off the ramp, Decepticons need robot blasters,
  traffic and bombs need steering.
- **Cast**: Optimus Prime (cab-over truck, four shields, heavy blaster) and
  Bumblebee (yellow muscle car, quicker, rapid fire). Both are modelled as
  rigs of parts with a vehicle pose and a robot pose; the transformation is a
  staggered part-by-part animation, with sparks and the transform sound.
- **Stages**: Jasper, Nevada at sunset (boss: Starscream); Mission City at
  night (boss: Shockwave); Kaon on Cybertron (boss: Megatron, fusion cannon,
  floor beams you have to jump). Each stage has its own painted road, ground,
  props and sky.
- Difficulty (Recruit, Autobot, Prime), best score per difficulty, stage
  select for stages reached, achievements, pause, keyboard, touch and gamepad.

### 3. Rick and Morty: a new world at `/c-137`

- **Hero**: a live portal (WebGL shader where hardware allows, CSS otherwise)
  you fire with the portal gun to visit a dimension: each one swaps the scene
  and says where you are.
- **Portal panic** (the game): a twin-stick arena game across four
  dimensions (the Smiths' backyard, Cronenberg World, Gazorpazorp, the Citadel
  of Ricks). Enemies pour out of portals; collect Mega Seeds; after each wave
  pick one of three gadgets from Rick's workbench (Meeseeks box, Butter Robot,
  freeze ray, plumbus…); a boss closes each dimension (Snowball, a giant
  Cronenberg, a Cromulon, Evil Morty). Play as Rick, Morty or Pickle Rick.
  Toon-shaded with outlines, like the show, over painted textures.
- **Mr. Meeseeks box**: press it, give a Meeseeks a task; it does it to the
  site and poofs. Ask the impossible and they multiply.
- **Interdimensional cable**: a TV that flips between channels.
- **The family**: a roster card per character, each a color scheme.
- A fan theme, *Portal*, unlocked by typing `wubbalubbadubdub` (or `schwifty`)
  anywhere.

### 4. Site integration and improvements

Routes, the worlds switcher, ⌘K, terminal commands, the guide, achievements
(and so the Dundies), a Rick and Morty card in "Off the clock", and a 3D
planet hero on Cybertron where a GPU is present. The trench run's copy names
hardware acceleration when that is why it is in 2D.

## Architecture

Each game is three layers, as the trench run already is:

| Layer | File | Tested |
| --- | --- | --- |
| Rules: pure state + `step(g, dt)`, seeded, events out | `rules.js` | Vitest |
| Drawing: Three.js scene that reads the state | `*3D.js` | screenshots |
| Host: React, input, HUD, overlays, gate | `*.jsx` | lint + build |

Shared: `src/lib/stage3d.js` (renderer, tone mapping, bloom, resize, context
loss, adaptive quality, dispose) and `src/lib/paint.js` (seeded value noise,
fbm and canvas painters for the textures, plus normal maps via
`src/lib/texture.js`).

Robustness: fixed-step simulation (no tunnelling on a slow frame), delta caps,
pause off-screen and in hidden tabs, keys released on blur, every resource
disposed on unmount or restart, adaptive quality (pixel ratio, then shadows,
then bloom), context-loss and render-error recovery, reduced-motion respected
(no shake, softer flashes).

## Testing

- Rules: start, controls, each mode's answer to each obstacle, damage and
  invulnerability, pickups, bosses and phases, win and loss, determinism for a
  seed, "doing nothing loses" and "a simple bot does well".
- Probe: software vs. hardware vs. none, including the caveat retry.
- Visual: Playwright screenshots of each game in headless Chromium (software
  WebGL, via *Play anyway*) and of the gate.
