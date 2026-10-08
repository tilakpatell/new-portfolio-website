# The UI, seen: a screenshot audit

Date: 2026-10-07. Desktop only (1440 × 900, headless Chromium with software WebGL, the intro and the tour offer seeded off). The phone pass did not run before the session's usage ran out; the phone findings in `ui-worlds-games.md` section 4 stand as code-level claims. The shots were not committed (15 MB of PNG); regenerate any route with `node scripts/autopilot-check.mjs --skip lint,test --routes <route> --shots <id>` (adds `--phone` for 390 × 844).

Routes seen: `/`, `/universe`, `/home`, `/experience`, `/projects`, `/resume`, `/contact`, `/travel`, `/terminal`, `/changes`, `/galaxy`, `/galaxy/hoth/surface`, `/invincible`, `/scranton`, `/albuquerque`, `/avengers`, `/c-137` (and its gate), `/cybertron` (and its gate), `/middle-earth`.

## What is good, seen

- **The classic pages are one system.** Home and Projects open the same way: a mono eyebrow, a display title, a lead, buttons, the route line down the left margin, the guide's `?` bottom right. Nothing here needs changing; it is the reference rhythm (`ui-shell-classic.md` section 1.4).
- **The universe panel and the galaxy panel are the same panel.** Eyebrow, title, one primary button, a paragraph, the four ship cards, a footer of mono links. The galaxy's adds a system's chips and a story card. The consistency is exactly right; the words are not (below).
- **The nav bar stays over every world**, so every HUD's top row starts at the same height (about 90 px down). Every page has the `?` in the same corner. Those two fixed points are what the HUD kit's rows should be measured from.
- **Invincible's HUD** reads at a glance: eyebrow and title top left, two chips top right (time, Menu), one speed box bottom left, the compass strip, the map. It is the reference, as the code audit says.
- **The prompt cards** in Scranton and Albuquerque (a title, a line, one or two buttons with the key cap) are the best prompt on the site: clear, on glass, centred low.
- **Objective lines on glass** (Scranton, Albuquerque, Avengers, C-137) read well over any scene.

## Findings

Each names the shot, what the eye sees, and where the code is (from the code audits).

### The universe map (`/universe`, `/galaxy`)

1. **Three styles in one corner.** Bottom left of the map: a round 44 px icon button with no label (the crosshair), then a mono "Multiplayer" pill; the panel's foot has mono text links "Classic site" and "Back to the intro". Three button styles within 300 px of each other. `universe.css` button families (`ui-universe.md` section 3: 9 icon-button sizes, 5 link styles). Fix: the kit's `hud-chip` for both corner items, with a label on the crosshair.
2. **The panel's paragraph is the longest thing on the screen.** Forty words under the title and the button before the ships. `UniversePanel.jsx:201`. Fix: one sentence ("Stations are my pages; planets are worlds. Pick a ship, or a place.") and let the ships carry the rest.
3. **Two names for one button.** The universe panel says "Open the nav map"; the galaxy panel, the same panel, says "Plot a course". Fix: one label from `universe/words.js`.
4. **Two words for leaving.** "Classic site" and "Back to the intro" in the panel's foot are the only exits on the map; a world says "Back to the site". Glossary rows "The plain site" and "Restart".
5. **Station labels are too small to read at arrival.** The stations round the sun carry 9 px-looking tags with no glow or shadow; the planets' names are invisible until near. `universe.css` label rules (`ui-universe.md` F28–F32). Fix: the nav map's text shadow on labels, a minimum size.
6. **Multiplayer sits in two places across the site.** Bottom left as a pill on the map and the galaxy; top right as "See other players/visitors/drivers/Mortys" chips inside the worlds. Fix: the kit's `PlayersChip` in the Menu row on worlds, and the same chip bottom left on the map.

### The worlds

7. **Ragged right columns.** Albuquerque (four chips), Avengers (seven), C-137 (three), Scranton (three) stack right-aligned chips of different widths under the minimap: each chip is its own width, so the column's left edge zigzags. Fix: the kit's top-right column is one width (the widest chip) or a single Menu, as Invincible does.
8. **Four bottom buttons in Albuquerque crowd the guide.** "Driving D · Run a delivery R · Golden hour T · Places M" sit in a row along the bottom, and "Places" ends 20 px from the `?`. `AbqWorld.jsx` (`ui-worlds-games.md` section 7, "One Menu for the rest"). Fix: one Menu top right; the thumbs row is for touch.
9. **Invincible's map touches the guide.** The round map bottom right is cut by the viewport's bottom and its edge runs under the `?` button's space. `world.css:129-136`. Fix: measured clearance (`--guide-reserve`) as the kit's rule.
10. **Four bullets for one objective.** ◆ (Scranton, Albuquerque), ▲ (Avengers), a portal icon (C-137), a coloured left bar (Cybertron). Fix: one `Objective` with the world's accent colour as the only variation.
11. **The first hint is a paragraph.** Avengers shows three lines, about sixty words, with eight key names in prose at the bottom of the scene; C-137 two lines. `CompoundWorld.jsx` and `RmWorld.jsx` first hints. Fix: the five keys that matter as caps in one line, "? all the controls" after it (the `GuideCue`); the guide has the rest.
12. **Key caps differ world to world.** Scranton and Albuquerque put the cap after the verb ("Go in E"); Cybertron's gate lists keys in a mono table with no caps; C-137's hint uses a cap for `?` only. Fix: one `.kbd`, key first in prompts ("E Go in").
13. **Exits in three words on three pages.** "Back to the site" (C-137, bottom left; Middle-earth, bottom left), "Classic site" (the map). Fix: "Leave" inside a world's scene, "Universe map" on the world's page (the world switcher), per the glossary.
14. **Cybertron's gate is a different dialog.** A centred card with its own kicker, title, two faction pills, a red "Click to play" and a key table: the only world whose arrival is a modal, in a style the rest do not share (and "Click to play" is not a phrase the site uses elsewhere: the worlds say "Let's go"). Fix: the tour's brief card (`kind: 'brief'`) for the arrival, which the other worlds already use; the faction pick stays as a `.seg` inside it.
15. **Middle-earth's chips are a third pill family.** The place chips along the bottom (Cinzel, outlined, joined by dashes) and "The road so far" / "Back to the site" are handsome and should stay as the map's own face; but the hint above them ("Drag to look about · scroll to zoom · click to walk or talk · WASD to steer") is plain text with no caps and sits 12 px over the chips. Fix: caps for the keys, the kit's foot row spacing.
16. **The galaxy surface showed no HUD** within eight seconds under software WebGL (figures floating over snow, only the Multiplayer pill and the `?`). Either the surface's HUD waits for the first frame or the intro was still up. Not a design finding; a note for the walker: the surface needs a longer settle, or the tour never points at it (it does not: the galaxy is a `cta`).

### The shell

17. **The tour offer and the achievement toast were not seen** (seeded off). They are in the code audit (`ui-shell-classic.md` section 3, "A notice in a corner": four styles). Nothing to add from the shots.

## What the kit's rows should be, measured from these shots

- Top row starts at the nav's bottom plus 16 px (about 92 px from the top at 1440 × 900) on every world already; keep it.
- Left column: eyebrow, title, objective; max width 540 px (Scranton's objective card is 510 px and reads well; Avengers' 545 px).
- Right column: minimap (150–200 px) then one Menu chip; the column's width is the Menu's.
- Foot: one prompt centred, its bottom 60 px up; one hint line above the thumbs; the guide's corner (right 16 px, bottom 16 px, 44 px) reserved on every world.
