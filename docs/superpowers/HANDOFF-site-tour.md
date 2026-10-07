# Handoff: the site tour

The design is [specs/2026-10-07-site-tour-design.md](specs/2026-10-07-site-tour-design.md).

## Done

- A spotlight tour of the site's shell, one per view: the universe's (the panel, the ships, the nav map, the switch, search, the colours, the guide, the résumé) and the classic site's (the pages, the switch, search, the colours, the terminal, the guide, the résumé). Ten and nine stops on a laptop; eight and five on a phone, where the menu's stop takes the place of the nav's.
- The offer on a first arrival, at the map or the feed, once the intro and the front door's choice are out of the way. Made once (`tp-tour`); Start over forgets it.
- Ways back to it: ⌘K ("Take the tour of the site"), the guide's "The site" tab, the terminal's `tour`.
- The "Shown around" achievement for finishing it.
- **Each world's basics.** The first time you arrive in a world, before you're dropped in, the same cards (kind `brief`, "The basics · 1 of 5") say what the place is, how to move, how to do things, what to go for, and end lit on the guide's `?`. Every stop with controls shows them as the guide's key table, the keyboard's or a phone's (`rowsFor`). One per guide key, so every stop on Middle-earth's road shares one and every star system the galaxy's: seventeen in all (`tour/briefs.js`, `BRIEFED` in `tour/brief.js`; the test keeps them in step and checks every world on the map and every page the guide nudges has one). They wait until nothing covers the world (the intro, a dialog, a world asking before it downloads), then hold its keys and clicks until Let's go or Skip. Shown once a world (`tp-briefs`, forgotten by Start over); the guide's "Show me the basics" shows them again. The guide's first-visit note is off where there are basics. A script-driven browser (`navigator.webdriver`: the shot and check scripts) never gets them on its own.

- **The map's first flight.** Basics a page asks for itself (`ASKED`, `askBrief`): `UniverseMap` asks for `/universe/fly` once a ship's under you with the 3D on, and they show the first time, as a world's do, before the site tour's offer (which waits for them). The stick, getting about, landing and trouble, and the panel's `?`.

