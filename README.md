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

Graphics: the site itself is SVG, CSS and 2D canvas, and its games and scenes are 3D first: they draw in WebGL (Three.js, loaded only when it's used) wherever the browser has it, a graphics chip or WebGL run in software, and lower their own resolution and effects when frames can't keep up (judged on real time, so a laptop's battery-saving 30 fps cap doesn't count). `src/lib/gpu.js` checks once. Only a browser with no WebGL at all, or a GPU context that's lost or fails, gets the 2D versions. Visitors can switch 3D off under the trench run. The 3D scenes use CC0 photo-scanned materials and HDRI lighting from Poly Haven and ambientCG, kept in `public/cc0` (see its README), with procedural textures as the fallback.

Tests: `npm test` runs the games' rules (Vitest); they run before every deploy.
