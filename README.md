# tilakpatell.com

Personal site of Tilak Patel — React 18, Vite 5 and Tailwind 3, deployed to GitHub Pages from `main` by `.github/workflows/deploy.yml`.

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

No WebGL anywhere: everything is SVG, CSS and 2D canvas, so the site works with hardware acceleration off.
