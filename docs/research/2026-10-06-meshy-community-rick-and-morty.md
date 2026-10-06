# Meshy's community, for the Rick and Morty multiverse

Read 6 October 2026, before paying to generate the multiverse plan's figures
and vehicles (`docs/superpowers/plans/2026-10-06-rick-and-morty-multiverse.md`).
The question: does Meshy's community already have any of them, free?

**No.** Not one of the plan's assets has a community model that passes the
spec's accuracy gate, in this session's slice (Phase 2's people, Phase 6's
vehicles) or in Phase 1. Keep generating them. Nothing was downloaded.

## How it was looked at

- `node scripts/meshy-community.mjs search` ran 40 searches: one per asset
  in Phases 1, 2 and 6, each with the show's name and plainer words, plus a
  sweep of everything naming the show. It uses Meshy's public search (no
  key). A hit counts only if its prompt or tags have every word of the query.
- Each asset's hits went on a numbered contact sheet, beside the wiki's
  infobox image of the character
  (`lab/meshy/community/<name>/sheet.jpg`, `lab/meshy/refs/<name>/`, both
  gitignored).
- A judge per batch held every plausible hit, at full size, to the gate: the
  show's silhouette, colours, garments and face; the cel look; a riggable
  pose with no plinth; no text. A skeptic then tried to refute every pick
  graded exact or close.
- Every community hit is CC0, so licence was never the problem. Likeness
  was: the community is mostly generic Frankensteins, giraffes and
  locomotives, not the show's.

## By asset

“Best find” is the closest model the community has. A stand-in is the same
kind of thing, not the show's (the site's rule: never ship a miss).

| Asset | Best find | Triangles | Then |
| --- | --- | --- | --- |
| `spacebeth` | none | — | generate |
| `rickprime` | [close, refuted](https://www.meshy.ai/3d-models/rick-sanchez-t-pose-01a046cd-7070-717c-906f-16d8192297ef) | 1,356k | generate |
| `snuffles` | [stand-in](https://www.meshy.ai/3d-models/adorable-japanese-style-mascot-character-fluffy-white-dog-wi-0197c9b9-a21c-78d6-b29b-12d4a1e2bef1) | 290k | generate |
| `drwong` | none | — | generate |
| `nancy` | none | — | generate |
| `tricia` | none | — | generate |
| `diane` | none | — | generate |
| `pencilvester` | nothing like him | — | generate |
| `sleepygary` | none | — | generate |
| `hamurai` | none | — | generate |
| `amishcyborg` | none | — | generate |
| `mrbeauregard` | [stand-in](https://www.meshy.ai/3d-models/old-butler-stylized-cartoon-ultra-detailed-t-pose-01952de3-2c9c-75ee-90d3-d5b12795d862) | 90k | generate |
| `cousinnicky` | none | — | generate |
| `frankenstein` | [stand-in](https://www.meshy.ai/3d-models/frankenstein-019d71f0-374c-76d6-8f6a-175aea0969b9) | 561k | generate |
| `reversegiraffe` | [stand-in](https://www.meshy.ai/3d-models/a-quadrupedal-giraffe-in-a-cartoon-art-style-with-large-eyes-01964055-6011-71e1-93e3-4c4eca7a534e) | 163k | generate |
| `ghostinajar` | [stand-in](https://www.meshy.ai/3d-models/a-translucent-baby-ghost-floating-inside-a-cracked-glass-jar-0199dcb3-536c-74a6-b74f-3b1e6532ff41) | 1,444k | generate |
| `photographyraptor` | [stand-in](https://www.meshy.ai/3d-models/christmas2025-a-red-and-green-cartoon-velociraptor-wearing-s-019b51bc-29f1-7470-8e9b-327815373876) | 596k | generate |
| `tinkles` | none | — | generate |
| `babywizard` | nothing like him | — | generate |
| `mrsrefrigerator` | nothing like her | — | generate |
| `spacebeth-ship` | none | — | generate |
| `jerry-ship` | nothing like it | — | generate |
| `gotron-ferret` | nothing like it | — | generate |
| `gotron` | [stand-in](https://www.meshy.ai/3d-models/voltron-defender-of-the-universe-019f69d9-2708-7f08-9975-7d7d71f2c4c4) (Voltron's colours, not Gotron's) | 726k | generate |
| `zigerion-ship` | [stand-in](https://www.meshy.ai/3d-models/alien-spaceship-named-charybdis-asymmetrical-predatory-and-b-0197deb8-b6fe-7f2b-9750-1e621df1444e) | 10k | generate |
| `storytrain` | [stand-in](https://www.meshy.ai/3d-models/a-japenese-anime-steam-locomotive-019faa4b-33d3-7f89-89d4-037d6c8c55f4) (an engine, no carriages) | 1,618k | generate |
| `birdperson` | nothing like him | — | generate |
| `phoenixperson` | none | — | generate |
| `squanchy` | [stand-in](https://www.meshy.ai/3d-models/renux-squanchy-0199ce21-6332-73e6-97f9-ce4eb6536c86) | 414k | generate |
| `poopybutthole` | none | — | generate |
| `unity` | nothing like her | — | generate |
| `marsha` | none | — | generate |
| `mortyjr` | none | — | generate |
| `krombopulos` | none | — | generate |
| `zigerion` | none | — | generate |
| `gearperson` | nothing like them | — | generate |
| `gwendolyn` | nothing like her | — | generate |
| `squanchy-house` | nothing like it | — | generate |
| `birdperson-house` | nothing like it | — | generate |

## Worth knowing

- **Rick Prime.** The [T-posed “Rick Sanchez”](https://www.meshy.ai/3d-models/rick-sanchez-t-pose-01a046cd-7070-717c-906f-16d8192297ef)
  is Prime's costume to the stripe: the dark zip jacket with the high collar,
  the grey shoulder pad, the red stripe low on the front, the dark red shirt.
  It fails on the face, which is C-137's (wide eyes, open grimace) where
  Prime's are narrow and cold with a closed mouth. The skin is too white,
  too. It is a good second reference for `rickprime`'s concept image.
- **What the site already has wins.** The sweep's best Rick
  ([close](https://www.meshy.ai/3d-models/rick-sanchez-01a046c5-7f0d-7d66-97d9-01f8fce7c08d))
  stands with its arms down and doesn't beat the rigged HD `rick.glb`. The
  [portal gun](https://www.meshy.ai/3d-models/portal-gun-01983029-df9c-7545-84e8-952e8ead7b41)
  has the wrong grip and is no better than Bob.Ho's in the wardrobe. The
  [portal disc](https://www.meshy.ai/3d-models/rick-and-morty-portal-0198300a-d56f-7534-ac16-1593ee5e2bcc)
  is static, where the site's swirl is an animated shader. The
  [saucer](https://www.meshy.ai/3d-models/rick-and-morty-spaceship-0198303c-9960-755a-9c9e-ac853cb60e30)
  has an opaque dome and car tyres, not the cruiser's.
- **Running it again.** The community grows. Before a later phase pays, add
  its assets to `WANTED` in `scripts/meshy-community.mjs` (only Phases 1, 2
  and 6 are there), run `node scripts/meshy-community.mjs search phase<n>`
  and look at the sheets.
