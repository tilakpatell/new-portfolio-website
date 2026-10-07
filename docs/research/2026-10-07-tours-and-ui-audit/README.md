# Audience tours and the UI audit: research and pickup note

Date: 2026-10-07. Branch: `claude/beautiful-euler-prmk6e`. Owner's ask, in their words: "Architect a way to make an in depth tour system site wide. This is to help see what there is to do for the players and recruiters (recruiter version vs player version vs mix). Also make it so you audit the UI and really see what is good design for a UI (for the games frontend looks good maybe just spacing). The UI for universe and stuff the language plus spacing plus ease of reading and not too many different things for the same thing. Architect all of this and then spin it to Opus 5.5 ultracode sessions to implement."

This folder holds the research a session saved before its usage ran out, so the next session can pick up without redoing it.

## What is here

| File | What it is |
| --- | --- |
| `tour-system.md` | A complete map of the existing tour, briefs and guide (`src/lib/tour.js`, `src/components/tour/*`, `src/components/guide/*`): the first-load flow, every `tp-` localStorage key, the stop data model, every `data-tour` target, every entry point, what breaks if a tour has to cross routes, and the extension points. |
| `things-to-do.md`, `things-to-do.json` | Every page, world, game, mission, mini-game, multiplayer mode, easter egg, tool and achievement a visitor can do, as rows: route, kind, audience (recruiter, player, both), how to try it, time to try, prerequisites, phone support, evidence (`file:line`), and a recruiter "showcase" note. The raw material for the three tours. |
| `ui-shell-classic.md` | The UI audit of the shell and the classic pages: tokens in use, duplicates ("the same thing done two ways"), language, readability, spacing. Opens with what is good and should be the standard. |
| `ui-universe.md` | The UI audit of the universe map's HUD (panel, nav map, hangar, settings, comms, online). Layout map for desktop and phone, the glossary clashes, readability over 3D, spacing. |
| `ui-worlds-games.md` | The UI audit of every world's HUD and game frontend: a world × concept table, how many implementations and words exist per concept, spacing values per world, which worlds follow the Invincible HUD rules. |

Not yet saved when this was written: the screenshot audit (`ui-screenshots.md`, in progress), the two-lens verification of every finding (code check and design check), the synthesis (`ui-audit-synthesis.md`: the house UI rules, the glossary, the component consolidation table, work packages) and the gap critic. Findings in the three audit files are therefore unverified: treat each as a claim to check at its `file:line` before acting on it.

## State of the work

1. Done: the research above (five of six readers), and the written spec:
   `docs/superpowers/specs/2026-10-07-audience-tours-and-ui-audit-design.md` (the three tours, the engine that crosses routes, the catalogue and checklist, the house UI rules, the glossary, the HUD kit, and the four streams for the implementation sessions).
2. Not done, the session's usage ran out: the screenshot audit (partial PNGs only, not saved), the two-lens verification of the audit findings, the synthesis, the gap critic, the design judge panel (the spec was written by the architect from the research instead), the per-stream implementation plans, and the Opus 5.5 sessions.
3. Next session: read the spec, write one plan per stream under `docs/superpowers/plans/` with the writing-plans skill (or let each stream's session do it from the spec's section 6), then create the four sessions (model `claude-opus-5-5`, each prompt carrying "ultracode", the spec path and its stream letter, each on its own branch as the spec's table names them).

## The architecture so far (the architect's working notes, not yet a spec)

The existing tour is a one-view spotlight tour (`universe` or `classic`), nine to ten stops, no route changes, plus per-world "basics" cards on first arrival. The owner wants three site-wide, in-depth tours that show what there is to do. The shape being designed:

- **Three audiences, one engine.** `recruiter`, `player`, `mixed`. A tour is a list of **chapters**; a chapter is a list of stops on one route. The mixed tour is the recruiter spine with the player chapters folded in, not a third set of copy.
- **Stops that cross routes.** A stop gains `go: '/route'` (navigate first) and the engine waits until the page is ready (the target is on screen and nothing covers it: the existing `busy()` check in `TourHost.jsx`) before lighting it. Today `TourHost` ends the run when the route's tour kind changes; that effect has to learn the difference between "the visitor left" and "the tour moved us".
- **A things-to-do catalogue** (`src/data/todo.js` or similar, built from `things-to-do.json`): id, title, route, kind, audience, how-to, time, prerequisites, done-signal (an achievement id or a visited route). The tours draw their stops from it, and a **"Things to do" tab in the guide** lists it with an audience filter and done-state, so the tour and the checklist never disagree.
- **Entry points**: the first-arrival offer asks "Here to hire, here to play, or both?"; ⌘K gets three commands; the terminal gets `tour recruiter|player|all`; a deep link (`/#/home?tour=recruiter`) starts one, so the owner can send recruiters a link; the guide's "The site" tab lists the chapters so any one can be taken alone.
- **Progress** kept in localStorage (`tp-tour` grows a structured value: audience, chapter, stop, done chapters), forgotten by Start over, so a tour can be resumed.
- **Tests**: the pure parts in `src/lib/tour.js` (plan resolution, next stop across chapters, deep-link parsing); a data test that every `go` route exists in `App.jsx` and every `at` target has a `data-tour` marker somewhere; a Playwright walker (like `scripts/autopilot-check.mjs`) that takes each tour end to end in headless Chromium and fails on a stop that never becomes ready.
- **The UI work**, from the audits: a short house UI rule set (spacing scale, type scale, one component per concept, one word per concept, text-over-3D scrim rule, phone safe areas, touch targets, key-cap style, fixed homes for menu, guide and exit), a glossary, and a consolidation of the world HUDs onto the shared runtime HUD, the Invincible HUD rules as the reference.
- **Implementation split for Opus 5.5 sessions** (each its own branch, each prompt carrying the word "ultracode"): A. tour engine; B. tour content and `data-tour` markers; C. shell, classic and universe UI consistency; D. world HUD consolidation and spacing. A and C and D can run at once; B after A's data model is fixed in the spec.

## How to pick this up

1. Read this file, then `tour-system.md` (the engine), then skim `things-to-do.md` (the content) and the three audits' "what is good" sections.
2. Finish the verification and synthesis if they were not saved: for each audit finding, check the code at its `file:line` and ask whether a strong designer would make the change without flattening the site's character.
3. Write the spec to `docs/superpowers/specs/2026-10-07-audience-tours-and-ui-audit-design.md`, then plans under `docs/superpowers/plans/`, then spawn the sessions.
