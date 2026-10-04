# tilakpatell.com

Personal site of Tilak Patel — React 18, Vite 5 and Tailwind 3. Every push to `main` is linted, built and deployed to GitHub Pages at https://tilakpatell.com by `.github/workflows/deploy.yml`.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
npm run lint
```

## Where things live

- `src/data/` — the single source of truth for roles, projects, skills and education. Every page and the terminal read from here.
- `src/theme/` and `src/index.css` — the company themes (AWS, RTX, Bose, Pendar, Empowerreg, SRC). AWS is the default; the Experience page switches theme as each role scrolls past, and the switcher in the nav pins one for the session.
- `src/components/RouteLine.jsx` — the line that draws itself down each page as you scroll. Any `[data-waypoint]` element is a stop.
- `src/stages/` — the live demo on each project page (the Game Boy one is playable).
- `src/pages/Terminal.jsx`, `src/pages/DeathStar.jsx` — the easter eggs. Try ↑ ↑ ↓ ↓ ← → ← → B A.

Graphics: the core pages draw their showpieces in WebGL where 3D is on, over SVG and 2D canvas versions that stay as the fallback: the Experience diagrams, the travel globe, the mist over the Travel photos, the jump to lightspeed and the GPU project's demo (`src/lib/three/` holds the shared renderer, the theme-colour reader and the `useScene` hook that loads a scene only near the viewport and draws only while it's on screen). The games draw in WebGL (Three.js, loaded only when it's used) where the device has a graphics chip: `src/lib/gpu.js` checks once, counts software WebGL (SwiftShader, llvmpipe and the like) as none, and falls back to the 2D version where there is one, or says so where there isn't. A lost GPU context, a render error or frames that can't keep up also drop a game back to 2D. Visitors can switch 3D on or off under each game. The 3D scenes use CC0 photo-scanned materials and HDRI lighting from Poly Haven and ambientCG, kept in `public/cc0` (see its README), with procedural textures as the fallback.

Tests: `npm test` runs the games' rules (Vitest); they run before every deploy.
