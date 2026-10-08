# Handoff: the combat revamp

The design is `docs/superpowers/specs/2026-10-08-combat-revamp-design.md`, the plan `docs/superpowers/plans/2026-10-08-combat-revamp.md`, the audit behind both `docs/research/2026-10-08-combat-feel-and-offline-motion.md`. Each lane adds its section here when it merges; the next lane reads this first.

## Lane A: the look and the reticle

### Done

- **The look** (`src/runtime/look.js`, tested; exported from `src/runtime` too). `createLook({ host, win, onTurn(dx, dy), onButton(which, down), onLock(on), sensitivity, drag, mode, active })` → `{ attach, detach, request, release, set(mode), locked, refused, mode, prompt }`. `onTurn` takes **radians** (positive dx: the pointer went right), scaled by `sensitivity` (lock: yaw 0.0022, pitch 0.0018 rad/px) or `drag` (each world passes its old drag numbers). Modes `'lock' | 'drag' | 'touch'`; `defaultMode({ coarse, safariNoMouse, kept })` and `senseLook(win)` pick one (touch on a coarse pointer whatever was kept; else the visitor's pick under `tp-look`; else drag for Safari on a Mac, lock for the rest). `SPIKE` 60 px per event, `RELOCK` 1.25 s, `TP_LOOK`, `PROMPT` ("Click to look · Esc to release").
  - Review Focus 1: a refused lock (`NotSupportedError` asks again plainly; any other rejection, or a synchronous throw) throws nothing, keeps the prompt, and the drag goes on turning; after a refusal a still click is the left button, so the mouse can still fire.
  - Review Focus 2: each locked move is clamped to ±60 px, and the first move after locking is dropped.
  - Two things the plan didn't list, both tested: `active()` (the universe's canvas is the map's too: the look only works on foot, and lets go of the lock at the next move once you're back in the ship) and `refused` (the universe skips the shot on the click that asked for the lock).
  - In drag mode the left button is reported only for a click that barely moved (6 px), so a drag never fires.
