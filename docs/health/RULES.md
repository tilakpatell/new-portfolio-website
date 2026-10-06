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

## Never

- Reformat lines you aren't moving.
- Rename for taste.
- Add a dependency to make a number move.
- Raise a budget without a sentence saying why in the commit.
- Skip, quieten or delete a test to get green.
