# Handoff: the site tour

The design is [specs/2026-10-07-site-tour-design.md](specs/2026-10-07-site-tour-design.md).

## Done

- A spotlight tour of the site's shell, one per view: the universe's (the panel, the ships, the nav map, the switch, search, the colours, the guide, the résumé) and the classic site's (the pages, the switch, search, the colours, the terminal, the guide, the résumé). Ten and nine stops on a laptop; eight and five on a phone, where the menu's stop takes the place of the nav's.
- The offer on a first arrival, at the map or the feed, once the intro and the front door's choice are out of the way. Made once (`tp-tour`); Start over forgets it.
- Ways back to it: ⌘K ("Take the tour of the site"), the guide's "The site" tab, the terminal's `tour`.
- The "Shown around" achievement for finishing it.

## Left

1. **A world's own tour.** The engine takes any list of stops (`steps.js`), so a world could have one (the galaxy's panel, the hangar). It would need `data-tour` marks in the world and a key in `TOURS`; `tourFor` in `lib/tour.js` decides which a page gets. Done looks like: a world's first arrival offers its own tour instead of the guide's note.

## Checking it

- Fresh visit: clear localStorage, open `/#/home` (or `/`, skip the welcome and pick a view). The offer shows bottom left (top on a phone) after about two seconds of nothing covering the page.
- Again: `localStorage.removeItem('tp-tour')` and reload, or ⌘K → "tour".
- `?` doesn't open the guide while the tour runs (`html[data-touring]`); Escape ends it and puts focus back.
- `npx vitest run src/lib/tour.test.js src/components/tour` for the logic and the stops.