- **Audience tours (stream A, the engine).** Design: [specs/2026-10-07-audience-tours-and-ui-audit-design.md](specs/2026-10-07-audience-tours-and-ui-audit-design.md) sections 3–4; plan: [plans/2026-10-07-tours-engine.md](plans/2026-10-07-tours-engine.md), whose "Interface changes made while building" is what stream B writes against.
  - A tour is chapters, each one light route (`LIGHT_ROUTES` in `lib/tour.js`); `planFor` opens every audience tour with the shell of the view you're in, cut to `SHELL_STOPS`, and `flatten` lays the chapters out as one run of stops. `compose` folds tours together for the whole one.
  - Crossing pages: a stop on another page has `TourHost` open it, and the card waits in the middle ("One moment…") until the page has drawn (the route's Suspense fallback carries `data-fallback`), nothing covers it and its target is there; eight seconds at most (`WAIT_MS`), then the card shows centred. A shell stop not on this screen (`optional`) is skipped after 1.5 s. Back across a chapter opens the page before. The browser's Back, or any way off the page but the tour's own, ends it; a stop's `cta` ends it with progress kept and goes; `keys: 'release'` lets `?` and ⌘K through (`html[data-touring="release"]`, which the guide honours) and ends it.
  - Progress: `tp-tour` is JSON (`readProgress`: old `'offered'`/`'done'`/`'skipped'` still read; unset still means offer), written at every stop. Finishing unlocks `tour` and `tourRecruiter`/`tourPlayer` (the whole tour, both).
  - Ways in: the offer ("Here to hire, here to play, or both?": Hire, Play, Both, Not now), ⌘K (three tours and "Things to do"), the guide's "The site" tab (each tour, its chapters, "Carry on … (chapter n of N)"), the terminal (`tour recruiter|player|all`, `todo`), and a link: `/#/home?tour=recruiter[&chapter=id]` (`all` is the whole tour), marked offered at once and taken off the address. Until stream B's chapters land, an audience tour falls back to the view's tour.
  - **Things to do**: `src/data/todo.js` (`THINGS_TO_DO`, 64 rows), the guide's third tab (`guide/TodoList.jsx`): Hire, Play or Everything, "n of N done", ticked by achievements or by pages seen (`tp-visited-ever`, `lib/visited.js`, written by the shell; Start over forgets it), "Show me" starting the tour at the stop with that `todo`, or going to the row's page.

## The audience tours: the copy (stream B, `claude/tours-content`)

The spec is [specs/2026-10-07-audience-tours-and-ui-audit-design.md](specs/2026-10-07-audience-tours-and-ui-audit-design.md) as its section 8 (Revision 2) amends it; the plan [plans/2026-10-07-tours-content.md](plans/2026-10-07-tours-content.md). The engine that runs them is stream A's (`claude/tours-engine`).

- **The chapters.** `tour/chapters/recruiter.js` is the hiring tour: Home, Experience, Projects, the résumé, Contact, Under the hood and the end, which are chapters 2 to 8. `player.js` is the player's: Flying, the galaxy, the worlds, the games, Together, the checklist, Colours and scripts and the end, chapters 2 to 9. `shared.js` holds three things:
  - `SHELL_STOPS`, the view tour's stops each audience keeps as chapter 1, per A13;
  - `HELLO`, each audience's opening card;
  - `END`, the whole tour's last card, plus `CONTACT_ACTIONS` and `worldStop`.

  `steps.js` exports them as `TOURS.recruiter`, `.player` and `.mixed`. The last is composed by chapter id: the hiring tour from Home to Under the hood, the player's from the galaxy to the colours, then `END`. Until A's revision-2 `compose` lands, `steps.js` has a stand-in, marked to give way to it.
- **The shape** is the spec's 3.2 as amended:
  - Stops carry `actions` (`to`, `href` with `download`, or `tour`; `primary` on the PDF), `release` (on the shell's search and guide stops, and the checklist stop) and `todo`. Every `todo` is one of A's catalogue ids, and each world card carries its world's.
  - Flying is `brief: '/universe/fly'`, with no copy of its own.
  - Under the hood is `heavy`. Its `phone` version is two chapters, told from `/changes` and `/terminal`, offering the universe with its size once `WORLD_MB['/universe']` exists (A18).
  - The end chapters have `path: null`.
  - The ships stop reads `ctx.ship`, and the world cards read `ctx.touch`.
- **The worlds.** Star Wars' worlds are in the galaxy's chapter and every other world in `WORLDS` is a card in the worlds chapter, built by `worldCards()`. Each card is `ABOUT[to]` and, on a phone, its download where that's over 1 MB.
  - **Abouts.** `src/components/guide/abouts.js` (plain data) has one line for every briefed page. The guide's pages and each world's basics open with it, and `pages.test.js` keeps them agreeing.
  - **A new world** needs its about before its card reads right; the tests fail until it has one.
- **What the test keeps** (`tour/steps.test.js`):
  - five `TOURS` keys;
  - chapters on light routes, or `path: null`, or a brief;
  - every action a route `matchPath` finds in `App.jsx`, a link, or a tour;
  - marks both ways: every `at` is marked, and every page mark is used, the shell's and the basics' aside;
  - nothing lit twice in a tour but the guide;
  - ids unique with the shell and the hello;
  - 12 to 45 words a stop, and 30 at most on the hiring tour;
  - world cards under 25 words;
  - British spelling and curly quotes, and "the hiring tour", never "recruiter", on screen;
  - the reading time by B5's formula, under 5, 8 and 12 minutes. Today it is 269 s, 440 s and 573 s.
- **The marks** (`data-tour`, attributes only): `home-open`, `home-gameboy`, `home-github` (the heading in `FindMeOnline.jsx`), `experience-roles`, `experience-track`, `projects-featured`, `projects-table`, `resume-skills`, `resume-pdf`, `contact-copy`, `contact-form` (the memo's head line), `changes-log`, `terminal-input`, `online`, and `ships` also on the panel's flying block. There is no achievements control, so none is marked.
- **The achievements**: `tourRecruiter` "Shown the work" and `tourPlayer` "Shown the ropes". A's engine unlocks them.
- **The copy** was read by a panel (a recruiter, a player, the editor, two fact-checkers and a sceptical judge) and its findings applied before revision 2. Revision 2's new lines were checked again by the adversarial review before the pull request.

## Left

- Stream A's engine at revision 2 (`claude/tours-engine` was at revision 1 when this was written: `cta`, positional `compose`). Rebase on it, take A's `compose`, `LIGHT_ROUTES` and `SHELL_STOPS` where A puts them, then run `node scripts/tour-check.mjs --both` for all five tours and put the walker's tables in the pull request.
- A new world gets its basics by a key in `BRIEFED` and its cards in `briefs.js` (the tests fail until both are there), and its card in the player's tour in `chapters/player.js`.

## Checking it

- Fresh visit: clear localStorage, open `/#/home` (or `/`, skip the welcome and pick a view). The offer shows bottom left (top on a phone) after about two seconds of nothing covering the page.
- Again: `localStorage.removeItem('tp-tour')` and reload, or ⌘K → "tour".
- `?` doesn't open the guide while the tour runs (`html[data-touring]`); Escape ends it and puts focus back.
- A world's basics: `localStorage.removeItem('tp-briefs')` and open any world (`/#/scranton`, `/#/c-137`); a phone (the pane's Mobile size) shows the touch controls.
- An audience tour: `/#/home?tour=recruiter` (or `player`, `all`), or `window.dispatchEvent(new CustomEvent('tp:tour', { detail: { audience: 'recruiter', chapter: 'projects' } }))`. Before stream B's chapters, it's the view's tour.
- Things to do: ⌘K → "Things to do", or the guide's third tab; `localStorage.removeItem('tp-visited-ever')` clears its page ticks.
- `npx vitest run src/lib/tour.test.js src/lib/visited.test.js src/data/todo.test.js src/components/tour` for the logic, the catalogue and the stops.
- `npx vitest run src/lib/tour.test.js src/components/tour/brief.test.js src/components/tour` for the logic and the stops.
- `node scripts/tour-check.mjs [--phone | --both] [--tour classic,universe,recruiter,player,mixed] [--shots <name>] [--no-build] [--strict]` walks each tour in headless Chromium, stop by stop: it builds `dist/` when stale, serves it, starts each tour (the view tours by the event, the audience tours by their link, `/#/home?tour=hiring`, `/#/universe?tour=player`, `/#/home?tour=all`), waits up to 9 s a stop for the lit box or a card in the middle, presses → until Done, presses `?` then `Esc` at a stop that lets keys through (the guide must open and close over the tour), and checks `tp-tour` and the achievements. It fails on a stop that never shows, a stuck one, or a console error `scripts/lib/noise.mjs` doesn't know, and prints a table a tour. An audience tour the build doesn't have yet is skipped (a failure with `--strict`). Shots go to `/tmp/tour-check/<name>/`.
