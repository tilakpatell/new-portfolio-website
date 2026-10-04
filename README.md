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
- `src/components/worlds/worlds.js` — the hidden worlds, one per fandom (Death Star, Middle-earth, Avengers HQ, Scranton, Cybertron, Albuquerque, Dimension C-137, the music room). Each is a page in `src/pages/` with its own folder under `src/components/`.
- `src/components/games/` — what the WebGL-only games share: `GpuGate.jsx` (the hardware acceleration check), gamepad input and synthesised sounds. Roll out (`cybertron/rollout/`) and Portal panic (`rickmorty/portal/`) keep their rules in a tested `rules.js`, apart from the drawing.

Graphics: the site and its games are 3D first: they draw in WebGL (Three.js, loaded only when it's used) wherever the browser has it, a graphics chip or WebGL run in software, and lower their own resolution and effects when frames can't keep up (judged on real time, so a laptop's battery-saving 30 fps cap doesn't count). On the core pages that's the Experience diagrams, the travel globe, the mist over the Travel photos, the lamplight on the Peace section, the Akshardham day, the jump to lightspeed and the GPU project's demo; `src/lib/three/` holds their shared renderer, the theme-colour reader and the `useScene` hook that loads a scene only near the viewport and draws only while it's on screen. `src/lib/gpu.js` checks once. Only a browser with no WebGL at all, or a GPU context that's lost or fails, gets the SVG and 2D versions. Visitors can switch 3D off under the trench run. The 3D scenes use CC0 photo-scanned materials and HDRI lighting from Poly Haven and ambientCG, kept in `public/cc0` (see its README), with procedural textures as the fallback.

Roll out and Portal panic are the exception: they need the graphics chip, so with hardware acceleration off they say so, with the steps for the visitor's browser, and offer to play anyway. Their assets are all CC0, in `public/games/` with each one credited in `public/games/credits.json`. Roll out is realistic (Poly Haven and ambientCG scans and skies, fetched by `npm run cc0`; behind a proxy, set `NODE_USE_ENV_PROXY=1`); Portal panic is stylised (Kenney's City Kit Suburban, Nature Kit and Space Kit, unzipped somewhere and converted with `KENNEY=/path/to/kits npm run kenney`). Both games' casts can also be modelled with Meshy (`scripts/meshy.mjs`, with `MESHY_API_KEY` in `.env.local`): Portal panic's is in `public/games/meshy/`; Roll out's goes to `public/games/meshy/rollout/` with `node --env-file=.env.local scripts/meshy.mjs <images|models|rig|anim|fetch> rollout`, and the game uses whatever its `index.json` lists, keeping its own shapes for the rest. The output is committed, so the site never calls these services at runtime.

Tests: `npm test` runs the games' rules (Vitest); they run before every deploy.

Agent skills for Claude Code live in `.claude/skills` (superpowers, the three.js reference and game pack, caveman), with their sources in `skills-lock.json`; lint and tests skip them.
