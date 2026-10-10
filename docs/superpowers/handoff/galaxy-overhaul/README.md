# The galaxy overhaul: what the investigations found (7 October 2026)

The owner asked for five things in the Star Wars galaxy: no flicker coming in
from the universe map, no "invisible glue" near planets, a better war map with
a robust war AI and campaign length, varied battle objectives with better
battle AI, better models (Meshy allowed), and powers for each crew's ship.

Each JSON here is one investigation's structured report (summary, key files
with line numbers, root causes or design, proposals with tests, constraints,
open questions). The tracks were implemented from them, one branch each:

| Report | Track branch | Note |
| --- | --- | --- |
| (glue: done inline) | `claude/galaxy-war-overhaul` | `galaxy/space.js`: along-nose drive gap, planets from 15% over the surface, steady 16 u/s² |
| `find-flicker-findings.json`, `find-flicker-challenge.json` | `claude/gw-flicker` | the challenge is the skeptic's verified list: it wins where they differ |
| `find-warmap-findings.json` | `claude/gw-war` | strategic AI v2 rules, then the holotable |
| `find-battles-findings.json` | `claude/gw-battles` | fixed step, shared director, objective plans, AI, end card |
| `find-powers-findings.json` | `claude/gw-powers` | G and X crew powers; battle hooks after merging `claude/gw-battles` |
| `find-models-findings.json` | `claude/gw-models` | wiring and fit fixes, then Meshy remakes gated on renders |

While a track is being worked on, its uncommitted work is snapshotted to
`claude/gw-<track>-wip` every five minutes; the track branch is the real
history.

## Decisions taken on the open questions

The owner said to use judgement, so these were decided in the session:

- War: ends only in the Climax (last stand before step 330); a captured system
  comes in at 0.7 hold, a repelled attack restores +0.25; campaign results are
  display-only; player knee 0.3; Hutts violet; per-side orders with 6 h
  deadlines; the 72 h campaign stays; supply 0.5 and areaBonus 1 as coded.
- Battles: the AI's effect on objectives is the director's shared seeded
  curve; AI-only attacker wins 30-60% decided at 7:30-10:00, a solo pilot at
  about 4:30-7:30, 4+ pilots never before about 5:00; defender pilots get
  intercept credits; `tickets: false` in the galaxy; set pieces pinned at
  Endor, Scarif and Hoth; the universe map's `front.js` unchanged (opt-in).
- Powers: G (cooldown) and X (charged by kills) in flight; Chewie on the quad
  guns; Rick's portal and death ray; Force Focus slows battle fighters; the
  charge survives landing, resets on a crew change; PvE only.
- Models: CR90 remake galaxy-only; AI fighters on the gen3d `.lo` cut; ships
  fitted by length; at most 900 Meshy credits; every remake gated against the
  current model on a four-view sheet.
- Runtime (flicker): no world draws blurrier than today at level 0 (the
  runtime's ratio keeps the 1.25 minimum the renderer's fit gave 1x screens).
