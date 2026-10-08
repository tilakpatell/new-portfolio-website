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

## UI

One house UI: the shell, the classic pages, the universe map and every world's HUD agree with one another. The spec is `docs/superpowers/specs/2026-10-07-audience-tours-and-ui-audit-design.md` (sections 5 and 8); the findings it rests on, checked against the code and a designer's eye, are in `docs/research/2026-10-07-tours-and-ui-audit/ui-shell-universe-verified.md`.

1. **Tokens are the only source of a number.** `src/index.css` holds depth (`--z-page` … `--z-top`), time (`--t-fast/base/slow`), type (`--fs-xs` … `--fs-display-1`), the floating shadows, the corner edges, `--page-top` and `--measure`. A page-level `z-index` names its depth (`src/styles/tokens.test.js` fails a bare one of 10 or more); any other hard-coded value carries a comment saying why.
2. **Spacing is the 4 px grid**: whole Tailwind steps; sections `py-14 md:py-20`; the last one `.section-last`; controls 44 px on a coarse pointer (a hit area may be wider than what is drawn), 36 px at least otherwise.
3. **One drawing per concept.** In the shell: `.btn`, `.chip` (and `button.chip`), `.switch` (a pill in a track), `.link` / `.link-quiet` / `.link-hover`, `.kbd`, `CloseButton`, `.notice`, `.dialog-title`, `CopyButton`, `Bullets`, and one icon per meaning from `src/components/icons.js`. On the map: `src/components/universe/hud.css`. In a world: `src/runtime/hud/`. A new surface reaches for these before it draws its own; `kbd-styles` (below) counts the key caps drawn anywhere else.
4. **One word per thing.** The glossary is `src/lib/words.js` (the site) and `src/components/universe/words.js` (the map). `src/lib/words.test.js` reads the shell's and the map's files as the browser would and fails on a retired word; crew lines, in-world signs and the fiction keep their own words.
5. **Text over 3D sits on glass**, never bare (a scrim, or the shadow the nav map gives its names).
6. **Dim by colour, never by fading text below 0.55**: a dimmed item's words read at `--muted` (4.5:1 on every theme); its pictures may go grey.
7. **Copy**: British spelling, curly quotes, sentence case, one sentence to a toast, the key first in a prompt (“G Go in · Burger Mart”), no Oxford comma.
8. **Themes and dark mode**: a shared surface reads the theme's tokens (radius, border, ink), so a square theme squares it and dark mode darkens its shadow; type on a photograph (`.on-photo`) is white in every theme.

The measure's `kbd-styles` counts the CSS rules that draw a key cap outside the house `.kbd` (`src/index.css`); lower is better. It walks `src/**/*.css` itself, leaves out `src/runtime/hud/hud.css` until the world kit's own cap is folded into the house one, and has no budget until both have landed (spec section 8, C1).

## Never

- Reformat lines you aren't moving.
- Rename for taste.
- Add a dependency to make a number move.
- Raise a budget without a sentence saying why in the commit.
- Skip, quieten or delete a test to get green.
