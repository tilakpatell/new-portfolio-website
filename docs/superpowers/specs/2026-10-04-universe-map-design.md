# The universe map

Date: 2026-10-04. Branch: `claude/universe` (from `claude/threejs-core`, with the Albuquerque dispose fix cherry-picked).

## Intent

The fandom worlds are reached today through a row of chips on each world page and a scrolling row of nine cards on Home. Replace both with one place: a `/universe` page where each fandom is a planet in a small 3D universe, and you travel between them. Home links to it. The cards' toys are kept, shown beside the map for whichever universe is selected.

Reference: arstraumur.music, where one persistent 3D scene is the site's map and the text stays in the DOM.

## What gets built

1. **`/universe/:id?`**, a full-height dark page. A 3D map fills it; a side panel (a bottom sheet on phones) shows the selected universe's card. `:id` opens the map already flown to that universe.
2. **Nine universes**, each a procedural planet in its own palette plus one signature object:

   | id | Universe | Planet and signature | Enters |
   |---|---|---|---|
   | `starwars` | Star Wars | the Death Star, Alderaan as its moon | `/deathstar` |
   | `middleearth` | The Lord of the Rings | green-gold world, the One Ring orbiting, inscription lit | `/middle-earth` |
   | `marvel` | Marvel | Earth-616, six Infinity Stone moons | `/avengers` |
   | `office` | The Office | paper-white planet with ruled lines, a "World's Best Boss" mug moon | `/scranton` |
   | `transformers` | Transformers | metal-panel planet, seams lit | `/cybertron` |
   | `breakingbad` | Breaking Bad | desert planet, blue crystal moons, element tiles in orbit | `/albuquerque` |
   | `music` | Indian classical music | saffron planet whose rings are sitar strings | `/music` |
   | `gaming` | Gaming | voxel planet in Game Boy greens | `/projects/gameboy-emulator` |
   | `travel` | Travel | Earth with the travel arcs | `/travel` |

3. **Moving around.** Hover a planet: its label brightens. Click it, tap it, or use the arrow keys: the camera flies there (exponential ease-out, no spring) and the panel shows its card. **Enter** (the button, or the Enter key) dispatches `tp:hyperspace` and navigates at the flash (1250 ms), as the dock's saber does today. Escape flies back out to the whole map. Dragging turns the map about its axis (yaw only, pitch clamped). No wheel zoom, so the page never fights the scroll.
4. **Home.** "Off the clock" keeps its title, lead and icon dock. The card row is replaced by the SVG mini-map (below) and an **Open the universe** button.
5. **World pages.** `WorldSwitcher` becomes two links: **Universe map** (to `/universe/<this world>`) and **Next universe** (the next world page in map order).
6. **The SVG mini-map**: the same layout drawn flat (orbit ellipses, a dot per universe in its colour, mono labels). It is Home's teaser and the universe page's fallback when 3D is off, failed or lost. On the universe page its dots are buttons that select.
7. **Way in from elsewhere**: a ⌘K entry ("The universe map") and a guide entry for `/universe`.

Not built: Meshy or other imported models (a later swap for two or three signature objects, once the procedural set is reviewed), new sounds beyond the music engine's existing pluck, physics, multiplayer, achievements.

## Files

New, in `src/components/universe/`:

- `universes.js`: the nine entries above (`id, label, from, to, swatch, palette`). Pure data. `worlds.js` derives `WORLDS` (the seven world pages, for the guide) from it, so the list lives in one place.
- `layout.js`: pure. Positions on a tilted disc (golden-angle spiral, radius by order), `next(id)` / `prev(id)` in map order, `parseId(param)` (unknown ids fall back to none selected), `nextWorld(id)` for the world pages.
- `flight.js`: pure. Camera pose for the overview and for each universe, and the eased interpolation between two poses over time.
- `planets.js`: one builder per universe returning `{ group, pick, update(ms) }`. `pick` is an invisible sphere for raycasting. Textures are painted on canvases (512 px or less) in the universe's palette.
- `scene.js`: the scene module for `useScene` (`create(canvas, ctx)` contract): starfield (one Points), the nine planets, raycast picking, drag-to-turn, the flight, and screen positions of each planet reported to React each frame it draws, for the DOM labels.
- `UniverseMap.jsx`: the `useScene` box, DOM labels positioned from the scene's report, keyboard handling, the fallback switch.
- `MiniMap.jsx`: the SVG map (props: `selected`, `onSelect` or links).
- `UniversePanel.jsx`: the selected card, Enter, previous / next.
- `universe.css`.

Moved: the eight cards in `Interests.jsx` (plus `MusicCard`, which stays in its own file) into `src/components/interests/cards.jsx`, exported as `CARDS[id]`, unchanged inside. `Interests.jsx` keeps the section shell.

New page: `src/pages/Universe.jsx`, lazy-loaded like the other world pages. Edited: `App.jsx` (route), `WorldSwitcher.jsx`, `Interests.jsx`, `worlds.js`, `CommandPalette.jsx`, `Guide.jsx`.

## Look

- Deep-space page (`dark-scope`, the Death Star page's `#03040a`). The page accent follows the selected universe's swatch, so the panel's buttons recolour as you travel; with none selected it is the site's own accent.
- Matte planets with a key light from the upper left and a soft rim. Glow only where it belongs to the thing: the Ring's inscription, Cybertron's seams, the Infinity Stones, the crystal moons. No bloom pass, no purple nebula gradients.
- Labels are DOM text in JetBrains Mono, under each planet.

## Behaviour and edge cases

- One renderer (`createRenderer` through `useScene`): DPR cap, slow-frame watchdog, `lowerQuality()` drops the starfield count and stops the decorative orbits.
- Draws while on screen and the tab is visible. Reduced motion: no flight (cut to the pose), no orbits, still frame.
- Context loss or failure: `useScene` reports it and the SVG mini-map takes the box, still fully usable.
- Enter with reduced motion or with 3D off: navigate straight away, no jump.
- An unknown `:id`: the overview, nothing selected.
- Leaving the page mid-flight or mid-jump: `dispose` frees everything (the Albuquerque lesson); the jump is App-level and already survives navigation.
- Budget at desktop: one WebGL context, under 120 draw calls, under 300k triangles, under 24 MB of textures. Reported from `renderer.info` after the build.

## Testing

- Vitest for `layout.js` (positions stay on the disc and don't overlap, `next`/`prev` wrap, `parseId`, `nextWorld`) and `flight.js` (pose at t=0 and t=end, monotonic approach) and `universes.js` (every `to` is a real route).
- `npm run lint`, `npm test`, `npx vite build`.
- In the browser: desktop and phone widths, 3D on and off, every universe selected and entered, back to the map from every world page through **Universe map** (console clean on each hop), Home's teaser link, ⌘K entry, keyboard-only use. Renderer counts and screenshots in the report.
