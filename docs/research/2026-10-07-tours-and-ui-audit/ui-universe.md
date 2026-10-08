# UI audit: the universe map

Scope: the 3D site map at `/` and `/universe` (the HUD, the panel, the nav map, the hangar, the flight settings, multiplayer, the cockpit intro, the jumps, and the guide's and tour's words about it). Read-only; every claim carries a `path:line` from the repo at the time of reading. Line numbers are those printed by `cat -n`.

Files read in full: `src/components/universe/UniversePanel.jsx`, `UniverseMap.jsx`, `NavMap.jsx`, `navmap.css`, `Hangar.jsx`, `FlightSettings.jsx`, `Comms.jsx`, `Faces.jsx`, `MiniMap.jsx`, `StartChoice.jsx`, `stationCards.jsx`, `universe.css`, `phone.js`, `online/Online.jsx`, `online/Presence.jsx`, `online/online.css`, `online/names.js`, `cockpit/Cockpit.jsx`, `cockpit/Welcome.jsx`, `cockpit/cockpit.css`, `pages/Front.jsx`, `pages/Universe.jsx`, `Hyperspace.jsx`, `hyperspace3d/Hyperspace3D.jsx`, `jumps/*.jsx`, `tour/TourHost.jsx`, `tour/tour.css`, `tour/offer.css`, `guide/GuideCue.jsx`, `guide/GuideLink.jsx`, `guide/KeyTable.jsx`; the `/universe` entries of `guide/pages.js`, `tour/steps.js` and `tour/briefs.js`; the HUD-writing parts of `scene.js`, and the strings in `nav.js`, `universes.js`, `crews.js`, `weapons.js`, `landings/wayin.js`, `online/client.js`. (`shipyard/*.js` are pure data and rules; the only shipyard UI is the Build tab in `Hangar.jsx`, which is covered.)

## 1. Summary

