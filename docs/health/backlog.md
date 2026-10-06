# Health backlog

What the steward repairs next when nothing is over budget: the first unchecked item. A run ticks its item with the ship's-log entry number, or writes what's left under it. The order is the metrics' order of worth (`boundary-breaks`, `cycles`, `untested-logic`, `big-files`, `lint-disables`, `biggest-chunk-kb`, `world-mb-drift`, `lint-warnings`, `todo-notes`), worst row first.

## Boundaries

- [ ] **`src/lib/view.js` imports from `src/components`.** Move what it needs down or invert the dependency. Done: `boundary-breaks` counts one fewer; `/`, `/home` and `/universe` unchanged in the browser.
- [ ] **`src/lib/seeded.test.js` imports from `src/components`.** A test under `lib` that needs a component's data belongs beside that component, or the data belongs in `src/data`.

## Big files (one a run, biggest first; the recipe is in `RULES.md`)

- [ ] `src/components/middleearth/towns/moria/props.js` (4,505 lines) into `props/` by what it draws.
- [ ] `src/components/universe/scene.js` (4,263 lines): the composer stays; the builders it carries move beside the things they build.
- [ ] `src/components/middleearth/towns/rivendell/props.js` (3,861 lines).
- [ ] `src/components/middleearth/towns/doom/props.js` (3,775 lines).
- [ ] the rest of `big-files`'s detail, in order.

## Lint disables (`src/components/earth/EarthWorld.jsx` has 8)

- [ ] Each `eslint-disable` in `EarthWorld.jsx`: fix the cause (an effect's missing dependency, a stable ref) or, where the rule is wrong for the line, say why in the comment and leave it. Done: the count falls, the globe still spins.
