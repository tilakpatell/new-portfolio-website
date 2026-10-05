<div align="center">

# tilakverse

**The code behind [tilakpatell.com](https://tilakpatell.com), Tilak Patel's personal site: a portfolio you can fly through.**

A résumé on the surface. Underneath it, a 3D universe with a starfighter, thirteen hidden fan-made worlds (one of them a whole Star Wars galaxy), playable games and online multiplayer, all running on a static site.

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
| Changes | `/changes` | The ship's log: every change the site's autopilot has made, with a picture, and how to undo it |

The six pages are one feed: scroll to the end of any of them and the next begins under it, with a divider saying what comes next, and the address, the menu and the theme follow whichever page is on screen. After the sixth, an end card. Each page is still its own address, so every link works as before.

All of the content (roles, projects, skills, education) lives in [`src/data/`](src/data). Every page and the terminal read from there.

### The universe

The front door (`/`) is a map of the whole site as places in space. The **Universe | Classic** switch at the top of every page moves between the map and the plain pages, landing on the same place in the other (Experience's page and its station, say), and the front door opens on whichever you picked last. A first visit opens with a crawl, then puts you in a cockpit (the Millennium Falcon, an X-wing, Rick's space cruiser or Walt and Jesse's RV) and launches you into the map. Fly to a planet to open its page.

| Key | Action |
| --- | --- |
| `W` / `S` | Throttle |
| `A` / `D` | Roll |
| `←` `→` `↑` `↓` | Turn and pitch the nose |
| `F` (hold) | Fire |
| `R` / `1` `2` `3` | Change weapons: blaster, spread, heavy ordnance |
| `T` / `Q` | Next / previous target |
| `V` | Switch between the chase camera and the cockpit view |
| `O` | Flight settings (steering, aim assist, inverted pitch and more) |
| `H` | The hangar: paint and parts for the ship you're flying |
| `G` | Land on the planet you're at and step out (and, on foot, get back in) |
| `M` | The nav map: everywhere on one chart. Pick a place and a drive (hyperspeed, a jump; super speed, 3× the pulse drive; or cruise), with the trip time for each |
| `J` | Jump to the place picked at hyperspeed |

On foot, `W` `A` `S` `D` walk, `Shift` runs, `Space` jumps, `F` or a click fires, `X` switches to the other one of your crew and `V` looks out of their eyes. The Galactic Federation's squads come over the horizon now and then. On the Death Star you come down beside its trench, on hull plating with blocks and towers standing on it, and can walk up to the rim and look down into the trench run.

The hangar fits each ship out its own way, like a space sim's outfitting screen, and remembers it. Paint jobs are the site's own colour schemes: the six companies' come with the Cartographer achievement, and each fan scheme's with the easter egg that unlocks it. Parts bolt on and change how it flies and fights: strap-on boosters (solid rockets, an afterburner, repulsor pods, portal-fluid tanks), thrusters, twin or fusion guns, plating or fast-charge shields, and fins. Each draws power from the ship's plant and adds mass, so you can't fit the best of everything; the best parts are earned with achievements in the worlds. Other pilots see your paint and parts. The X-wing and the Falcon you fly are other people's models from Sketchfab (CC BY, credited on the map), brought to web size by `scripts/sketchfab-batch.mjs`; while they load, versions modelled in code (`universe/hulls.js`) stand in.

Other pilots on the site at the same time show up in your sky. You can fly with them, fight hunters together, or shoot each other down. Land on a planet where someone's already down and you come down beside them, and your crews walk about together. Two of the same person (two Ricks, two Walts) meet as that person from another dimension. Off the map, in Middle-earth's towns and on its map, at Avengers HQ and in Albuquerque, everyone else online shows up as a pale ghost from another world (a Frodo, a Spider-Man hologram, or a Walt's Aztek) with their name over them; nothing passes between you but where each of you is.

The map is big: the planets are a hundred and more ship-lengths across, and the fandoms far out in deep space.

Things happen while you fly. Hunters come after you (the Empire, the Galactic Federation, the Council of Ricks), a Star Destroyer drops out of hyperspace and launches its fighters, someone calls for help with pirates on their tail, a convoy goes by, a comet crosses the sky, a star blows far out. A star flares and its shockwave rattles the ship. A rift tears open ahead of you: fly into it and it takes you somewhere else on the map. And something enormous swims past: a pod of purrgil, or a Cromulon with something to say. The crew have a word about all of it.

Every ship carries three guns, each in its crew's own terms: its blaster, a spread that throws a fan of five shorter shots, and heavy ordnance (the X-wing's proton torpedoes, the Falcon's concussion missiles, the cruiser's portal grenades, the RV's fulminated mercury), a slow round that homes on whatever the guns have locked and hits ten times as hard, from a rack of four that refills one at a time. Other pilots see which you're firing.

And the Citadel of Ricks can be brought down. A shield covers it while any of the four generators out on its arms' domes still runs; knock them all out with anything, then only heavy ordnance hurts the core, and the Council sends its hunters once you start. It goes up in fire and portal fluid and its wreckage drifts where it was, for everyone online, until the Ricks bring it back through a portal five minutes later (a siege nobody finishes is patched up four minutes after the last hit). The siege is shared without a server: each pilot speaks only for the damage they did, and every browser adds the shares up the same way (`universe/siege.js`).

### A galaxy far, far away

Star Wars on the map isn't a planet but a universe of its own: the galaxy itself in miniature, a spiral of stars with its systems lit where they are, behind a hyperspace gate the Empire's Star Destroyers guard. Fly into the gate (or pick it and go) and you jump to lightspeed into `/galaxy`: eighteen star systems from the films (and from the two shows set after them, The Mandalorian and Ahsoka), from Tatooine, Hoth and Endor to Coruscant, Scarif, Nevarro and Mandalore, each with its region and grid square from the films' atlas, its era and films, and the moment it's remembered for playing out round it (Death Squadron over Hoth, the Battle of Endor, the Death Star rounding Yavin with its trench to fly, the Razor Crest with a TIE on its tail over Nevarro, the Mandalorians taking back Mandalore). Every pilot online sees the same moment at the same time, and meets the other pilots in the same system.

Every other system's star is up there in the sky, where it really is from where you are (Hoth's close by from Bespin, high above the galaxy's band; Coruscant's a bright star toward the core). Turn the nose toward one and its name comes up; put the nose on it and press `J` (or tap Jump), or just fly on out of the system toward it, and you jump.

Keep jumping and the Empire notices. Somewhere between your tenth and fifteenth jump an Imperial Interdictor cruiser is waiting on the lane: its gravity-well projectors pull you out of hyperspace a long way short of where you were going, its TIEs launch, and the hyperdrive won't take again (nor the sublight drive open up) until you're clear of the well: shoot its fighters down, run for the well's edge, or ride it out. Then it jumps away, and the count starts over.

| Key | Action |
| --- | --- |
| `J` | Jump to lightspeed, to the star your nose is on (every ten to fifteen jumps, an Interdictor pulls you out short) |
| `M` | The galaxy map: plot a course, filter by era or film |
| `E` | Land on the planet you're at (or board the Death Star) |

#### Down on the worlds

Every planet from the films you can stand on (all but Alderaan, which is gone) is a world of its own to land on and walk: `/galaxy/tatooine/surface`. Your ship comes down out of the sky and sets down, and you and your crewmate climb out onto the sand, the snow, the forest floor, a platform over Bespin's clouds or a Coruscant rooftop. Each world has the places from the films to find (the Lars homestead, Mos Eisley and the Sarlacc on Tatooine; Echo Base on Hoth; the Ewok village and the shield-generator bunker on Endor…), named on a compass until you've found them, with what the crew have to say about each; its people and creatures going about their business, who'll talk if you go up to them; speeders, speeder bikes and tauntauns to ride; walkers, ships going over, the weather and the sound of the place. Online, the other pilots down on the same world are there with you. Get back in the ship to take off, back up to the system.

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` | Walk (the way the camera faces); on a speeder, throttle and steer |
| `Shift` / `Space` | Run (or boost) / jump |
| Drag, scroll | Look round, zoom |
| `E` | Talk, ride (and get off), get in the ship and take off |
| `Tab` | Swap to your crewmate |

The flying keys are the universe map's. Every system has a mission: the trench run and boarding the Death Star are playable now; the rest have briefings, with their own opening crawls, for games still being built ([the plan](docs/superpowers/specs/2026-10-05-galaxy-games-design.md)).

### The hidden worlds

Each planet on the map that has a world gets a page of its own, with its own art direction, soundboard and usually a game.

| World | Route | Fandom | Highlights |
| --- | --- | --- | --- |
| A galaxy far, far away | `/galaxy` | Star Wars | Eighteen star systems to fly, jump between and fight over, each with a mission briefing, and the films' worlds to land on and walk |
| Death Star | `/deathstar` | Star Wars | Fly the trench run before Yavin 4 comes into range |
| Music room | `/music` | Indian classical music | Land on the music planet and walk a dusk courtyard in 3D to its instruments; a sitar with fret settings and an auto chikari, a real harmonium, the tabla and the tanpura; forty ragas, or your own |
| Middle-earth | `/middle-earth` | The Lord of the Rings | A map of chapters: walk every stop on the road in 3D as Frodo, from Hobbiton to Mount Doom, each with a game on the side (Bilbo's spoons, a song on the Pony's table, Gandalf's mark, riddles with Bilbo, the plank over the well, Legolas's targets, ducks and drakes, Sméagol's safe way, crumbs on Sam's cloak, remembering the Shire); cook in co-op, Overcooked-style, in a kitchen at each one (Bilbo's party, the Prancing Pony, Weathertop, Elrond's table, the forges of Moria, Lórien's flets, Parth Galen, Ithilien, the orcs' mess in Cirith Ungol and the feast at Cormallen); open the Doors of Durin, cross Gorgoroth; find Orthanc off the road; and read the road so far on the map (seals, side stars, kitchen stars) |
| Cybertron | `/cybertron` | Transformers | Pick a side, write in Cybertronian, play *Roll out* |
| Avengers HQ | `/avengers` | Marvel | Walk the compound in 3D as Spider-Man, or swing across it the way Insomniac's games do: hold the jump in the air to web a roof edge, a tree or a floodlight mast, steer the swing, let go on the upswing for a perfect release, zip with Shift, throw flips and twists in the air with `T` for style points that bank when you land (and are lost if you land mid-flip), run up any wall you hit and along the roofs, race the swing tour's rings round the compound (against a hologram of your best lap, once you have one), suit up in the Iron Man armour by Tony's workshop door (`E`) and fly it on its repulsors, stop time with `P` for a photo (the camera anywhere round him, a lens and a picture to save), and find the twelve backpacks Peter webbed up round it (on the roofs, up the masts, under the bridge), each with something of his in it. Everyone else online shows as a hologram. Each building opens its game (*Thwip!* at the front gate), and each game wins an Infinity Stone back for Thanos's gauntlet |
| Albuquerque | `/albuquerque` | Breaking Bad | Drive around town in Walt's Aztek, which slides if you ask it to: `Space` is the handbrake (handbrake turns, drifts, a J-turn out of reverse), and `O` opens the driving settings (steering, stability, camera). Places open up as Walt's career grows, each with its own game. Other drivers online show up as ghost Azteks |
| Scranton | `/scranton` | The Office | Walk Dunder Mifflin in 3D as Jim, from the lift to the annex, and get through a week in seven jobs (cover reception, the stapler in Jell-O, Kevin's chili, paper toss, Dwight's fact check, his fire drill, a Dundie from Michael); then the office from above, Dwight's fact check and the Dundies |
| Dimension C-137 | `/c-137` | Rick and Morty | Walk the Smiths' street in 3D as Morty, fly Rick's cruiser (it talks, and the Federation's patrol ship flies alongside), meet the President at his limo and take his portal to the Oval Office, breakfast with a Federation agent at Shoney's, find Rick's clone lab under the garage and Morty's Mind Blowers past it, go through the garage portal to Blips and Chitz and play *Roy*; the portal gun, *Portal panic*, the Meeseeks box and interdimensional cable; and the Citadel of Ricks (`/c-137/citadel`, or fly into it on the map), walked in 3D as Rick C-137: a terrace over the show's city of Ricks, crowds of every Rick and Morty variant, a core of portal fluid with the Central Finite Curve turning round it, and five scenes from the show (Morty Day Care, Simple Rick's line, the Council, election day, the red alert) |
| Earth | `/earth` | Travel | Down from orbit onto the globe as it is right now (NASA's Blue Marble and Black Marble, the real sun), then fly a little plane to every place I've been: a passport stamp and a postcard at each |
| Dot Matrix | `/dot-matrix` | Gaming | A Game Boy island in its four greens (a Bayer-dithered last pass, outlines from the depth buffer): jump about, find the eight cartridges (each one a project) and play the giant Game Boy in the square |
| The Caribbean | `/caribbean` | Pirates of the Caribbean | Sail *Dead Man's Tide* at the Black Pearl's helm |
| Invincible | `/invincible` | Invincible | Fly *Think, Mark!* over the city as Invincible: rings with your father, the Flaxans, Omni-Man and Thragg, with HD figures |

### Easter eggs

- **↑ ↑ ↓ ↓ ← → ← → B A** jumps to lightspeed.
- **⌘K / Ctrl+K** opens a command palette that can go anywhere on the site and run its tricks.
- There are dozens of achievements to unlock. Scranton's Dundies hand them out as awards.
- The fan colour schemes the eggs unlock each bring a live background to the portfolio pages: a dogfight crossing the stars for the Jedi and the Sith, Heisenberg's blue crystals, Iron Man's HUD tracking the pointer, Dunder Mifflin's paper and paper airplanes, invaders marching over a synthwave grid, diyas and sky lanterns, a ship on the horizon at Tortuga, Cybertron's energon and insignia, the Shire's fireworks or the Eye of Sauron watching you, and portals. Click on empty page for a surprise. They can be switched off under the colour picker.

## Tech stack

- **[React 19](https://react.dev/)** with [React Router 7](https://reactrouter.com/) (hash routing, so it works on static hosting)
- **[Vite 8](https://vitejs.dev/)** (Rolldown) for the dev server and build
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
| `node scripts/autopilot-check.mjs` | Everything the autopilot checks before a merge: lint, tests, build, bundle sizes, every page in headless Chromium |

The asset pipeline scripts regenerate committed files. You don't need them to run the site.

| Command | What it does |
| --- | --- |
| `npm run cc0` | Fetch the games' CC0 scans and skies from Poly Haven and ambientCG into `public/games/` (behind a proxy, set `NODE_USE_ENV_PROXY=1`) |
| `npm run hq-assets` | Fetch and shrink the Avengers HQ games' CC0 assets into `public/hq/` |
| `npm run kenney` | Convert Kenney's kits for *Portal panic* (`KENNEY=/path/to/kits npm run kenney`) |
| `npm run photos` | Turn the Travel photos into small WebP files and record their sizes, alt text and credits |
| `npm run globe` | Rebuild the dotted globe on the Travel page |
| `python3 scripts/build-harmonium.py` | Rebuild the music room's harmonium from its CC0 recording (downloads it the first time) |
| `node scripts/ktx2.mjs report <files>` | For each texture in the given GLBs or images: what it would cost and save as a GPU-compressed KTX2 (bytes, GPU memory, PSNR) and whether it's worth it. `convert` rewrites them; the site's loader reads KTX2 already |

The scripts that call Meshy (`scripts/meshy*.mjs`) read `MESHY_API_KEY` from `.env.local`. Sketchfab downloads are brought down to web size by `scripts/sketchfab-import.mjs` and `scripts/sketchfab-batch.mjs`.

## Project structure

```
├── .github/workflows/ci.yml       # lint, test and build on every pull request
├── .github/workflows/deploy.yml   # lint, test, build and deploy on every push to main
├── docs/                          # architecture notes, research and design plans
│   └── autopilot/                 # the self-improvement loop: its backlog and switches
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
    │   ├── galaxy/                # a galaxy far, far away: the systems, hyperspace, the galaxy map
    │   │   └── surface/           # its worlds from the ground: land, terrain, sky, the places, people and rides
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

A deploy replaces every file in `/assets` (they're named by hash), so a page that's already open, or an `index.html` a cache still holds, can ask for files that are gone; behind the intro, that used to surface only at the cut to the universe, as "This page didn't load". A page that hits one reloads from the new build (`src/lib/stale.js`, through `ErrorBoundary`), past any cached `index.html`, playing the intro again if it was partway through; it won't reload twice within a minute, so an outage can't loop.

> **Working with Claude Code?** Agent skills live in `.claude/skills` (their sources are pinned in `skills-lock.json`). Lint and tests skip them.

## The autopilot

The site improves itself. A scheduled Claude Code session comes round (every four hours), makes one improvement well (something faster or better-looking more often than something new), checks it with `node scripts/autopilot-check.mjs` (lint, the tests, the build, every page in a headless browser), opens a pull request, waits for CI, merges it, and logs it on [`/changes`](https://tilakpatell.com/#/changes), the ship's log, with a screenshot. Any change there can be taken out again by telling a Claude session `Revert change 12`. The protocol is [`.claude/skills/autopilot/SKILL.md`](.claude/skills/autopilot/SKILL.md), the queue is [`docs/autopilot/backlog.md`](docs/autopilot/backlog.md), and the switches (pause, runs a day, the plan's limit) are in [`docs/autopilot/budget.json`](docs/autopilot/budget.json). [`docs/autopilot/README.md`](docs/autopilot/README.md) has the details.

## Disclaimer

This is a personal, non-commercial portfolio. The hidden worlds are fan-made tributes: Star Wars, The Lord of the Rings, Transformers, Marvel, Breaking Bad, The Office, Rick and Morty, Pirates of the Caribbean and Invincible belong to their creators and studios, and Game Boy is Nintendo's. The site isn't affiliated with or endorsed by any of them.

There's no open-source licence on this repository. The code and original content are © Tilak Patel. Third-party assets remain under their own licences, listed above.
