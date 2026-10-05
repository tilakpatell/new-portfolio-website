<div align="center">

# tilakverse

**The code behind [tilakpatell.com](https://tilakpatell.com), Tilak Patel's personal site: a portfolio you can fly through.**

A résumé on the surface. Underneath it, a 3D universe with a starfighter, twelve hidden fan-made worlds, playable games and online multiplayer, all running on a static site.

[**Visit tilakpatell.com →**](https://tilakpatell.com)

[![Deploy](https://github.com/tilakpatell/tilakverse/actions/workflows/deploy.yml/badge.svg)](https://github.com/tilakpatell/tilakverse/actions/workflows/deploy.yml)
![React 18](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Vite 5](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-r180-000000?logo=threedotjs&logoColor=white)
![Tailwind CSS 3](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)

</div>

---

## Contents

- [What's inside](#whats-inside)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [How it works](#how-it-works)
- [Assets and credits](#assets-and-credits)
- [Deployment](#deployment)
- [Disclaimer](#disclaimer)

## What's inside

### The portfolio

| Page | Route | What it shows |
| --- | --- | --- |
| Home | `/home` | Intro, focus areas and a live GitHub activity snapshot |
| Experience | `/experience` | Every role, from AWS to SRC. The site's theme changes to each company's colours as its role scrolls past |
| Projects | `/projects` | Case studies, each with a live demo. The Game Boy emulator one is playable |
| Résumé | `/resume` | The résumé on the page, plus a PDF download |
| Travel | `/travel` | A 3D globe of places visited, with photos |
| Contact | `/contact` | How to reach me |
| Terminal | `/terminal` | An Imperial terminal that takes commands (try `help`) |

All of the content (roles, projects, skills, education) lives in [`src/data/`](src/data). Every page and the terminal read from there.

### The universe

The front door (`/`) is a map of the whole site as places in space. A first visit opens with a crawl, then puts you in a cockpit (the Millennium Falcon, an X-wing, Rick's space cruiser or Walt and Jesse's RV) and launches you into the map. Fly to a planet to open its page.

| Key | Action |
| --- | --- |
| `W` / `S` | Throttle |
| `A` / `D` | Roll |
| `←` `→` `↑` `↓` | Turn and pitch the nose |
| `F` (hold) | Fire |
| `T` / `Q` | Next / previous target |
| `V` | Switch between the chase camera and the cockpit view |
| `O` | Flight settings (steering, aim assist, inverted pitch and more) |
| `H` | The hangar: paint and parts for the ship you're flying |
| `G` | Land on the planet you're at and step out (and, on foot, get back in) |

On foot, `W` `A` `S` `D` walk, `Shift` runs, `Space` jumps, `F` or a click fires, `X` switches to the other one of your crew and `V` looks out of their eyes. The Galactic Federation's squads come over the horizon now and then. On the Death Star you come down beside its trench, on hull plating with blocks and towers standing on it, and can walk up to the rim and look down into the trench run.

The hangar fits each ship out its own way, like a space sim's outfitting screen, and remembers it. Paint jobs are the site's own colour schemes: the six companies' come with the Cartographer achievement, and each fan scheme's with the easter egg that unlocks it. Parts bolt on and change how it flies and fights: strap-on boosters (solid rockets, an afterburner, repulsor pods, portal-fluid tanks), thrusters, twin or fusion guns, plating or fast-charge shields, and fins. Each draws power from the ship's plant and adds mass, so you can't fit the best of everything; the best parts are earned with achievements in the worlds. Other pilots see your paint and parts. The X-wing and the Falcon you fly are other people's models from Sketchfab (CC BY, credited on the map), brought to web size by `scripts/sketchfab-batch.mjs`; while they load, versions modelled in code (`universe/hulls.js`) stand in.

Other pilots on the site at the same time show up in your sky. You can fly with them, fight hunters together, or shoot each other down. Land on a planet where someone's already down and you come down beside them, and your crews walk about together. Two of the same person (two Ricks, two Walts) meet as that person from another dimension. Off the map, in Middle-earth's towns and on its map, and in Albuquerque, everyone else online shows up as a pale ghost from another world (a Frodo, or a Walt's Aztek) with their name over them; nothing passes between you but where each of you is.

The map is big: the planets are a hundred and more ship-lengths across, the fandoms far out in deep space, and the Death Star's trench run goes all the way round it.

### The hidden worlds

Each planet on the map that has a world gets a page of its own, with its own art direction, soundboard and usually a game.

| World | Route | Fandom | Highlights |
| --- | --- | --- | --- |
| Death Star | `/deathstar` | Star Wars | Fly the trench run before Yavin 4 comes into range |
| Music room | `/music` | Indian classical music | Land on the music planet and walk a dusk courtyard in 3D to its instruments; a sitar with fret settings and an auto chikari, a real harmonium, the tabla and the tanpura; forty ragas, or your own |
| Middle-earth | `/middle-earth` | The Lord of the Rings | A map of chapters: walk Hobbiton in 3D as Frodo, run the Prancing Pony's kitchen in co-op, open the Doors of Durin, cross Gorgoroth |
| Cybertron | `/cybertron` | Transformers | Pick a side, write in Cybertronian, play *Roll out* |
| Avengers HQ | `/avengers` | Marvel | Walk the compound in 3D as Cap. Each building opens its game (Spider-Man's *Thwip!* at the front gate), and each game wins an Infinity Stone back for Thanos's gauntlet |
| Albuquerque | `/albuquerque` | Breaking Bad | Drive around town. Places open up as Walt's career grows, each with its own game. Other drivers online show up as ghost Azteks |
| Scranton | `/scranton` | The Office | The office from above, Dwight's fact check, and the Dundies |
| Dimension C-137 | `/c-137` | Rick and Morty | The portal gun, *Portal panic*, the Meeseeks box and interdimensional cable |
| Earth | `/earth` | Travel | Down from orbit onto the globe as it is right now (NASA's Blue Marble and Black Marble, the real sun), then fly a little plane to every place I've been: a passport stamp and a postcard at each |
| Dot Matrix | `/dot-matrix` | Gaming | A Game Boy island in its four greens (a Bayer-dithered last pass, outlines from the depth buffer): jump about, find the eight cartridges (each one a project) and play the giant Game Boy in the square |
| The Caribbean | `/caribbean` | Pirates of the Caribbean | Sail *Dead Man's Tide* at the Black Pearl's helm |
| Invincible | `/invincible` | Invincible | Fly *Think, Mark!* over the city as Invincible: rings with your father, the Flaxans, Omni-Man and Thragg, with HD figures |

### Easter eggs

- **↑ ↑ ↓ ↓ ← → ← → B A** jumps to lightspeed.
- **⌘K / Ctrl+K** opens a command palette that can go anywhere on the site and run its tricks.
- There are dozens of achievements to unlock. Scranton's Dundies hand them out as awards.

## Tech stack

- **[React 18](https://react.dev/)** with [React Router 7](https://reactrouter.com/) (hash routing, so it works on static hosting)
- **[Vite 5](https://vitejs.dev/)** for the dev server and build
- **[Tailwind CSS 3](https://tailwindcss.com/)** plus per-company and per-world themes
- **[Three.js](https://threejs.org/)** for every 3D scene and game, loaded only when needed
- **[Nostr](https://nostr.com/)** public relays for multiplayer, with events signed using [`@noble/secp256k1`](https://github.com/paulmillr/noble-secp256k1). There's no backend.
- **[Vitest](https://vitest.dev/)** for tests and **ESLint** for linting
- **GitHub Actions** and **GitHub Pages** for deploys

## Getting started

You need **Node.js 22** (the version CI uses) and npm.

```bash
git clone https://github.com/tilakpatell/tilakverse.git
cd tilakverse
npm install
npm run dev
```

The site is then running at http://localhost:5173.

To try a lower graphics tier on a desktop, add `?quality=low` (or `mid` or `high`) to the address.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build into `dist/`. Takes a fresh GitHub snapshot first (`prebuild`) |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest suite (game rules, flight model, multiplayer protocol and more) |

The asset pipeline scripts regenerate committed files. You don't need them to run the site.

| Command | What it does |
| --- | --- |
| `npm run cc0` | Fetch the games' CC0 scans and skies from Poly Haven and ambientCG into `public/games/` (behind a proxy, set `NODE_USE_ENV_PROXY=1`) |
| `npm run hq-assets` | Fetch and shrink the Avengers HQ games' CC0 assets into `public/hq/` |
| `npm run kenney` | Convert Kenney's kits for *Portal panic* (`KENNEY=/path/to/kits npm run kenney`) |
| `npm run photos` | Turn the Travel photos into small WebP files and record their sizes, alt text and credits |
| `npm run globe` | Rebuild the dotted globe on the Travel page |
| `python3 scripts/build-harmonium.py` | Rebuild the music room's harmonium from its CC0 recording (downloads it the first time) |

The scripts that call Meshy (`scripts/meshy*.mjs`) read `MESHY_API_KEY` from `.env.local`. Sketchfab downloads are brought down to web size by `scripts/sketchfab-import.mjs` and `scripts/sketchfab-batch.mjs`.

## Project structure

```
├── .github/workflows/deploy.yml   # lint, test, build and deploy on every push to main
├── docs/                          # architecture notes, research and design plans
├── public/                        # static files: models, textures, audio, photos, résumé PDF
│   ├── cc0/                       # CC0 materials and HDRIs (credited in its README)
│   ├── games/                     # game assets, credited in credits.json
│   └── models/                    # glTF models (Meshy-generated and Sketchfab)
├── scripts/                       # asset pipelines and the GitHub snapshot
└── src/
    ├── data/                      # the content: roles, projects, skills, education, places
    ├── pages/                     # one file per route
    ├── components/
    │   ├── universe/              # the universe map: flight, targeting, HUD
    │   │   └── online/            # multiplayer over Nostr
    │   ├── cockpit/               # the welcome, the crawl and the launch
    │   ├── worlds/                # world registry and the download gate for phones
    │   ├── games/                 # shared game code: GPU check, gamepad, sounds
    │   └── <world>/               # one folder per hidden world
    ├── stages/                    # the live demos on project pages
    ├── lib/                       # device tiers, GPU detection, audio, textures
    │   └── three/                 # shared renderer, adaptive pacing, useScene hook
    └── theme/                     # company themes and the theme provider
```

## How it works

A few of the design decisions behind the site:

- **Content is data.** Pages render from `src/data/`, so updating a role or project is a one-file change.
- **3D first, with fallbacks.** Scenes render in WebGL wherever it's available, lower their own resolution and effects when frames run late, and fall back to SVG or 2D only when WebGL isn't there at all. Shaders compile in the background before the first frame, so a scene scrolling into view doesn't stall the page.
- **Every device gets a budget.** `src/lib/device.js` sorts each device into a `high`, `mid` or `low` tier once, and every renderer starts from that tier's pixel ratio, antialiasing, shadows and bloom. On phones, heavy worlds ask before downloading anything.
- **Game logic is plain, tested code.** The games keep their rules in a `rules.js` that's separate from the rendering and covered by Vitest. The same goes for the starfighter's flight model and targeting.
- **Multiplayer without a server.** Pilots meet in a room on public Nostr relays over ordinary WebSockets. Every event is signed with a per-visit key and checked on arrival, and signing happens in a Web Worker so it stays off the render loop. Pilots never see each other's IP addresses.
- **No runtime calls to asset services.** Every model and texture is generated or downloaded ahead of time and committed, so the deployed site only ever loads its own files.

For the details of each subsystem, see [`docs/architecture.md`](docs/architecture.md).

## Assets and credits

- **CC0 materials and HDRIs** come from [Poly Haven](https://polyhaven.com/) and [ambientCG](https://ambientcg.com/). They live in [`public/cc0/`](public/cc0), which also lists what was made for this site and what's under other licences.
- **Game assets** are CC0 and credited one by one in [`public/games/credits.json`](public/games/credits.json). *Portal panic* uses [Kenney](https://kenney.nl/)'s kits.
- **Sketchfab models** are used under Creative Commons Attribution licences. Each one's author, licence and source are in [`src/data/modelCredits.json`](src/data/modelCredits.json), and they're credited on the pages that use them.
- **Characters and buildings** in the worlds were generated for this site with [Meshy](https://www.meshy.ai/).
- **Earth's globe** is NASA Earth Observatory's Blue Marble Next Generation (July, with topography and bathymetry), Black Marble 2016, cloud and GEBCO images, all public domain, brought to 8K and phone sizes by `scripts/build-earth.mjs`. Its plane is a 737 from Sketchfab (CC BY 4.0), repainted without its airline's livery by `scripts/earth-plane-livery.mjs`.
- **Rigged characters from Sketchfab** (Invincible's Omni-Man and Thragg, Avengers HQ's Spider-Man) are brought to web size with their skeletons whole by `scripts/sketchfab-characters.mjs`, and posed in the browser by `src/lib/three/rig.js`, which poses any humanoid skeleton the same way.

## Deployment

Every push to `main` triggers [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). It installs dependencies with `npm ci`, then lints, runs the tests and builds, and deploys `dist/` to GitHub Pages at the custom domain in `public/CNAME`. A failing lint or test stops the deploy.

> **Working with Claude Code?** Agent skills live in `.claude/skills` (their sources are pinned in `skills-lock.json`). Lint and tests skip them.

## Disclaimer

This is a personal, non-commercial portfolio. The hidden worlds are fan-made tributes: Star Wars, The Lord of the Rings, Transformers, Marvel, Breaking Bad, The Office, Rick and Morty, Pirates of the Caribbean and Invincible belong to their creators and studios, and Game Boy is Nintendo's. The site isn't affiliated with or endorsed by any of them.

There's no open-source licence on this repository. The code and original content are © Tilak Patel. Third-party assets remain under their own licences, listed above.
