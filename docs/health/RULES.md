# The rules of the architecture

What the code should look like, for a session that has to split a file or decide where something goes. The measure (`scripts/health.mjs`) checks what it can; the lint config and the steward enforce the rest.

## Layers

```
src/data  ←  src/lib  ←  src/lib/three  ←  src/runtime  ←  src/components/<area>  ←  src/pages  ←  App.jsx
```

An arrow points from a module at who may import it. `src/lib` knows no React and no page. `src/lib/three` knows Three.js and nothing about any world. `src/runtime` is the world runtime. `src/data` is imported by anyone and imports nothing but other data.

## Worlds are islands

A world (`src/components/<world>/`) imports from `src/lib`, `src/runtime`, `src/data`, its own files, and another world only through that world's `index.js` or `shared/` folder. Something two worlds need moves down to `src/lib` or `src/runtime`. A world that reaches into another world's props can't be split, lazy-loaded or deleted on its own.

## Size

A file stays under 800 lines; 1,500 is the ceiling the measure counts (`big-files`). A prop file over that splits by what it draws:

```
towns/moria/props.js            →  towns/moria/props/index.js   (re-exports, same names)
                                   towns/moria/props/halls.js
                                   towns/moria/props/bridge.js
                                   towns/moria/props/furniture.js
```

Each part exports builders with the signatures they had; the old path becomes a barrel, so no caller changes in the same pull request. Callers move to the parts in a later run, if ever.

## Logic apart from drawing

A game's rules live in a pure `rules.js` with tests; a scene file composes and draws. Anything that can be tested without a canvas is tested: `rules.js`, `kinds.js`, `budget.js`, anything under `src/lib` or `src/runtime` that imports neither `react` nor `three`.

## Tests go beside the file

`x.js` has `x.test.js`. A test runs under a second and touches no network. A fixture lives in a `fixtures/` folder beside the test.

## A repair changes no pixel

The steward's recipe for a split or a move: shoot the route before (`scripts/autopilot-check.mjs --before`), move the code, keep every export name, run the same route's check after, compare the two screenshots. A changed pixel means the repair is wrong, whatever the numbers say.

## The worlds' HUDs

A world's HUD is built from the kit in `src/runtime/hud/` (`index.js` lists the parts) and imports it from there only. The kit holds the rules (`hud.js`, tested), the frame (`Hud.jsx`), one part per idea (Menu, Prompt, Exit, Objective, Toast, Bubble, QuestList, PlayersChip, Stick, TouchButton, `fitCanvas`) and the tokens (`hud.css`). A world keeps its face: it skins the parts with its own classes, and the kit's rules weigh (0,0,1), so any world class wins.

- **Rows, not sums.** The top row, the foot and the thumbs are laid out by `layoutRows` and measured. A position is a kit token (`--hud-pad`, `--hud-pad-b`, `--hud-pad-l/-r`, `--guide-reserve`, `--guide-clear`, `--hud-under`, `--hud-foot`) or a measurement, never a hand sum of other things' sizes.
- **One of each.** One Menu (the world's settings, Things to do, Controls opening the site's guide, the players chip, the way out read from the view: "Universe map" or "Classic site"); one prompt, key first ("E Go in · Burger Mart"), the button itself on touch; one way out of an inner place (the world's verb, or "Leave", with Esc); one toast, top centre under the top row.
- **Plain values in.** Kit parts take resolved values (a count, a callback, `{ label, to }`); `src/runtime` imports nothing from `src/components`.
- **Readable.** Nothing a player reads while playing is under 0.7 rem. Text over the 3D sits on glass at alpha 0.78 or more, never blurred (a blur over a canvas redrawn every frame costs a frame).
- **Numbers through refs.** A frame loop writes the HUD's numbers into the elements it holds, not into React state.
- **The keys are written once**, in `src/components/guide/pages.js`; a world's Controls opens the guide.
- **Touch.** The kit's Stick (116/46, radial, a dead zone) and TouchButton (76 for one main action, 64, 52); the right column keeps the guide's corner.

`hud-kit` in the measure counts the worlds whose HUD imports nothing from the kit; it only goes down.

## Never

- Reformat lines you aren't moving.
- Rename for taste.
- Add a dependency to make a number move.
- Raise a budget without a sentence saying why in the commit.
- Skip, quieten or delete a test to get green.
