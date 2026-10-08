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

## Left

Nothing open. A new world gets its basics by a key in `BRIEFED` and its cards in `briefs.js` (the tests fail until both are there).

## Checking it

- Fresh visit: clear localStorage, open `/#/home` (or `/`, skip the welcome and pick a view). The offer shows bottom left (top on a phone) after about two seconds of nothing covering the page.
- Again: `localStorage.removeItem('tp-tour')` and reload, or ⌘K → "tour".
- `?` doesn't open the guide while the tour runs (`html[data-touring]`); Escape ends it and puts focus back.
- A world's basics: `localStorage.removeItem('tp-briefs')` and open any world (`/#/scranton`, `/#/c-137`); a phone (the pane's Mobile size) shows the touch controls.
- An audience tour: `/#/home?tour=recruiter` (or `player`, `all`), or `window.dispatchEvent(new CustomEvent('tp:tour', { detail: { audience: 'recruiter', chapter: 'projects' } }))`. Before stream B's chapters, it's the view's tour.
- Things to do: ⌘K → "Things to do", or the guide's third tab; `localStorage.removeItem('tp-visited-ever')` clears its page ticks.
- `npx vitest run src/lib/tour.test.js src/lib/visited.test.js src/data/todo.test.js src/components/tour` for the logic, the catalogue and the stops.
