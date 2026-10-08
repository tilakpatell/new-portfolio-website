# React

**Version** `react@^19.3.0`, `react-dom@^19.3.0`, `react-router-dom@^7.18.4`, `react-icons@^5.7.0`, `@types/react@^19.3.0`, `@types/react-dom@^19.3.0` · **Page owner** `src/pages/` and `src/components/` · **Decision** none recorded

## What it is, and why it is here

React draws every page, the shell and every HUD over the 3D; React Router maps the address to a page; `react-icons` supplies the icons. `@types/react` and `@types/react-dom` are type declarations only: the site is JavaScript with no TypeScript config, so they serve an editor’s hints and nothing in the build reads them. The 3D itself is not React: a scene is a plain module that `useScene` or the world runtime mounts on a canvas.

## Where it is used

The census rows are in [README.md](README.md): `react` is the second most imported package after `three`, and `react-router-dom` and `react-icons` follow it. The entry points:

- `src/main.jsx`: `createRoot`, the two fonts the shell always needs, the stylesheets and the service worker.
- `src/App.jsx`: the providers (theme, achievements, online, economy), the `HashRouter`, and every page as a `lazy` import.
- `src/pages/`: one file per route.
- `src/components/icons.js`: the shell’s icons, one per meaning.

## How the site uses it

- **Hash routes.** `src/App.jsx` uses `HashRouter`, so every route works on static hosting with no server rewrite (`README.md`, “Tech stack”).
- **Pages load lazily.** Every page in `src/App.jsx` is `lazy(() => import(…))`, so a visitor downloads only the page they open; only `App.jsx` mounts a page (`docs/health/RULES.md`; the measure’s `boundary-breaks` counts the imports that break it).
- **3D stays out of React’s render.** A page’s scene is made by `src/lib/three/useScene.js`, a world by the runtime (`src/runtime/useWorld.js`); a frame loop writes a HUD’s numbers into the elements it holds, not into React state (`docs/health/RULES.md`, “The worlds’ HUDs”).
- **`react-dom`** is used for `createPortal` (overlays above the page) and `react-dom/server`’s `renderToStaticMarkup` in tests, and in one scene that draws markup to a string (`src/components/albuquerque/metherria/scene.js`).
- **Icons** come from `react-icons`’ Remix line set (`react-icons/ri`) and nothing else; the shell’s come through `src/components/icons.js`. At build time `scripts/icons-apart.mjs` (a Vite plugin) gives each icon a module of its own, so an icon goes only into the chunk that draws it rather than the whole set into the entry chunk.

## What the site does not use, and why

- **`BrowserRouter`**: a static host has no rewrite to send `/projects` to `index.html`; the hash keeps every route on one file.
- **React Router’s data APIs** (loaders, actions): the site has no server to load from, so a page reads its data from `src/data/` or fetches it itself.
- **Other `react-icons` sets**: one set keeps the strokes alike; every import is from `react-icons/ri`.

## Rules

- Only `src/App.jsx` mounts a page (`docs/health/RULES.md`; `boundary-breaks` in the measure).
- `src/lib` knows no React (`docs/health/RULES.md`, Layers; `boundary-breaks` counts imports of a component or page from `src/lib`).
- One icon per meaning in the shell, from `src/components/icons.js` (`docs/health/RULES.md`, UI rule 3; nothing measures it).
- The hooks rules are linted (`eslint-plugin-react-hooks` in `eslint.config.js`).

## Upgrading

```
npm install react@<v> react-dom@<v>
npm install react-router-dom@<v>
npm run lint
npm test
npm run build
node scripts/autopilot-check.mjs --only smoke
```

Keep `react` and `react-dom` on the same version, with `@types/react` and `@types/react-dom` beside them. `vite.config.js` names React’s packages for the `vendor` chunk; a new package React depends on goes into that list. Last upgrade: not recorded; record the next one here, with what it broke.

## Gotchas

- **Strict mode mounts twice in development.** `src/main.jsx` renders under `StrictMode`, so an effect that makes a scene or opens a socket must undo itself in its cleanup.
- **A route’s query sits in the hash.** With hash routes, `?gpu=webgpu` comes after the `#`, so code that reads the address reads both the search and the hash (`src/runtime/backend.js`’s `readOverride` does).