The map is rich and the pieces are individually well made, but it has grown by accretion: the same idea is named many ways (eight names for the nav map, seven words for going fast, eight verbs for "open the page"), the same element is styled many ways (13 key-cap styles, 12 pill/toast styles, 9 panel surfaces, 9 icon-button sizes), and the HUD's positions are a set of magic numbers rather than rows, so items collide on phones (the way-in button on the on-foot hint; the multiplayer feed on the hangar button; the tour pill on the crew's line). A first-time visitor on a phone can have 11 buttons on ~390 px of map in their first minute, and three onboarding layers (the panel's text, the flight brief, the tour offer) telling the same thing in different words.

The nav map (`NavMap.jsx` + `navmap.css`) is the best-designed surface and should be the reference: one palette, one pill family, a kicker/title/meta hierarchy, keyboard hints at the foot, safe-area padding, the iOS zoom fix, reduced-motion handled. The comms line, the arrive title, the panel's key grid, the tucked bar and the Welcome card are the other references.

Counts: 63 findings (9 high, 24 medium, 30 low).

## 2. Inventory and layout map

### 2.1 Every on-screen element (desktop, ≥768 px, fine pointer)

Shell tokens: `--nav-h: 68px` (`src/index.css:56`; 76 px at a wider breakpoint, `index.css:65`), `--panel-w: min(400px, 100vw − 24px)` (`universe.css:52`), `--r-card` per theme (`index.css:32`).

| # | Element | File:line | Position & size | Font | Shows when |
|---|---|---|---|---|---|
| 1 | Panel `.universe-panel` | `UniversePanel.jsx:140,157,189,286`; `universe.css:132-149` | top nav+12, right 12; width `--panel-w`; max-height page−nav−24; padding 1.25rem; bg `rgb(6 8 16/.93)`; radius `--r-card`; scrolls | title 1.5rem/600 (`universe.css:201`); body `text-sm` | always (tucked: a 230×48 bar, `universe.css:62,197`) |
| 1a | Tuck button + guide `?` | `UniversePanel.jsx:90-99`; `universe.css:151-177` | top-right corner of the panel, 34 px circles | icon | panel open |
| 1b | "Open the nav map" | `UniversePanel.jsx:194` | `btn btn-ghost btn-sm` (36 px, `index.css:452`) | 0.875rem | no universe selected |
| 1c | Ship cards ×4 | `UniversePanel.jsx:25-45`; `universe.css:1050-1069` | full width, 38 px faces, radius 14 | name 0.95rem/600, crew 0.8rem muted | no ship, or "Change ship" |
| 1d | Key grid (KEYMAP) | `UniversePanel.jsx:48-57,232-243`; `universe.css:1021-1036` | 2 columns, margin-top 1.25rem | 0.8rem; kbd 0.68rem | ship picked, panel open |
| 1e | Fitted line + "Open the hangar" / "Change ship" | `UniversePanel.jsx:63-87` | — | 0.85rem; btn-sm | ship picked |
| 1f | Links row "The whole map" / "Nav map" + prev/next `globe-btn` + accent eyebrow + "Land on X →" primary + station/world card | `UniversePanel.jsx:288-316`; `extras.css:13-28` | — | `.universe-back` mono 0.72rem (`universe.css:202-212`); `.btn-primary` | a universe selected |
| 1g | Exits footer "Classic site" / "Back to the intro" | `UniversePanel.jsx:106-118`; `universe.css:221-233` | sticky at the panel's foot, safe-area padded | mono 0.72rem | always |
| 1h | Credits `<details>` | `UniversePanel.jsx:250-275`; `universe.css:1043-1047` | — | 0.7rem | no universe selected |
| 2 | Loading line "Charting the universe…" | `UniverseMap.jsx:202`; `universe.css:76-89` | centred in the open area | mono 0.78rem muted | until the scene draws |
| 3 | Planet labels `.universe-label` ×~13 | `UniverseMap.jsx:206-229`; `universe.css:104-130` | moved by the scene; pill 32 px; station labels hidden (`:128`) | mono 0.7rem, `--muted`; no shadow; bg only when pressed (`:124`) | scene on |
| 4 | Other pilots' callsigns `.universe-tag` | `UniverseMap.jsx:230`; `online.css:120-151` | over their ships; pill bg .6 | mono 0.66rem, `#ff9a85` (ally `#8dffad`) | online |
| 5 | Nav-map button (compass) | `UniverseMap.jsx:232-239`; `universe.css:1255-1273` | left 16 bottom 68 (no ship) / left 120 (ship); 44 px, radius 12; blue border | icon | scene on |
| 6 | Flight-settings button (sliders) | `FlightSettings.jsx:58-73`; `universe.css:1103-1120` | left 16 bottom 68; 44 px, radius 12 | icon | ship, not on foot |
| 7 | Hangar button (wrench) | `Hangar.jsx:130-143`; `universe.css:1235-1252` | left 68 bottom 68; 44 px | icon | ship, `onFit` |
| 8 | Multiplayer pill + feed + card | `Online.jsx:41-60`; `online.css:153-239` | left 16 bottom 16; pill 40 px; feed stacks upward; card 340 px, bg .96 | mono 0.74rem; notes 0.8rem | always (hidden while asking/leaving, `Universe.jsx:462`) |
| 9 | Tour offer "New here?" | `TourHost.jsx:135-144`; `offer.css:4-25` | left 16 bottom 128 (on the map); 330 px | 0.95/0.82rem | first arrival, 2.4 s after nothing covers the page |
| 10 | Steering ring `.universe-stick` | `UniverseMap.jsx:243`; `universe.css:286-310` | 84 px at the drag point | — | dragging |
| 11 | Height gauge `.universe-alt` | `UniverseMap.jsx:246`; `universe.css:313-343` | left 22, vertical centre, 14×150 | — | flying |
| 12 | Shields bar | `UniverseMap.jsx:249-254`; `universe.css:436-473` | left 16, centre+92; 92 px | label mono 0.6rem uppercase | trouble about |
| 13 | Weapon readout `.universe-arms` | `UniverseMap.jsx:276-287`; `universe.css:345-387` | left 16, centre+132; 150 px | name mono 0.66rem uppercase; keys 0.55rem | flying |
| 14 | Siege banner | `UniverseMap.jsx:288-291`; `universe.css:389-414`; text `scene.js:2449-2454` | centred, top nav+76; max 440 px | mono 0.66rem; `<b>` 0.6rem | near the Citadel |
| 15 | Targeting HUD (reticle, lock, lead, threats, nav diamond) | `UniverseMap.jsx:255-275`; `universe.css:515-680`; text `scene.js:2585-2642` | scene-placed | names mono 0.6rem uppercase, tracked 0.12em | flying |
| 16 | Prompt pill `.universe-prompt` | `UniverseMap.jsx:292`; `universe.css:796-830`; text `scene.js:4201-4237` | bottom 72, centred over the open area | 0.8rem sans; `G` cap via `::before` | a note, a door, a landable planet, the phone |
| 17 | Way-in button `.universe-wayin` | `UniverseMap.jsx:302-307`; `universe.css:833-873`; label `landings/wayin.js:29` | bottom 116, centred; 44 px min; accent border; infinite glow | sans 0.92rem/600 + kbd "Enter" | on foot by a world's door |
| 18 | Portal-gun pill | `UniverseMap.jsx:294-300`; `universe.css:914-959` | left 172 bottom 72; lime | 0.8rem/600 + kbd "P" | **any** ship, not on foot |
| 19 | First-flight hint `.universe-hint-fly` | `UniverseMap.jsx:376-384`; `universe.css:966-1004` | bottom 24, left 184 → right panel+36; max 760 px; bg .7 | 0.78rem/1.75 muted; kbd 0.72rem | until first launch; on desktop only when the panel is tucked or a card is shown (`:1002-1004`) |
| 19b | On-foot hint | `UniverseMap.jsx:367-375` | same box | same | 16 s after stepping out (`:140`) |
| 20 | Grand-tour pill `.universe-tour` | `Universe.jsx:450-459`; `universe.css:481-513` | top 92, centred on the **whole** width; blur | mono 12px | grand tour running |
| 21 | Comms line `.universe-comms` | `Comms.jsx:295-305`; `universe.css:1072-1099` | top nav+12, centred in the open area; max 560; face 44 px | who mono 0.68rem uppercase; said 0.92rem | a crew line |
| 22 | Arrive title | `UniverseMap.jsx:361-366`; `universe.css:875-908` | top 27 %, centred in the open area | clamp(1.6rem, 4vw, 2.8rem)/700 with shadow; sub mono 0.8rem | 6.5 s after landing |
| 23 | Flight-settings sheet | `FlightSettings.jsx:74-138`; `universe.css:1121-1227` | left 16 bottom 122; 312 px; bg .93 radius 14 | h2 0.95rem; names 0.82; hints 0.72 | O / button |
| 24 | Hangar sheet (+ Build tab = shipyard) | `Hangar.jsx:144-357`; `universe.css:1274-1406` | same place; 372 px; bg .94 | h2 0.95rem; parts 0.82/0.72; costs 0.68 mono | H / button |
| 25 | Nav map dialog | `NavMap.jsx:212-523`; `navmap.css:5-312` | fixed, z 90; frame 1220×880 max; chart + 320 px side | kicker 0.64 mono uppercase; title 1.35rem; list 0.8rem; stats dt 0.58rem | M / buttons |
| 26 | Start choice dialog | `StartChoice.jsx:11-36`; `universe.css:1475-1499` | centred card 520 px, blur 14 | title clamp(1.4rem,3vw,1.8rem) | first arrival at `/` |
| 27 | Beyond screen ("Through the Maw") | `Universe.jsx:513-525`; `universe.css:249-283` | centred, mono green | 0.72 kicker; 0.95 text | falling into the black hole |
| 28 | Fade overlay | `Universe.jsx:503`; `universe.css:243-247` | full | — | leaving |
| 29 | Thumb cluster (Boost 76, Fire 64, View 54, Ship/Phone 54, Weapon 54, Nose up/down 56×46) | `UniverseMap.jsx:308-358`; `universe.css:684-794` | right panel+36/124/204/270, bottoms 24/30/36/40; weapon bottom 104; climbs bottom 112 | mono 0.72/0.7/0.62/0.62/0.58rem | `display:none`; shown on `pointer: coarse` (`:1005-1017`) |
| 30 | Cockpit intro (own HUD) | `Cockpit.jsx:285-359`; `cockpit.css:121-289` | fixed z 95; top row, line, bottom row | eyebrow 0.68 mono; name clamp; chips 0.85; go 1.05/700 | first visit / replay |
| 31 | Welcome card | `Welcome.jsx:47-99`; `cockpit.css:294-348` | fixed z 96; 600 px | title clamp(1.55rem,3.6vw,2.2rem) | first visit |

Nothing in `Hyperspace.jsx`, `hyperspace3d/`, or `jumps/*.jsx` draws text: they are canvases on `.hyperspace-canvas` (`extras.css:570`). `phone.js` is a 3D prop; its only UI is the "Phone" thumb button (#29) and the prompt "Unlock the phone" (`scene.js:4227`).

### 2.2 Desktop layout map (1440×900, panel open, ship picked)

```
┌──────────────────────────────────────── nav (68) ─────────────────────────────────────────┐
│ [comms line: face · NAME · "line"  (top 80, centred in open area, ≤560w)]  │ ┌─ panel ─┐ │
│ [grand-tour pill top 92, centred on WHOLE width → overlaps comms]           │ │ ? ▣     │ │
│ [siege banner top 144, centred in open area]                                │ │THE UNIV │ │
│                                                                             │ │My whole │ │
│                 [arrive title top 27%]                                      │ │site…    │ │
│ ╎alt                                                                        │ │You're   │ │
│ ╎gauge   (labels on planets, 0.7rem mono muted, no scrim)                   │ │flying…  │ │
│ ╎(22,c)                                                                     │ │[paint]  │ │
│ ▭shields (16, c+92)                                                         │ │Open the │ │
│ ▭arms    (16, c+132)                                                        │ │hangar   │ │
│                                                                             │ │W S Thr  │ │
│                     [way-in  bottom 116]                                    │ │A D Roll │ │
│                     [prompt  bottom 72]                                     │ │…        │ │
│ [tour offer 128]                                                            │ │Credits  │ │
│ [⚙][🔧][◎][Portal P]   [hint bottom 24, left 184 → right panel+36]           │ ├─────────┤ │
│  16  68 120 172 (bottom 68 / 72)                                            │ │Classic  │ │
│ [● 3 pilots online  bottom 16] ← feed stacks UP into the buttons above      │ │Intro    │ │
└─────────────────────────────────────────────────────────────────────────────┴─┴─────────┴─┘
```

Eleven HUD items share the bottom-left 200×130 px; the three top-centre items (comms, tour pill, siege) share one slot with no stacking rule.

### 2.3 Phone layout map (390×844, sheet open at 38svh ≈ 320 px, ship picked)

```
┌──────────────── nav (68) ────────────────┐
│ [tour offer  top nav+8]  (offer.css:27)   │
│ [comms line  top nav+12, 16→16]           │
│ [arrive      top nav+24]                  │
│ ╎alt (12)                                 │
│                        [Portal ●  r26, s+232] │
│ ▭shield (10, s+160) [hint 12→90, s+160]   │  ← same bottom edge
│ ▭arms   (10, s+120) [way-in  s+156 ctr]   │  ← overlaps the hint on foot
│                      [Weapon  r110, s+96]  [▲ r26, s+104]
│                      [prompt  s+64 ctr]    [▼]
│ [◎][🔧]  (12/62, s+66)   [Ship r248][View r184][Fire r104][Boost r16] (s+16…27)
│ [● 3]    (12, s+12)                       │
├────────────── sheet 38svh ────────────────┤
│ THE UNIVERSE                       ? ▣    │
│ My whole site, as a universe              │
│ [Open the nav map]                        │
│ The stations round the sun are my pages…  │
│ [ship card] [ship card] … (scrolls)       │
└───────────────────────────────────────────┘
```

s = `--sheet-h`. Twelve different sheet-relative bottoms (+12, +16, +22, +27, +64, +66, +96, +104, +120, +156, +160, +232: `universe.css:1421-1453`, `online.css:310`) and 11 buttons in the ~390 px between nav and sheet.

## 3. How many styles for the same thing

Counted across `universe.css`, `navmap.css`, `online.css` (grep of declarations):

| Thing | Count | Could be |
|---|---|---|
| Panel/sheet surfaces | 9: panel .93/`--r-card` (`universe.css:148`), settings .93/14 (`:1135`), hangar .94/14 (`:1289`), online card .96/`--r-card` (`online.css:237`), navmap frame .97/18 (`navmap.css:25`), navmap side .72/12 (`:205`), start card .9+blur (`universe.css:1489`), tour card `var(--surface)` (`tour.css:14`), welcome .84+blur (`cockpit.css:311`) | 2: `hud-sheet` (0.93, 14 px, engine-tinted border) and `hud-dialog` (0.96, `--r-card`) |
| Pills / toasts / banners | 12: prompt (`universe.css:796`), hint (`:966`), tour pill (`:481`), siege (`:389`), online note (`online.css:214`), comms line (`universe.css:1082`), way-in (`:833`), portal gun (`:914`), tag (`online.css:120`), navmap note (`navmap.css:233`), hangar dropped (`universe.css:1381`), arrive (`:875`) — 7 radii (999/16/14/12/10/8/none), 8 alphas (.6–.9), 3 type families | 3 roles: `hud-chip` (status, mono), `hud-toast` (a sentence, sans), `hud-cta` (the way-in) |
| Key caps `<kbd>` | 13: keymap (`universe.css:1025`), hint (`:985`), prompt `::before` (`:813`), way-in (`:861`), portal gun (`:937`), arms (`:387`, 0.55rem, radius 3), tour pill (`:510`, **no border**), navmap (`navmap.css:264`), guide (`extras.css:989`), guide cue (`:1012`), cockpit chip (`cockpit.css:207`), cockpit go (`:233`), welcome (`:329`), palette (`extras.css:299`) | 1: `.guide-kbd` promoted to a global `.kbd` |
| Icon-button sizes | 9: 32/8 (`universe.css:1144`), 32/round (`online.css:242`), 34/round (`universe.css:160`), 36/round (`navmap.css:38`), 36/`--r-btn` (`extras.css:13`), 44/12 (`universe.css:1110,1242,1262`), 56×46/14 (`:695`), 54/round (`:758,780,422`), 56/round (`:962`), 64 (`:736`), 76 (`:715`) | 3: 44/12 for icon buttons, 32/round for close, 56–76 round for thumb actions |
| Small text links | 5: `.universe-back` mono muted (`universe.css:202`), `.navmap-back` sans blue (`navmap.css:235`), `.navmap-copy` mono blue 12px (`:59`), `.universe-online-link` mono underlined (`online.css:265`), `.universe-settings-reset` sans underlined (`universe.css:1226`) | 1 |
| Segmented controls | 3 identical: `.universe-seg` (`universe.css:1221-1225`), `.universe-hangar-slots` (`:1310-1316`), `.universe-yard-hull` (`:1361-1364`) | 1 |
| Font sizes | 30 distinct; 15 of them under 0.8rem; 5 under 0.65rem (0.55, 0.58, 0.6, 0.62, 0.64) | ~8 steps |
| Border radii | 18 distinct values | 4 (round, 999, 12/14, `--r-card`) + 4/6 for caps |
| Dark background alphas | 24 distinct `rgb(dark / a)` values | 4 (.55 buttons, .72 chips, .85 toasts, .93 sheets) |
| Accent colours on one screen | 4 systems: `--engine` per ship (`universe.css:681-683`), speaker colour (`Comms.jsx:297`), the selected universe (`Universe.jsx:412`), nav-map blue `#9fd8ff` | keep 4 but write the rule down (see F52) |
| Ambers | 6: `#ffb347`, `#ffb35c`, `#ffcf7a`, `#ffd3a1`, `#ffdca0`, `#ffd9a0` | 1 `--hud-warn` |

## 4. Language

### 4.1 One concept, many names (the big ones)

**The nav map** — "Nav map" (`UniversePanel.jsx:165,294`; `UniverseMap.jsx:232`), "Open the nav map" (`UniversePanel.jsx:195`), "Nav computer · the whole site" (`NavMap.jsx:217`), aria group "Chart" (`:223`), views "Universe / Home system / The Curve" (`nav.js:363-365`), "3D view" to close it (`NavMap.jsx:232`), "Back to the main map" (`:405`), "Out to the whole universe" (`:399`), "The whole map" (`UniversePanel.jsx:161,290`), "Charting the universe…" (`UniverseMap.jsx:203`), "the nav computer stops you" (`nav.js:76`), "the galaxy map" next door (`pages.js:122`).

**Going fast** — "Boost" (`UniverseMap.jsx:357`), "the pulse drive" (`nav.js:44,51`, `speedWord` `:394`, `pages.js:109`, `briefs.js:58`), "Super speed" / "At super speed" / "3×" (`nav.js:41-42`, `:395`, `NavMap.jsx:442`), "Hyperspeed" (`nav.js:34`), "Jump" (`:35`, `NavMap.jsx:442,516`, `pages.js:94`), "jumping to" (`NavMap.jsx:419`), "Hyperdrive: charged" (`:422`), "lightspeed" (`nav.js:37`, `crews.js:548-549`), "Jump to a galaxy far, far away" for the Star Wars planet's button (`universes.js:117`). A first-timer meets seven words for three speeds.

**Going into a page** — "Dock at" / "Land on" / "Land at" / "Jump to" / "Go to" (`UniversePanel.jsx:310`; `universes.js:117,282,402`), "Fly here" (`UniversePanel.jsx:175`), "Go in" / "Skip the trip: straight in" / "Jump straight to X" / "Through the gate to X" (`NavMap.jsx:477,195`), "Show me X" (`:193`), "Enter Albuquerque" (`wayin.js:29`), "Into Dunder Mifflin" (`scene.js:4218`), "Enter to go into the world" / "Enter into the world" (`UniverseMap.jsx:373,370`), "Land or dock where you are" (`pages.js:94`), "Into the planet's page" (`briefs.js:66`).

**Station / page / world / planet / place / fandom** — kinds "Everywhere / Stations / Worlds / Wonders / Star systems" (`nav.js:175-180`); the empty state "Try a fandom (Marvel), a page (Projects) or a kind of thing (nebula)" (`NavMap.jsx:511`) uses two other nouns for the same two kinds; "the stations round the sun are my pages… the planets further out are the things I love" (`UniversePanel.jsx:201`); "a station is a page, a planet is a world" (`steps.js:79`); the prompt says "land on {planet}" (`scene.js:4224`).

**Tour** — the nav map's "Tour" button (`NavMap.jsx:237`, title "The grand tour: every station, world and wonder…"), the pill "Touring, 2 of 31: next Aurelia" (`Universe.jsx:453`), the guide "Tour visits every place" (`pages.js:109`) — versus the site tour "Take the tour" (`TourHost.jsx:136`), "A quick look round" (`steps.js:48`), and the first-flight brief (`briefs.js:32-83`), which is a third kind of tour the visitor isn't told the name of.

**The same orientation sentence, five ways** — `UniversePanel.jsx:201` ("The stations round the sun are my pages: home, experience, projects, résumé, contact and the terminal. The planets further out are the things I love."), `steps.js:62` ("…my pages: experience, projects, résumé and contact. The planets further out are worlds I love"), `briefs.js:36` ("…the site's pages; the planets out in deep space are its worlds"), `pages.js:92` ("the stations round the sun are its pages, the planets in deep space its worlds"), `StartChoice.jsx:161` ("fly a ship to my experience, projects and résumé, and to the worlds I love").

**"Pick a ship", five ways** — `UniversePanel.jsx:179` "Pick a ship below the map to fly out to it" (on desktop the ships are beside the map, and not in this panel state at all), `NavMap.jsx:193` "Pick a ship to fly out to it", `:428` "Pick a ship in the panel to fly yourself, anywhere, by any drive", `:391` "Pick a ship to fly to the front", `Online.jsx:167` "Pick a ship in the panel to fly with them; till then you're watching".

**Interdiction, three ways** — `scene.js:1583` "Interdicted: no jump till the hunters are gone"; `NavMap.jsx:36` "Interdicted: hunters are holding the drive down"; `:448` "held down by hunters".

### 4.2 Crew lines versus system text

The crews' lines are in character and fine as they are (`crews.js:139-143`, `:547-549`, `:902-905`, `:1274-1276`, `:1598-1601`, `:1963-1965`, `:2278-2281`, `:2699-2701`): "lightspeed", "a shortcut through a dimension", "turned into crystal". The problem is only that the **system** text borrows the fiction's words ("hyperdrive", "pulse drive", "interdicted", "heavy ordnance", "the Curve") in the places that should be plain: the drive picker, the status line, the siege banner. The comms box already separates the two registers visually (face + name); the system text should stay plain and let the crews be colourful.

### 4.3 Capitalisation and punctuation

Mostly consistent sentence case. Drifts: "Nav map" (Title) versus "nav computer" (kicker, `NavMap.jsx:217`); feed lines have no full stop (`client.js:140-355`) while hangar notes do ("Locked. {hint}.", `Hangar.jsx:94,123`) and the same panel mixes "Or pick a place by name, and the camera takes you there." (`UniversePanel.jsx:216`, full stop) with "This link opens the map right here: share it." (`:181`); the siege banner joins clauses with " · " (`scene.js:2452-2454`) where the nav map uses ", " (`NavMap.jsx:419`); the tour pill uses ", … : " (`Universe.jsx:453`); "Asked…" with an ellipsis as a button label (`Online.jsx:219`); the drive-time cell shows a verb, a multiplier or a time in the same slot ("Jump" / "3×" / "8 s", `NavMap.jsx:442`).

### 4.4 Too long for where it shows

- The desktop first-flight hint: ~45 words and 13 key caps in one line at 0.78rem muted (`UniverseMap.jsx:379`; `universe.css:980`). The on-foot hint: ~60 words and 13 caps (`:370`).
- The panel's intro paragraph is 40 words in a 400 px panel (`UniversePanel.jsx:201`), then four ship cards, then a second paragraph (`:216`).
- The nav map "Tour" tooltip is a 20-word sentence (`NavMap.jsx:236`); tooltips don't show on touch.
- The Join card's fine print is two 20-word sentences at 0.72rem (`Online.jsx:106-109`).
- The siege line "Shield up · 4 of 4 generators running · knock them out" at 0.66rem (`scene.js:2453`).

### 4.5 Jargon a first-timer can't parse

"pulse drive", "hyperdrive", "interdicted", "heavy ordnance only (3)" (`scene.js:2454`), "the Curve" / "The Central Finite Curve" (`nav.js:365`; `layout.js:46`), "C-137" (`nav.js:125`), "ship-lengths" (`nav.js:355`), "MW" and "t" (`Hangar.jsx:172`), "Garage build", "seed", "GB-021301.k3" (`Hangar.jsx:105`), "callsign", "public Nostr relays" (`Online.jsx:107`), "the front" (`NavMap.jsx:392`), "Holding still" as a speed (`nav.js:393`), "wonders" and "stations" with no gloss on the chips (`nav.js:175-180`).

## 5. Readability against the 3D backdrop

- **Planet labels** have no shadow and no scrim unless pressed: 0.7rem mono in `--muted` (`#9aa0a9` in dark, `index.css:242`) over nebulae and lit planets (`universe.css:104-124`). The nav map's `.navmap-name` has a double text-shadow (`navmap.css:176`); the arms name, lock names and arrive title have shadows (`universe.css:363,604,893`). The labels are the one text layer that doesn't, and the most-read one.
- **Sub-10 px text**: lock/nav names 0.6rem → 0.55rem on phones (`universe.css:599,1436`); arms keys 0.55rem (`:386`); shield label 0.6rem (`:450`); siege `<b>` 0.6rem (`:410`); the Weapon button's own label 0.58rem (`:430`), View/Ship 0.62rem (`:766,788`); navmap stats `dt` 0.58rem (`navmap.css:240`), home-system label 0.6rem (`:177`), place names 0.6rem on phones (`:286`); minimap 0.58rem on phones (`universe.css:35`). All uppercase and tracked, which makes small worse.
- **Scrims**: the hint is `--muted` on a 0.7-alpha box (`universe.css:978-980`); fine on black, weak over a bright planet. The prompt is 0.72 (`:804`), the thumb buttons 0.55 (`:720,741`). The comms line (0.9), panel (0.93) and sheets (0.93–0.96) are fine.
- **Competition on first arrival** (desktop, from the cockpit): the comms launch line, the brief's cards (`UniverseMap.jsx:130` → `briefs.js:32`), the panel's "You're flying…" + key grid + fitted line, the online pill, the tour offer 2.4 s later (`TourHost.jsx:101-113`), three icon buttons plus the lime portal-gun pill, the alt gauge, the arms readout and ~13 labels. On a phone, 11 buttons on ~390 px of map (§2.3).
- **The first 10 seconds** do tell the visitor what to do, but in three voices: the start choice (clear: `StartChoice.jsx:158-174`), then the panel paragraph, then the brief. The map itself gives no single cue; the "Land on X →" primary only appears once a place is selected, and on desktop the landing hint is hidden while the panel is open (`universe.css:1002-1004`).

## 6. Spacing

- **Edge gutters** in use: 10 (`universe.css:1425,1440`), 12 (`:135-136,1448`), 16 (`:1106,1259`, `online.css:156`), 22 (`universe.css:314`), 26 (`:962,1437`), 184 (`:970`). Two tokens would do.
- **Vertical rhythm of the HUD**: desktop bottoms 16, 24, 30, 36, 40, 68, 72, 104, 112, 116, 122 (`universe.css:712,735,757,779,1107,799,420,688,836,1125`); phone sheet-relative +12, +16, +22, +27, +64, +66, +96, +104, +120, +156, +160, +232 (`:1421-1453`, `online.css:310`). There is no row model, so every new item picks a new number and two of them collide (F33–F35).
- **Top slot**: comms at nav+12 (`universe.css:1075`), tour pill at a fixed 92 (`:484`), siege at nav+76 (`:392`), arrive at 27 % (`:878`). With a 76 px nav the pill is 16 px under it; with 68 px it is 24.
- **Panel rhythm** mixes Tailwind `mt-3`/`mt-4` (`UniversePanel.jsx:173,175,194,200,221`) with CSS 1rem (`universe.css:1050`), 1.25rem (`:1021,1043`), 0.6rem, and a negative-margin hack on `.universe-back` (`:207`).
- **Nav map gaps**: 0.3, 0.35, 0.4, 0.45, 0.5, 0.6, 0.65, 0.75, 0.9, 1rem (`navmap.css:19,73,102,199,212,234,245,250`).
- **Safe areas**: handled on the nav map (`navmap.css:11`), the floating multiplayer pill (`online.css:170-171`), the tour offer (`offer.css:7`), the panel's exits (`universe.css:229`), the tucked bar (`:1457`), the cockpit (`cockpit.css:126`) and the welcome (`:301`). Not handled: the left column of buttons (`universe.css:1106,1239,1259,1448-1452`), the on-map multiplayer pill (`online.css:310`), the right thumb cluster (`universe.css:1421-1428`), the prompt and way-in (`:1429,1432`). In landscape on a notched phone the nav-map button sits under the notch.

## 7. Prompts and affordances

- **Key hints are shown 13 ways** (§3) and the same key is spelt differently: the panel grid shows `←` `→` `↑` `↓` as four caps (`UniversePanel.jsx:51`); the hint says "arrows to steer" in words (`UniverseMap.jsx:379`); the brief says "← ↑ ↓ →  Steer the nose" (`briefs.js:42`); the guide splits "← → Swing the nose" and "↑ ↓ Nose up and down" (`pages.js:14-15`). Boost is "Space" in the grid (`UniversePanel.jsx:52`), "Space / Shift" in the guide and brief (`pages.js:16`; `briefs.js:43`). The grid lacks O, J, E, G, Esc and Shift that the hint and guide have.
- **The G key is CSS**: the prompt's cap is `content: 'G'` (`universe.css:814`), so it is neither in the `aria-live` text nor shown on touch (`:826`), and when the scene puts an NPC's speech in the same element (`scene.js:4219-4221`, `data-say`) the "prompt" is a quotation in italics (`universe.css:830`).
- **Same action, different words**: open the nav map = "Nav map" / "Open the nav map" / compass icon with title "Nav map (M)"; close it = "Close the nav map" / "3D view" / Esc / M; the hangar = "Open the hangar" / wrench icon "Hangar: paint and parts (H)" / "the wrench is the hangar" (`UniversePanel.jsx:244`) / guide "Wrench" (`pages.js:105`); settings = sliders icon "Flight settings (O)" / guide "Sliders: How it all feels"; stop = "Stop Esc" (`Universe.jsx:456`) / "Escape stops it" (`NavMap.jsx:236`) / "Esc ends it" (`steps.js:49`) / "Esc gets you out of most things" (`briefs.js:16`); leave = "Classic site" / "Back to the intro" (`UniversePanel.jsx:111,115`) / "Skip to the site" (`Welcome.jsx:89`) / "Go to the home page" (`StartChoice.jsx:168`) / "Universe | Classic" (`ViewSwitch.jsx:60`).
- **Three affordances for "go into the page"**: the panel's primary "Land on X →" (`UniversePanel.jsx:309`), the pulsing way-in "Enter X [Enter]" (`UniverseMap.jsx:302`), and the prompt "Into X" with a G cap (`scene.js:4218`).
- **Icon-only buttons on touch**: nav map, settings, hangar carry only `title`/`aria-label` (`UniverseMap.jsx:232`; `FlightSettings.jsx:64-65`; `Hangar.jsx:136-137`); the touch paragraph names one of them ("the wrench", `UniversePanel.jsx:244`).

## 8. What is good, and should be the reference

- **The nav map** (`NavMap.jsx`, `navmap.css`): one palette (`rgb(159 216 255)` at five alphas), one pill family (30/32/34 px, `navmap.css:47-57,74-82,86-97`), kicker → title → meta hierarchy (`:32-33,209-210`), drives as a proper `radiogroup` with `aria-checked` (`NavMap.jsx:434-439`), `aria-current="location"` for "you are here" (`:377`), keyboard hints at the foot (`:515-517`), safe-area padding (`navmap.css:11`), the iOS 16 px input rule (`:280`), responsive collapse that hides the right things (`:266-290`), reduced motion (`:294-298`), Escape and focus return (`NavMap.jsx:107-124`). Its text-shadow on names (`:176`) is what the planet labels need.
- **The comms line** (`Comms.jsx:295-305`; `universe.css:1082-1099`): face + uppercase name + line, border in the speaker's colour, `aria-live`, no blur. The model for "someone is speaking".
- **The arrive title** (`universe.css:885-902`): big, shadowed, timed; the one thing that reads at a glance.
- **The panel's key grid** (`UniversePanel.jsx:232-243`; `universe.css:1021-1036`): two columns, one cap style, short verbs. Make it the only cap style.
- **The tucked bar** (`UniversePanel.jsx:138-151`; `universe.css:169-200`): one element that resizes, named, with a plain "Show the panel".
- **The sticky exits** (`universe.css:221-233`): always reachable, safe-area padded, one style.
- **The Welcome card** (`Welcome.jsx:47-99`): the clearest copy on the site: a title that says what this is, three beats, a key row, two buttons, a credits line. The start choice (`StartChoice.jsx`) is nearly as good.
- **The hangar's note line** (`Hangar.jsx:326-335`; `universe.css:1390` `min-height: 2.6em`): one voice ("Locked. {hint}."), a reserved height so the sheet doesn't jump.
- **Thumb buttons** (`universe.css:684-794`): 54–76 px, `touch-action: none`, no selection, no context menu, pointer-cancel handled (`UniverseMap.jsx:336-358`).
- **No blur over the live map**, stated and followed in three places (`universe.css:146-147,1091`; `online.css:183`) — except the two in F51.
- **`prefers-reduced-motion`** handled throughout (`universe.css:541-543,873,909-911,1462-1472`; `navmap.css:294-298,310-312`; `online.css:357-361`).

## 9. Findings

Severity: high = a collision, a misleading word, or something a first-timer can't get past; medium = a real inconsistency or a strain; low = polish.

### Language

**F01 · high · language** — The nav map has eight names (see §4.1). `UniversePanel.jsx:165,195,290`; `NavMap.jsx:217,223,232,399,405`; `nav.js:363-365`; `UniverseMap.jsx:203`. Fix: "nav map" for the dialog everywhere (button, link, key hint, kicker "Nav map · everywhere there is to go"); "the map" for the 3D scene; the chart views "Whole map / Home system / The Curve"; "3D view" → "Back to the map"; "Out to the whole universe" → "Whole map".

**F02 · high · language** — Seven words for three speeds (§4.1). `nav.js:34-51,390-396`; `NavMap.jsx:416-422,442,448`; `scene.js:1583`; `pages.js:109`; `briefs.js:58`. Fix: Boost (the key), Cruise, Super speed, Jump (the three drives); "the hyperdrive" only as the device that charges; drop "hyperspeed" and "pulse drive" from system text (the crews keep "lightspeed").

**F03 · high · language** — Eight verbs for "open this page" (§4.1). `UniversePanel.jsx:175,310`; `universes.js:117,282,402`; `NavMap.jsx:193-197,477`; `wayin.js:29`; `scene.js:4218`; `UniverseMap.jsx:370,373`; `pages.js:94`; `briefs.js:66`. Fix: the panel says "Land on X" (ship) / "Go to X" (camera); the HUD button, the prompt, the guide and the brief all say "Enter X"; the nav map's shortcut says "Go straight in".

**F04 · medium · language** — Interdiction is worded three ways. `scene.js:1583` "Interdicted: no jump till the hunters are gone"; `NavMap.jsx:36` "Interdicted: hunters are holding the drive down"; `:448` "held down by hunters". Fix: one constant in `nav.js`, plain: "Hunters are jamming the jump. Shake them off first."

**F05 · medium · language** — Two features called "tour" on one screen. `NavMap.jsx:236-237` "Tour"; `Universe.jsx:453` "Touring, 2 of 31: next Aurelia"; `pages.js:109`; versus `TourHost.jsx:136` "Take the tour", `steps.js:48`. Fix: "Grand tour" for the flight (button, pill "Grand tour · 2 of 31 · next: Aurelia", guide); "the tour" for the site tour; the brief gets a name in its first card ("Your first flight").

**F06 · medium · language** — Station / page / world / planet / fandom. `nav.js:175-180`; `NavMap.jsx:511` "Try a fandom (Marvel), a page (Projects) or a kind of thing (nebula)"; `UniversePanel.jsx:201`; `steps.js:79`; `scene.js:4224`. Fix: two public nouns, "station" (a page) and "world" (a planet); the empty state becomes "Try a world (Marvel), a station (Projects) or a kind of thing (nebula)"; "Everywhere" → "Everything".

**F07 · medium · duplication** — The orientation sentence is written five ways (§4.1). `UniversePanel.jsx:201`; `steps.js:62`; `briefs.js:36`; `pages.js:92`; `StartChoice.jsx:161`. Fix: one sentence in one constant (e.g. `universes.js` `ABOUT`), imported by all five.

**F08 · medium · language** — "Pick a ship…" five ways, one of them wrong. `UniversePanel.jsx:179` "Pick a ship below the map to fly out to it" (desktop: the ships are beside the map and not in this panel state); `NavMap.jsx:193,391,428`; `Online.jsx:167`. Fix: "Pick a ship to fly there." everywhere; on the wonder panel, a "Pick a ship" button that opens the ship list.

**F09 · medium · language** — "Super speed" is used as a verb: `NavMap.jsx:196-197` with `verb: 'Super speed'` (`nav.js:42`) renders "Super speed to Marvel" and "Super speed through the portal to Gazorpazorp". Fix: `verb: 'Race'` ("Race to Marvel"); keep the noun for the drive.

**F10 · low · language** — The drive-time cell shows three unlike placeholders "Jump" / "3×" / "1×" (`NavMap.jsx:442`), then "8 s" / "—". Fix: "—" until a place is picked; or a consistent descriptor ("instant" / "3× cruise" / "1×").

**F11 · medium · language** — "Every place" is both the back button (`NavMap.jsx:453`) and the list heading (`:488`). Fix: back button "← All places"; heading "Every place" or "31 places".

**F12 · low · language** — "No ship, just look around" is a button that puts the ship away but reads as a state (`UniversePanel.jsx:213`). Fix: "Put the ship away (look around with the camera)".

**F13 · low · language** — "Back to how it came" (`FlightSettings.jsx:136`) and "The {ship} as it came" (`Hangar.jsx:257`). Fix: "Reset to defaults"; "Stock: the ship as built".

**F14 · medium · language** — Touch buttons are single nouns used as verbs: "Ship" (get back in, `UniverseMap.jsx:323`), "Phone" (`:328`), "Weapon" (next weapon, `:333`), "Switch" (play the other crew member, `:314`), "View" (cockpit, `:318`); the hint then has to gloss them ("Switch to play the other one, Ship to get back in", `:373`). Fix: "Board", "Pick up", "Next gun", "Swap", "Cockpit"; the hint and guide use the same words.

**F15 · high · language** — The multiplayer pill reads "Online" while you are offline on a phone: `Online.jsx:31` `short = !on ? 'Online' : …`; the Join card is titled "Multiplayer" (`:87`) and the roster "Online" (`:127`). Fix: short label an icon with "Off" (or "Play"); one title "Multiplayer" for both cards; pill when on: "3 pilots".

**F16 · low · language** — "No" for decline (`Online.jsx:228`), "End" for leaving an alliance (`:234`), "Asked…" as a label (`:219`). Fix: "Decline", "Leave", "Asked (cancel)".

**F17 · medium · language** — The first-flight hint is ~45 words with 13 caps on one line (`UniverseMap.jsx:379`); the on-foot one ~60 words with 13 caps (`:370`); both 0.78rem muted (`universe.css:980`). Fix: three facts each (steer, boost, land / walk, fire, back in) and "? all the controls"; the rest lives in the brief and guide.

**F18 · low · language** — The siege banner says "heavy ordnance only (3)" (`scene.js:2454`) with no gloss. Fix: use the ship's own weapon name from `weapons.js:30-33` ("missiles only (3)").

**F19 · low · consistency** — Distances: the HUD prints raw map units with no unit (`scene.js:2543` `range`, used at `:2586,2642`), the nav map prints "4,600 ship-lengths" (`nav.js:347-355`) for the same gap. Fix: one unit, one formatter; on the HUD a short form ("4.6k").

**F20 · medium · consistency** — Two keys for "go in": the way-in button shows "Enter" (`wayin.js:13`; `UniverseMap.jsx:304-306`), the prompt shows "G" (`universe.css:814`) for doors and the ship, and the guide says "E / Enter: Land or dock" (`pages.js:94`) while on foot "G: Through a door, or back into the ship" (`:95`). Fix: Enter = go into the page, G = in/out of the ship and doors, said that way in the grid, hint, guide and brief.

**F21 · low · consistency** — "Factory paint, nothing bolted on" (`UniversePanel.jsx:71-72`) versus the hangar's "Stock" (`Hangar.jsx:194,350`). Fix: "Stock paint, stock parts".

**F22 · low · language** — The hangar's "Build" tab (`Hangar.jsx:30`) is "the shipyard" in comments and "Garage build" on its switch (`:197`). Fix: tab "Shipyard"; switch "Stock / Your build".

**F23 · low · consistency** — Key hints in tooltips as "(M)", "(H)", "(O)", "(?)" (`UniverseMap.jsx:232`; `Hangar.jsx:137`; `FlightSettings.jsx:65`; `GuideLink.jsx:18`) while the portal gun and way-in show a `<kbd>`. Only the guide link sets `aria-keyshortcuts`. Fix: `aria-keyshortcuts` on all four and a visible cap on `pointer: fine`.

**F24 · low · language** — Tooltips as paragraphs: `NavMap.jsx:236` (20 words), `UniverseMap.jsx:295`. Fix: three-word titles; the sentence into the guide's tips.

**F25 · low · language** — "This link opens the map right here: share it." (`UniversePanel.jsx:181`): which link? Fix: "Share this view" with the nav map's copy-link button (`NavMap.jsx:481-483`).

**F26 · low · consistency** — Leaving the universe: "Classic site" (`UniversePanel.jsx:111`), "Universe | Classic" (`ViewSwitch.jsx:60`), "the Universe and Classic switch" (`StartChoice.jsx:174`), "Skip to the site" (`Welcome.jsx:89`), "Go to the home page" (`:168`). Fix: "Classic" is the view, "the home page" is the place; "Skip to the site" → "Skip the intro".

**F27 · low · consistency** — Punctuation rules differ by surface: feed lines no full stop (`client.js:140-355`), hangar notes with (`Hangar.jsx:94,123`), the panel mixes (`UniversePanel.jsx:181,216`), separators " · " (`scene.js:2452`) / ", " (`NavMap.jsx:419`) / ", … : " (`Universe.jsx:453`). Fix: chips and feed lines: no stop, " · " between facts; sentences in sheets and panels: a stop.

### Readability

**F28 · high · readability** — Planet labels have no shadow or scrim unless pressed: 0.7rem mono in `--muted` (`universe.css:104-124`; pressed bg at `:124` only). Fix: the nav map's `text-shadow: 0 0 6px #000, 0 0 2px #000` (`navmap.css:176`), 0.75rem, `--text` at 0.85 opacity; the scrim pill on hover as well as pressed.

**F29 · high · readability** — Text under 10 px on the HUD and nav map: `universe.css:599` (0.6rem) and `:1436` (0.55rem), `:386` (0.55rem), `:450` (0.6rem), `:410` (0.6rem), `:430` (0.58rem button label), `:766,788` (0.62rem button labels), `navmap.css:240` (0.58rem), `:177` (0.6rem), `:286` (0.6rem), `universe.css:35` (0.58rem). Fix: floor 0.7rem for anything read, 0.75rem for a button's label; drop uppercase/tracking where size is the constraint.

**F30 · medium · readability** — The grand-tour pill at `top: 92px` centred on the whole width (`universe.css:484-486`) sits on the comms line (top nav+12, up to ~150 px tall, `:1075,1082-1099`), and the tour has the crew talking throughout. Fix: one top-centre stack (comms, then status chips) with `top: calc(var(--nav-h) + 12px)` and flex-column gap; or the pill into the prompt slot at the bottom.

**F31 · medium · readability** — The siege banner at nav+76 (`universe.css:392`) is "under the crew's line" only when that line is one row; a two-row line with the 44 px face reaches ~170 px. Fix: same stack as F30.

**F32 · medium · readability** — The hint's scrim is 0.7 alpha with `--muted` text (`universe.css:978-980`), 0.72rem on phones (`:1447`). Fix: 0.85 alpha, `--text`, 0.8rem; or the hint as the sheet's first row.

**F33 · high · hierarchy** — Too much at once on first arrival (§5): comms, brief cards, panel keymap, tour offer, online pill, three icon buttons plus the portal pill, alt gauge, arms readout, ~13 labels; 11 buttons on a phone's ~390 px of map (`universe.css:1421-1453`). Fix: stage the HUD: for the first 20 s only comms + prompt + Boost/Fire; arms readout and alt gauge appear on first use (as shields already do, `:447`); the portal pill only for the cruiser (F36); the tour offer not until the brief is dismissed and a landing has happened.

**F34 · medium · hierarchy** — Three onboarding layers overlap in the first minute with three different key lists: KEYMAP (`UniversePanel.jsx:48-57`: no O, J, E, G, Esc, Shift), the hint (`UniverseMap.jsx:379`: has them), the brief (`briefs.js:38-49`: has Shift, T), the guide (`pages.js:12-21`). Fix: one key list in `guide/keys.js` feeding grid, hint and brief; the tour offer (`TourHost.jsx:101-113`) waits for `BRIEF_KEY` to include `/universe/fly`.

**F35 · low · hierarchy** — The desktop fly hint hides while the panel is open with nothing selected (`universe.css:1002-1004`), and the panel's grid never mentions landing. Fix: a "Land · fly down into a planet's air" row in KEYMAP (`UniversePanel.jsx:48-57`).

**F36 · medium · hierarchy** — The portal-gun pill shows for every crew: `UniverseMap.jsx:294` `{!onFoot && ship && …}`, titled "Rick's portal gun" (`:295`); the CSS comment says "in the cruiser (P)" (`universe.css:913`); it is a lime text pill beside three white icon buttons. Fix: `ship === 'cruiser'` (or say it's for everyone and style it as the fourth icon button in the 44/12 family).

**F37 · low · readability** — `.universe-keymap dd` is `nowrap` + ellipsis (`universe.css:1024`), so "Throttle"/"Nav map"/"Cockpit" clip when the panel is at its 400 px minus padding. Fix: allow wrapping; two columns only above 360 px of panel width.

### Spacing

**F38 · high · spacing** — Phone collisions: the way-in button (bottom s+156, min-height 44, `universe.css:1432`) and the on-foot hint (bottom s+160, `:1447`) both show for the first 16 s on foot (`UniverseMap.jsx:140,302,367`); the shield bar (bottom s+160, left 10, width 76, `universe.css:1440`) shares the hint's bottom edge and left gutter. Fix: a bottom-centre column (`--hud-row-1/2/3`) with the way-in above the hint above the prompt; the shield bar into the left column under the arms readout.

**F39 · high · spacing** — The multiplayer feed grows upward from the pill (`online.css:153-164,212-227`; pill 16→56 px, notes from ~64 px) straight into the nav-map/settings/hangar buttons at bottom 68 (`universe.css:1107,1239,1259`), and wins on z-index (3 over 2, `online.css:155`; `universe.css:1105`). "X came online" covers the hangar button. Fix: the feed to the right of the pill (row direction), or the pill and feed above the button row, or reserve the column.

**F40 · medium · spacing** — The grand-tour pill on phones is `bottom: 120px` (`universe.css:512`), not sheet-relative: with a 38svh sheet it lies over the panel (z 3 over 2). Fix: `bottom: calc(var(--sheet-h) + 64px)` in the prompt's row.

**F41 · medium · spacing** — Six edge gutters: 10 (`universe.css:1425,1440`), 12 (`:135-136,1448`), 16 (`:1106,1259`; `online.css:156`), 22 (`universe.css:314`), 26 (`:962,1437`), 184 (`:970`). Fix: `--hud-gutter: 16px` desktop / 12px phone, `max(…, env(safe-area-inset-*))`, used by every absolute item.

**F42 · medium · spacing** — Eleven desktop bottoms and twelve phone sheet-offsets (§6) with no row model (`universe.css:712-836,1107-1125,1421-1453`; `online.css:310`). Fix: three rows as CSS variables (`--hud-row-1: 16px` thumb/pill row; `--hud-row-2: 68px` icon buttons/prompt; `--hud-row-3: 120px` hint/way-in/sheets) and every element positioned on one of them.

**F43 · low · spacing** — The top slot: comms at nav+12 (`universe.css:1075`), the pill at a fixed 92 (`:484`), the siege at nav+76 (`:392`), arrive at 27 % (`:878`); the nav is 68 or 76 px (`index.css:56,65`). Fix: everything top-centre from `calc(var(--nav-h) + 12px)` in one stack (F30).

**F44 · low · spacing** — Safe areas missing on the left column (`universe.css:1106,1239,1259,1448-1452`), the on-map multiplayer pill (`online.css:310`), the right thumb cluster (`universe.css:1421-1428`), prompt and way-in (`:1429,1432`); present on the nav map (`navmap.css:11`), floating pill (`online.css:170-171`), exits (`universe.css:229`), cockpit (`cockpit.css:126`). Fix: the gutter token of F41 carries `env()`.

**F45 · low · spacing** — The panel mixes `mt-3`/`mt-4` (`UniversePanel.jsx:173,175,194,200,221`) with 1rem/1.25rem CSS (`universe.css:1050,1021,1043`) and a negative margin on `.universe-back` (`:207`). Fix: a 4/8/12/16/24 px scale in CSS, no Tailwind spacing in the panel.

**F46 · low · spacing** — The nav map uses ten gap values (`navmap.css:19,73,102,199,212,234,245,250`). Fix: 0.25/0.5/0.75/1rem.

### Consistency and duplication

**F47 · high · duplication** — Thirteen key-cap styles (§3; `universe.css:1025,985,813,861,937,387,510`; `navmap.css:264`; `extras.css:989,1012,299`; `cockpit.css:207,233,329`); the tour pill's "Esc" has no border at all (`universe.css:510`), the arms' caps are 0.55rem radius 3 (`:387`). Fix: promote `.guide-kbd` (`extras.css:989`) to a global `.kbd` with a `data-size="sm"` variant; every HUD cap uses it; the prompt's G becomes a real element (F53).

**F48 · high · duplication** — Nine panel surfaces with six alphas and five radii (§3; `universe.css:148,1135,1289,1489`; `online.css:237`; `navmap.css:25,205`; `tour.css:14`; `cockpit.css:311`). Fix: `--hud-sheet` (0.93, 14 px, engine-tinted border) for settings/hangar/online card, and `--hud-dialog` (0.96, `--r-card`) for the panel, start card and nav map frame.

**F49 · high · duplication** — Twelve pill/toast/banner styles (§3). Fix: three classes: `.hud-chip` (status: mono 0.72rem, radius 999, bg 0.78 — prompt, tag, tour pill), `.hud-toast` (a sentence: sans 0.85rem, radius 12, bg 0.85 — hint, siege, online note, navmap note, hangar dropped) and `.hud-cta` (the way-in); the comms line and arrive keep their own.

**F50 · medium · duplication** — Three identical segmented controls: `universe.css:1221-1225`, `:1310-1316`, `:1361-1364`. Fix: one `.hud-seg`.

**F51 · medium · duplication** — Nine icon-button sizes/radii (§3). Fix: 44/12 for icon buttons (nav map, settings, hangar, tuck, guide link), 32/round for every close button (`universe.css:1144`, `online.css:242`, `navmap.css:38`), 56/64/76 round only in the thumb cluster.

**F52 · medium · consistency** — Five small-link looks (§3; `universe.css:202,1226`; `navmap.css:59,235`; `online.css:265`). Fix: one `.hud-link` (mono 0.72rem, muted, text on hover, underline on hover).

**F53 · medium · consistency** — Other pilots are salmon on the map (`.universe-tag` `#ff9a85`, `online.css:132`) and green on the chart (`.navmap-pilot` `#7dff9a`, `navmap.css:142`); allies are `#8dffad` on the map and list but unmarked on the chart; the feed's 'join' tone is blue `#7cc8ff` (`online.css:224`). Fix: one pilot colour (the join blue) and the ally green in all four places.

**F54 · low · consistency** — Six ambers: `#ffb347` (`universe.css:365,380,412`), `#ffb35c` (`:1309`; `navmap.css:228`), `#ffcf7a` (`navmap.css:211`), `#ffd3a1` (`universe.css:1381`), `#ffdca0` (`navmap.css:233`), `#ffd9a0` (`:177`). Fix: `--hud-warn: #ffb35c` and one tint.

**F55 · low · consistency** — The nav-map button is blue (`universe.css:1264-1267`) beside two white siblings (`:1112,1244`), while the panel's "Nav map" link is muted mono (`UniversePanel.jsx:294`; `universe.css:202`). Fix: decide: blue = navigation (then the panel link is blue too) or all three white.

**F56 · low · consistency** — Backdrop blur on the tour pill (`universe.css:496`) and start card (`:1491`) against the file's own rule of no blur over the live map (`:146-147,1091`; `online.css:183`). Fix: drop it from the pill; the start card covers a paused scene and may keep it.

**F57 · low · consistency** — Four accent systems on one screen: `--engine` per ship (`universe.css:681-683`, used by sliders/hangar/alt), the speaker's colour (`Comms.jsx:297`), the selected universe (`Universe.jsx:412`), nav-map blue (`navmap.css`). Fix: write the rule in `universe.css`'s header (ship = controls, speaker = speech, place = panel/card, blue = navigation) and apply it (F55).

**F58 · low · consistency** — `.universe-nav-open` is set on the "Open the nav map" button (`UniversePanel.jsx:194`) but has no rule anywhere (grep of `src/**/*.css`). Fix: remove the class or style it.

### Accessibility

**F59 · medium · accessibility** — The prompt's key cap is `content: 'G'` (`universe.css:814-825`) inside an `aria-live` element (`UniverseMap.jsx:292`): screen readers hear "Into Dunder Mifflin" with no key, touch sees no key (`:826`), and NPC speech is poured into the same prompt (`scene.js:4219-4221`, italic via `:830`). Fix: a real `<kbd>` in the DOM, hidden on `pointer: coarse`; speech into its own `.hud-toast` with the speaker's name as the comms line does.

**F60 · low · accessibility** — Three icon-only buttons on touch (nav map `UniverseMap.jsx:232`, settings `FlightSettings.jsx:58-73`, hangar `Hangar.jsx:130-143`) have no visible name; the guide calls them "Wrench" and "Sliders" (`pages.js:105`) and the panel "the wrench" (`UniversePanel.jsx:244`). Fix: a 0.6rem caption under each on `pointer: coarse` ("Map", "Feel", "Hangar") and the same words in the guide.

**F61 · low · accessibility** — Station labels are `opacity: 0` but focusable (`universe.css:128`), so Tab lands on invisible buttons until `:focus-visible` shows them. Acceptable, but the 3D sign that replaces them (`universes.js:41-96`) is not announced. Fix: keep the hidden label's text as the accessible name (it is) and add the sign's second line to `aria-label`.

### Motion

**F62 · low · motion** — The way-in button glows forever (`universe.css:855` `… infinite`) beside the portal gun's endless spin (`:953`) and the arrive animation (`:883`): three loops in the lower middle. Fix: the glow three times then still; the swirl spins only on hover/press.

**F63 · low · motion** — The lock bracket's `universe-lock-in` (`universe.css:586-589`) and the threat pulse (`:679-680`) are turned off under reduced motion (`:1464-1466`) but the shield "low" blink (`:472`) keeps its colour change only — good; the comms line animation is gated on `data-motion` (`:1093`) while the settings and hangar sheets use `@media (prefers-reduced-motion: no-preference)` (`:1139-1141,1297-1299`): two gating patterns. Fix: one (the media query).

## 10. Suggested order of work

1. Tokens and rows (F41, F42, F47, F48, F49, F51): a `hud.css` with gutters, three rows, one cap, two surfaces, three chip roles — this removes F38, F39, F40, F30, F31 as a side effect.
2. The glossary (F01, F02, F03, F05, F06, F20): one `universe/words.js` with the nouns and verbs, imported by the panel, nav map, scene prompts, guide and briefs; then F04, F07, F08, F09, F11, F14, F15.
3. Readability (F28, F29, F32) and staging (F33, F34, F36).
4. The rest as polish.
