# Handoff: Middle-earth kitchens, side games, Orthanc

For whoever picks this up next (another session, or the same one after a
break). State as of 2026-10-05.

## Asked for

- An Overcooked-style co-op kitchen in every chapter, played online
  (Nostr relays, no backend). Other players in the walkable towns are
  ghosts from "another dimension": visible, no interaction.
- New games and tasks inside the walkable worlds.
- The inside of Orthanc, found through an Easter egg.
- Keep merging whatever is done into main, agent worktrees included.

## Done (on main)

- Ten kitchens, `src/components/middleearth/rush/`, one per chapter:
  party (Shire), pony (Bree), weathertop, rivendell, moria, lorien,
  amonhen, ithilien (dead-marshes), tower (cirith-ungol), cormallen
  (mordor). Mounted in `src/pages/MiddleEarth.jsx`, one block each.
  - Pure rules, tested: `rules.js` (mechanics: fishing line F, leaf table
    L, patch G, carving table A, webs ',', `fuel`, `thief`, multi-recipe
    ovens via `ovenFor`). Wire: `protocol.js`. Host/guest: `online.js`.
  - Look: `scene.js` + a theme per kitchen in `rush/themes/` (see the
    header of `themes/common.js` for what a theme can say). Things:
    `items.js`. Levels: `rush/levels/*.js`.
  - Append-only rule: new KINDS, new states on a kind, new event types go
    on the END of their lists (the wire indexes them).
  - Spec: `docs/superpowers/specs/2026-10-05-pony-rush-design.md` (table
    of all ten).
- Ghost travellers in the towns: `towns/travellers.js`, `ghosts.js`,
  `useTravellers.js`.
- Merged from the agents (their branches `worktree-agent-*`):
  - Orthanc: `towns/orthanc/`, hidden route `#/middle-earth/orthanc`,
    found by clicking Orthanc on the map; `middleearth/hidden.js`; spec
    `docs/superpowers/specs/2026-10-05-orthanc-design.md`.
  - Side games: Hobbiton (Bilbo's spoons), Lothlórien (Legolas's
    targets), Amon Hen (ducks and drakes), Dead Marshes (Sméagol's safe
    way). Shared `towns/side.js`. Their achievements are NOT in any
    chapter's `seals` (a chapter is "won" when all its seals are).

## Still in flight when this was written

Three background agents, each in its own worktree under
`.claude/worktrees/agent-*` (git-ignored), committing one world at a time
on its own branch:

- western side games: Shire done; Bree, Weathertop, Rivendell, Moria to go
- eastern side games: Lórien, Amon Hen, Dead Marshes done; Cirith Ungol,
  Mount Doom to go
- Orthanc: first commit merged; may keep polishing

To pick up their work: `git log origin/main..worktree-agent-<id>` for new
commits, `git merge worktree-agent-<id>`, resolve (usually
`MiddleEarth.jsx` blocks or `Achievements.jsx` lists: keep both sides),
lint, test, PR, merge. If the worktrees are gone, the branches may still
exist locally; if not, the work in them was lost, so redo from the list
above.

## Ideas not done yet

- Kitchen dressing still thin in places: the orcs' mess (no screenshot
  reviewed yet), Amon Hen (ducks, the falls' mist), the Pony floor.
- A kitchens list on the map hub (best stars per chapter).
- Shots of every walkable world after the side games land, then dress
  what looks bare.

## How to check things (local, git-ignored `lab/`)

- `lab/browser.mjs`: Vite in-process + the container's Chromium
  (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, SwiftShader).
  Never `playwright install`.
- `lab/rush.html?level=<id>` (+ `lab/rush-entry.jsx`): one kitchen on its
  own page, no town above it (much lighter).
- `lab/rush-smoke.mjs [ids]`: load, play, set up mid-service
  (`lab/rush-setups.mjs`), run; fails on any page error.
- `lab/rush-shots.mjs <prefix> [ids]`: canvas read straight back
  (preserveDrawingBuffer); Playwright's own screenshot hangs on this
  page's fonts, so don't use it here.
- Under heavy load (several agents rendering) shots take minutes and long
  simulation tests elsewhere time out at 5 s; rerun with
  `--testTimeout=120000` before calling anything broken.
- `window.__RUSH__` = { api, sim } in dev; `sim.speedup` speeds the clock.

## Conventions

- Commit trailer:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and the
  session's `Claude-Session:` line.
- Branch for this work: `claude/zealous-bohr-se2l0t`. After its PR
  merges, restart it from main before new work.
- The towns session (another session) owns the walkable towns; tell it
  before large changes there.
