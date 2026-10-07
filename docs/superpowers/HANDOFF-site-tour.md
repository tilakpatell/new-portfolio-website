# Handoff: the site tour

The design is [specs/2026-10-07-site-tour-design.md](specs/2026-10-07-site-tour-design.md).

## Done

- A spotlight tour of the site's shell, one per view: the universe's (the panel, the ships, the nav map, the switch, search, the colours, the guide, the résumé) and the classic site's (the pages, the switch, search, the colours, the terminal, the guide, the résumé). Ten and nine stops on a laptop; eight and five on a phone, where the menu's stop takes the place of the nav's.
- The offer on a first arrival, at the map or the feed, once the intro and the front door's choice are out of the way. Made once (`tp-tour`); Start over forgets it.
- Ways back to it: ⌘K ("Take the tour of the site"), the guide's "The site" tab, the terminal's `tour`.
- The "Shown around" achievement for finishing it.
- **Each world's basics.** The first time you arrive in a world, before you're dropped in, the same cards (kind `brief`, "The basics · 1 of 5") say what the place is, how to move, how to do things, what to go for, and end lit on the guide's `?`. Every stop with controls shows them as the guide's key table, the keyboard's or a phone's (`rowsFor`). One per guide key, so every stop on Middle-earth's road shares one and every star system the galaxy's: seventeen in all (`tour/briefs.js`, `BRIEFED` in `lib/brief.js`; the test keeps them in step and checks every world on the map and every page the guide nudges has one). They wait until nothing covers the world (the intro, a dialog, a world asking before it downloads), then hold its keys and clicks until Let's go or Skip. Shown once a world (`tp-briefs`, forgotten by Start over); the guide's "Show me the basics" shows them again. The guide's first-visit note is off where there are basics. A script-driven browser (`navigator.webdriver`: the shot and check scripts) never gets them on its own.

- **The map's first flight.** Basics a page asks for itself (`ASKED`, `askBrief`): `UniverseMap` asks for `/universe/fly` once a ship's under you with the 3D on, and they show the first time, as a world's do, before the site tour's offer (which waits for them). The stick, getting about, landing and trouble, and the panel's `?`.

## Left

Nothing open. A new world gets its basics by a key in `BRIEFED` and its cards in `briefs.js` (the tests fail until both are there).

## Checking it

- Fresh visit: clear localStorage, open `/#/home` (or `/`, skip the welcome and pick a view). The offer shows bottom left (top on a phone) after about two seconds of nothing covering the page.
- Again: `localStorage.removeItem('tp-tour')` and reload, or ⌘K → "tour".
- `?` doesn't open the guide while the tour runs (`html[data-touring]`); Escape ends it and puts focus back.
- A world's basics: `localStorage.removeItem('tp-briefs')` and open any world (`/#/scranton`, `/#/c-137`); a phone (the pane's Mobile size) shows the touch controls.
- `npx vitest run src/lib/tour.test.js src/lib/brief.test.js src/components/tour` for the logic and the stops.
