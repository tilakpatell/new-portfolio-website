# Handoff: one house UI for the shell, the classic pages and the universe map (stream C)

Date: 2026-10-08. Spec: `docs/superpowers/specs/2026-10-07-audience-tours-and-ui-audit-design.md` (sections 5 and 8). Plan: `docs/superpowers/plans/2026-10-07-ui-shell-universe.md`. The findings, verified: `docs/research/2026-10-07-tours-and-ui-audit/ui-shell-universe-verified.md`. The rules, written down for the steward: `docs/health/RULES.md`, section "UI".

## How it was done

The two audits' 134 findings were unverified when this started. Each was checked twice before any code changed: once at its `file:line`, and once by a design check against `design-taste-frontend` and the house-look spec. 105 passed both; 29 were dropped, each with its reason in the verified list. The work acted only on the kept ones, and narrowed several fixes the design check judged too sweeping. Every slice was shot before and after (the seven classic pages in light, dark, Sith, phone and phone dark; the guide, the palette, the phone menu, the colour picker, the toast and the filters' dimmed states; the universe map on desktop and phone, with a ship and without) and compared by eye. Every slice also had an adversarial review of its diff (pixels, themes and dark mode, phones, behaviour, words) before its pull request. The review findings were all fixed in the same slice or the next one.

## What landed

| Pull request | Slice |
| --- | --- |
| #583 | Tokens (depth, time, type, shadows, edges, page top, measure), the house `.kbd`, `CopyButton`, `Bullets`, `CloseButton`, `icons.js`; the glossary (`src/lib/words.js`) and its test; the depth test. No pixel moved. |
| #595 | The shell on the kit and the glossary: one `.switch` (the view switch, the guide's tabs and its toggle), one close button, one `.notice` skin (the toast, the guide's note), the palette's key caps and a tappable Esc, the guide naming itself, colours not colors, one word per thing, 44 px targets on touch. |
| #610 | The classic pages: one page top and last-section rhythm, one title size where it fits, dimmed by colour not by fading, the eyebrow at the type floor, `.on-photo`, `.chip-sm`, button chips, `.link-hover`; plus #595's review fixes (the guide's head on a phone, the toast's theme skins, shadows in the dark). |
| #615 | The map's HUD: `hud.css` (one flat key cap, one sheet, one glass, one segmented control, one quiet link, the edge token, one warning amber) and `universe/words.js`; the panel's intro in one sentence; plain system text (Jump, Race, Fly past everything, Nav map, Universe view, All places, Join, Board, Start over, Stock paint); the prompt's key as a real cap, key first; the hints cut to the keys that matter; labels readable over the stars; the weapon readout on first use; the top-centre stack under the crew's line; the online notes above the corner's buttons. |
| #612 | `docs/health/RULES.md` "UI"; the `kbd-styles` metric (walks the CSS itself, leaves out `src/runtime/hud/hud.css`, unbudgeted per C1). |

## Decided differently from the plan, and why

- **Depth tokens name today's numbers.** D10 (re-order the layers) was dropped as deliberate, so the tokens carry exactly the old values. Nothing reorders.
- **No `<Layer>` component, no `<Notice side>` component.** D9's backdrops are each deliberate, so there is no shared `<Layer>`. D19 was narrowed to one `.notice` skin, with positions left as they were.
- **`.switch`, not `.seg`.** `.seg` is the Experience track switch and stays as it is (D2, narrowed). The pill-in-a-track control is `.switch`.
- **The HUD's key cap is flat (`.hud-kbd`).** The site's raised `.kbd` is for the light pages; on dark glass a flat cap reads better (F47, narrowed).
- **Three page titles keep their own size.** Projects' title would break into three lines beside the cartridges. Experience's is a company's name and must stay on one line. The résumé's wraps from 854 to 1378 px. Home's name and the Travel poster were exceptions from the start. Contact and Changes use `.display-1`.
- **The nav map's stylesheet is words only, as the brief says.** F53 (the pilots' colour on the chart) and F54 (the chart's ambers) are not done. They are style changes to the reference surface, and the owner's call.
- **"Super speed" keeps its name.** The glossary retires it, but nothing better has been agreed. Its verb is now "Race" ("Race to Marvel").
- **The Transformers' cut corners clip the toast's shadow**, as they clip every card's. The toast matches the cards on purpose.

## What is left

Done since the five slices, in the follow-ups pull request: L17 and F26 (the cockpit's Welcome: TPM first, "Skip the intro"), L18 ("Home" on the 404 and the error page), F19 (the HUD's distances in the nav map's measure), F35 (the landing line under the desktop keymap), F61 (a station sign's second line read with its label), the heritage zoom's duplicate focus ring, and `kbd-styles` budgeted at 68 now that the world kit's cap is the house one. The tour's copy is now under the words test too (stream B, #621).

- **Handed to other streams** (verified list, section 2):
  - S5 and M1: the tour card's padding and entrance, streams A/B.
  - L21: the world gate X's label, stream D.
  - The galaxy panel's "Plot a course" (stream D, `src/components/galaxy/`), which should read `universe/words.js`'s nav map name.
- **`kbd-styles`:** 68 rules, budgeted; the cockpit's (7) and the galaxy surface's (5) are the next to fold.
- **Not done, kept as findings:**
  - F42: full row tokens for the HUD's bottoms (the collisions are fixed with the existing calcs).
  - F34: the brief and the hint reading `guide/keys.js`, and the tour offer waiting for the flying brief, which is stream A's.
  - D16 and D18 in the worlds' stylesheets (`deathstar.css`, `music.css` and others): their focus rings and transitions restate the shell's; the shell's own are done.
  - F53 and the chart's ambers: the nav map's style, the owner's call.
  - An ally diamond on the nav map's chart (needs the scene to pass `ally` with the chart's pilots, and a mark in `navmap.css`).

## Where things are

- Tokens and the kit: `src/index.css` (`:root`; "The house kit" section), `src/components/ui.jsx`, `src/components/icons.js`.
- The glossary: `src/lib/words.js`, `src/components/universe/words.js`; the test `src/lib/words.test.js` (its `PENDING` list is empty; a file added to `FILES` with a retired word fails).
- The depth test: `src/styles/tokens.test.js`.
- The map's HUD kit: `src/components/universe/hud.css`, imported at the top of `universe.css`.
- The metric: `scripts/health/kbd-styles.mjs`, its fixture under `scripts/health/fixtures/tree/src`.
