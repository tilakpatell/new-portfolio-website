# Theme ambience: a live background for each theme

## Why

The fan themes (unlocked by easter eggs) change colours, type and the scroll
bar, and play a short scene when picked, but once picked the page itself
looks like the company themes with different colours. The visitor who typed
`rollout` or `mellon` gets very little back for it. The company themes are
the site's professional face and should stay calm, but they can carry a
little of each company too.

## What

A layer behind the portfolio pages (`/home`, `/experience`, `/projects`,
`/resume`, `/contact`, `/travel` and the not-found page) that draws a live
background for the theme that's on. It never sits over the content and never
takes a click from it.

- **Fan themes are fun.** Each family has its own scene: a field of things
  drifting through it, something big and recognisable that comes and goes,
  something that follows the pointer, and a burst where you click on empty
  page.
- **Company themes are quiet** (a follow-up): slow, faint, at the edges.
- **World pages, the universe map and the galaxy have their own 3D** and get
  nothing.

| Family | Themes | Field | The big thing | Pointer | Click |
| --- | --- | --- | --- | --- | --- |
| Star Wars | jedi, sith | stars at three depths | an X-wing (Jedi) or a TIE (Sith) crossing | the stars part round it | saber sparks |
| Heisenberg | heisenberg | blue crystals tumbling | a periodic-table tile drifting | crystals push away | a crystal burst |
| Stark | stark | HUD grid, data ticks | arc-reactor rings turning | a targeting reticle locks on | repulsor ring |
| Dunder Mifflin | dunder | sheets of paper falling | a paper airplane gliding across | paper drifts away | a burst of confetti paper |
| Arcade | arcade | a synthwave grid and sun | pixel invaders marching | pixels scatter | +100 pixel burst |
| Raga | raga | marigold petals | diyas floating up | ripples | a ring of sound |
| Pirates | tortuga, pearl, dutchman | sea, fog, gulls or embers | a ship on the horizon | the waves part | spray |
| Transformers | optimus, megatron, bumblebee, shockwave, soundwave | a hex grid with energon running in it | the faction mark | energon runs to the pointer | sparks |
| Middle-earth | shire, mordor | fireflies and leaves, or embers and ash | the hills (Shire) or the Eye (Mordor) | the Eye follows it | sparks |
| Rick and Morty | portal, morty, summer, beth | stars and floating debris | a portal opening | the portal pulls things in | a little portal |

## How

- `components/ambience/Ambience.jsx` is in the app's shell, in the empty
  `.backdrop` slot under `<main>`. It reads the active theme and the path,
  picks a family (`kinds.js`, plain and tested), and mounts a fixed,
  full-viewport box with `lib/three/useScene` loading that family's scene.
  A new family remounts the box; a new theme in the same family recolours.
- `components/ambience/kit.js` is what every scene shares: the renderer at
  a low pixel ratio, an orthographic camera in CSS pixels (origin at the
  centre, y up), 30 frames a second, the pointer and scroll position eased,
  a click on empty page as a burst, a GPU particle field (motion and shape
  chosen per family), and the useScene contract (`ready`, `resize`,
  `render`, `setColors`, `update`, `dispose`).
- `components/ambience/scenes/<family>.js`, one per family.

## Budget

- Three.js and the scene load only when a themed family is on a portfolio
  page; the company themes load nothing in this change.
- Pixel ratio 1 on a high tier, 0.75 on mid; `low` tier, Data Saver, 3D
  switched off or no WebGL get nothing.
- 30 frames a second, nothing drawn while the tab is hidden or the intro
  covers the page. Reduced motion draws one still frame.
- Particle motion runs in the vertex shader; JavaScript moves a handful of
  big things.
- Readability: the canvas is faded toward the middle of the screen (where
  the text column is) by a CSS mask, and each family sets its own opacity
  for light and dark mode.

## Testing

- `kinds.test.js`: the family for every theme, the routes it shows on.
- Each scene is checked in a headless browser on `/home` in light and dark
  mode: it draws, and the page's text contrast is unchanged in the middle.