- **Where a shot goes** (`src/lib/combat/aim.js`, tested, plain arrays). `aimPoint(ray, solids, targets, { min = 1.5, max = 120 })` → `{ at, target, dist }` (`target` is the capsule object; its `ref` is the world's thing); `assist`, `friction` (0.55 or 1), `lead`, `ASSIST`, `coneFor({ coarse, mode })` (a mode `'touch'` counts as coarse), and `rayCapsule(o, d, a, b, r)` exported for anyone who needs a ray against a body. `assist`'s cap bounds one call, so a mouse's 0.01 rad cap means a shot 0.015 rad off is pulled 0.01, not all the way: the test uses an uncapped cone to show the pull alone.
- **The reticle** (`src/runtime/hud/Reticle.jsx`, its rules `reticle.js`'s `reticleState`, tested; both from `src/runtime/hud`). Four ticks that close with `tight`, the `--hud-bad` colour for 180 ms on a hit, a `--hud-accent` ring on a lock; drawn in `hud.css`, no text, pointer-events none. A world skins it by `--hud-ink`, `--hud-accent`, `--hud-bad` on its own class.
- **The galaxy surface** (`scene.js` plus two small files beside it, so `scene.js` grew by about fifty lines, not the whole wiring):
  - `surfaceLook.js`: the controller on the canvas; `pressLook` (tested) maps the buttons onto the flags F, C and the touch buttons already set: left `buttons.fire` (a gun's shot is queued too, so a quick click still shoots; a saber's press is noted and the stroke goes on release, held for the heavy one, the touch Swing's path), right `ads` with a gun and `buttons.block` with a saber. The page hears `{ type: 'look', mode, locked, prompt }`.
  - `aimShot.js` (tested): `aimDir` is the camera's ray, from level with the figure (nothing between the camera and your back is aimed at), against the shootables as capsules and the ground (`groundSolids`) as the solids, bent by `assist` with the look's cone; `fire()` and the burst's next shot take that direction from the eyes' point, so the muzzle's bolt goes to what the crosshair is on. `lookFriction` slows `turn()` over a target with a gun up.
  - `look(dx, dy)` keeps its pixels for the page's touch pad and calls `turn(dx, dy)` in radians; the emote wheel under the lock is pointed at by summed movement, and the turn waits while it's open.
  - `GalaxySurface.jsx`: the kit's `Reticle` in place of `.surface-crosshair` (shown when the old crosshair was, and whenever a gun is up in the walk; tight with the sights; the hit flash; the lock ring); the kit's `Prompt` for the look, bottom middle, a click on it locks too; the Menu's **Look: Click to lock / Drag** (`input.lookMode`, kept under `tp-look` for every world).
- **The universe on foot**: `universe/scene.js` makes the controller with `active: onFoot` and the foot's old drag numbers; the mouse's on-foot drag now goes through it; a click still fires through the map's own `onUp` (and under the lock), except the click that asked for the lock. `footScene.js` gained `turn(dx, dy)` in radians (`look` in pixels calls it). `UniverseMap.jsx` shows the kit's Prompt top middle while on foot and not locked (`lookLock()` on the scene asks for it).
- **Rick and Morty** (`RmWorld.jsx`): the controller in an effect on the canvas; a mouse is its, a finger still the old drag. Total Rickall's shot is `onButton(0)` (a click in drag mode, the left button under the lock). `RmHud.jsx`: the kit's `Reticle` in place of `.rm-crosshair` (the lime ring on whoever's in the sights) and the look's Prompt when nothing else is asked.
- **The guide** (`guide/pages.js`) and the street's first hint say "Click, then the mouse: look round (Esc lets go)"; the galaxy's rows say the left and right buttons.

### For the next lanes

- **Lane B**: when `world.solids` lands, replace `groundSolids(world)` in `aimShot.js`'s `aimDir` with it, and pass the aim point (`aimPoint`'s `at`) as the bolt's end rather than only the direction: `aimDir` already computes it. Keep `aimed(from)` in `scene.js` as the one place the player's shot direction is made. `lead` exists in both `aim.js` and B's `accuracy.js` with the same signature; one can go.
- **Lane C**: the left button arrives as `state.buttons.fire` with `state.pressAt` and `state.touchPress` (the stroke on release, the heavy one held); the right button as `state.buttons.block` with `state.blockAt`. Read the stroke's direction from the movement keys as the plan says; nothing here needs to change.
- **Lane E**: the universe's reticle is still the map's own projected `.universe-reticle` (numbers through refs); E1's `Reticle` swap and the aim point for its shot are yours. `footScene`'s `turn` has no friction yet (`lookFriction`'s pattern in `aimShot.js` is the one to copy). The touch fire button's snap is `ASSIST.touch.snap`; `coneFor({ mode: look.mode })` gives touch on a phone.
- The galaxy's Menu is the only place the Look setting is shown; the universe and Rick and Morty read the same `tp-look`. A Menu item there is a small follow-up.

### Left

- **A trackpad was not tried by hand**: this container has no trackpad and no Mac. Headless Chromium granted the lock and turned the camera from mouse movement on all three worlds; Safari's slow trackpad under lock (why Safari on a Mac starts in drag) is from the research, not seen.
- `senseLook` can't tell a Mac's mouse from its trackpad, so Safari on a Mac starts in drag even with a mouse; the Menu changes it.
- Friction is on the galaxy surface only (see Lane E).
- The universe's and Rick and Morty's look prompts were placed by eye on a 1280 × 720 screenshot; a phone never shows them (touch mode).

### Checking it

- `npx vitest run src/runtime/look.test.js src/lib/combat/aim.test.js src/runtime/hud/reticle.test.js src/components/galaxy/surface/aimShot.test.js src/components/galaxy/surface/surfaceLook.test.js`.
- In the browser (`npx vite --port 5188`): `/?quality=mid#/galaxy/tatooine/surface` with Han (`localStorage['tp-galaxy-hero'] = '{"id":"han"}'`) for the reticle, Luke for the saber's buttons; click the canvas and `document.pointerLockElement` is the canvas; Esc lets go and the prompt comes back. The universe on foot through `window.__universeDebug.startFoot()` near a planet (`scripts/foot-portal-check.mjs` shows how); `#/c-137` and `window.__C137__.rickall(1)` for Total Rickall.
- Drag mode: the galaxy's Menu → Look: Drag, or `localStorage['tp-look'] = 'drag'` before the page loads. Touch: a phone's viewport (`autopilot-check --phone`), where no prompt shows and the look pad turns.
