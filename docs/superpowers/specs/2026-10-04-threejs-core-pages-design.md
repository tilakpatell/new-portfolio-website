# Three.js on the core pages

Date: 2026-10-04. Branch: `claude/threejs-core`.

## Intent

Make tilakpatell.com look and feel more modern by adding 3D only where it is clearly better than what is there, keeping the site's design language. Quality over 3D. The old rule that every core page must work with no GPU is dropped: 3D can be the main renderer, but the existing SVG / 2D canvas stays underneath as the fallback (it already exists, so it costs nothing to keep) for WebGL failure, context loss, slow devices and the visitor's "3D off" choice.

Reading it as: a developer and program-manager portfolio for recruiters, in a dark technical-drawing language (wide Archivo display type, JetBrains Mono labels, corner brackets, one accent colour per company theme), leaning toward restrained, matte, isometric or long-lens 3D in the theme's own colours. Dials: variance 6, motion 6, density 4.

## What gets built

1. **Experience diagrams in 3D.** Each role's diagram (`Motifs.jsx`) gets a small isometric model laid over its SVG: AWS racks rising row by row with GPU racks lit in the accent; RTX workloads lifting from an on-prem plate to the Xeta Cloud plate under the roadmap rail; Bose log bars feeding the three-phase pipeline; Pendar a spectrum waterfall; Empowerreg a severity heatmap as bars; SRC a knowledge graph over radar rings. Each builds once when it first comes into view and holds still; the pointer tilts it a few degrees. Labels are DOM text in the mono face.
2. **The globe in WebGL** (Home and Travel, through `PlacesExplorer`): the same dotted look with real depth, a rim atmosphere, arcs that tuck behind the sphere, pinch and wheel zoom, and the same API (select, zoom, reset, keyboard, deep links). `Globe.jsx` (2D) stays as the fallback and is not edited (the `redesign-taste` work is changing it).
3. **Travel hero mist**: a drifting noise-fog shader over the hero photo (and the PhotoBand), replacing the two CSS gradient layers when 3D is on.
4. **The lightspeed jump** (`Hyperspace.jsx`): streaks with real depth on the same timeline and `onPeak` contract, preloaded during the opening crawl, 2D canvas as the fallback.
5. **GPU checkpoint stage**: the four-GPU ring, packets, checkpoint store and fault state as an orthographic 3D scene driven by the same `PHASES`.
6. **Game Boy, more physical**: only if it clearly looks better; the emulator and screen stay as they are.

Not built: a 3D Home hero (the name and portrait are the strongest part of the site), a 3D Game Boy model, 3D on Résumé, Contact, 404, nav or the route-line marker.

## Shared code (`src/lib/three/`)

- `theme.js`: `readTheme()` resolves the page's CSS colour tokens (through a probe element, so `var()`, `color-mix()` and the dark-mode saber swap resolve) to `[r, g, b]`; `watchTheme(cb)` calls back on theme, mode or custom-colour changes, at most once a frame. No React, so a theme switch is a re-colour and a redraw, never a re-render. No three.js import.
- `renderer.js`: `createRenderer()` (sRGB, alpha, pixel-ratio cap by device, context loss reported, a slow-frame watchdog that drops to 1x pixels then calls `onSlow`), `disposeTree()`, `color()`, easings.
- `useScene.js`: the React side. Loads the scene module near the viewport, draws only while on screen and only while the scene asks for frames (idle scenes cost nothing), passes theme changes and resizes through, drops GPU memory after 10 s far away, creates a fresh canvas per scene, reports `idle | loading | ready | on | failed | slow | lost`. Gated by `use3D()` (the visitor's 3D choice).

Scene module contract: `create(canvas, ctx)` returning `{ resize, render(ms, now) -> bool, setColors?, setVisible?, update?, dispose }`, with `ctx = { el, colors, reduced, invalidate, onLost, onSlow, ...props }`.

Later (after the Avengers HQ branch lands): merge its `engine.js` / `useStage.js` and the Death Star, Trench and Metherria renderer code onto `lib/three`, so every scene shares one renderer setup, watchdog and lifecycle.

## Design rules for every scene

- Colours come from the theme (accent, text, surfaces, border); nothing hard-coded except neutrals derived from those.
- Matte materials, a key light from the upper left, soft contact shadows. No bloom-for-show, neon glows, chrome, purple gradients or particle confetti.
- Motion is motivated (storytelling, feedback, state change). Exponential ease-out on arrivals; no spring on cameras.
- Reduced motion: the final frame, still.
- Nothing draws off screen; idle scenes return `false` from `render`.
- Component-local CSS files; no new dependencies (three addons are fine); no GSAP.
- Zero em-dashes in user-visible text.

## Testing

`npm run lint`, `npx vite build`, `npm test` for pure logic (theme parsing), and a visual check of every scene in the browser in light and dark mode, with the console clean.
