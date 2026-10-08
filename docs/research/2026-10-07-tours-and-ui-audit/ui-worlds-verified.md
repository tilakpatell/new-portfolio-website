# The worlds' game UI: the verified findings

Date: 2026-10-07. The verification pass on `ui-worlds-games.md` section 8, whose 68 findings were unverified when that session ran out. Each finding went through two checks run in parallel, neither seeing the other:

- **Code.** Open every `file:line` it cites on today's `main` (merged into this branch at `6ea55641`) and say whether the claim holds, holds in part, or is refuted. Where it is right but its line numbers or counts have drifted, the corrections are noted.
- **Design.** Would a strong game-UI designer make this change without the world losing its face (its title face, its big-number face, its colours, its character)? The checker read `.claude/skills/threejs-game-ui-designer/SKILL.md` and `.claude/skills/design-taste-frontend/SKILL.md` sections 0–3. It answered make, make-adjusted (the problem is real but the fix should be different or narrower) or reject.

A finding is kept only when it passes both checks: the code check says holds or partly, and the design check says make or make-adjusted. **59 are kept and 9 are dropped.** For a kept finding, *the fix to make* is the design check's adjusted fix where it gave one, and that fix replaces the audit's. Line numbers are as cited; the code check's corrections give today's.

Visual confirmation comes from the screenshot audit (`ui-screenshots.md`, desktop 1440 × 900). Its world findings 7–14 are cross-referenced below as "seen: S7" and so on.

## What this changes in the plan

- **One behaviour, each world's look.** The kit owns the order (key first), tappability, placement (the rows), the words of the glossary and the rules. Each world keeps its prompt's shape and its cards in its own CSS through the kit's part classes and `--hud-*` variables. The design check said this about prompts (1, 2, 4), toasts (13), bubbles (14) and the lists (19), and gave the same answer each time: shared structure, not a shared skin.
- **Canon words stay.** Retry words (9) and touch verbs (21) are flavour and stay. Minecraft's "Respawn", Mario 64's "Continue" and A, and Dot Matrix's B on touch are kept.
- **Leaving.** "Universe map" is the one way out of a world, in its Menu. Inside a world, an exit keeps the world's own verb ("Get up", "Back to the concourse") or says "Leave" when there is none. Every exit is drawn as the same exit button, with `Esc` on desktop (7, 8). The standard's "Leave + Esc" reads as: a context verb, or "Leave", plus `Esc`, in one exit button.
- **The achievement toast** moves to the top centre under the nav on world routes, keyed off one marker (`data-hud-world`), not a list of world classes (22).
- **Glass, never blurred**, at an alpha of 0.78 or more. A world tints the colour and may make it solid (47).
- **Not built:** one loading style (20), one minimap shape (51), one compass height (40), the padded-world model for Earth and the surface (39), the surface's buttons lowered to the pad (58, which would cover the `?`), the players chip as a component on its own (11: the kit's `PlayersChip` exists for the Menu, and each world keeps its noun and its tooltip's lore), and the tour offer moved off game routes (41: it is never shown there).

## Kept findings

### 1. Twelve interact prompts for one idea (high)

Code: **holds**. Design: **make-adjusted**.

*Corrections:* Some line numbers are off by one. albuquerque:66 and shire:72 are blank lines; the rules are at :67 and :73. Several citations (avengers, rickmorty, surface, dotmatrix, universe, galaxy, middleearth) point at the comment line just above the rule instead of the rule. The paths are given in shortened form: shire.css is src/components/middleearth/shire/, game.css is src/components/cybertron/game/, and middleearth.css is src/styles/lazy/.

*The fix to make:*

Share the behaviour and structure, not the look.

1. Build one `<Prompt>` component (in src/components/games/ or the runtime) that owns:
   - Key-first order: `<kbd>` first, then the verb, then the name.
   - Rendering as a real `<button>` that acts as the action button on touch, with the key cap hidden on touch.
   - aria/role.
   - Position from the shared bottom tokens (above `--hud-foot`, clear of `--guide-reserve`).
   - Optional slots for a sub-line, a disabled/closed state and one secondary action, so Albuquerque's card content survives.
2. Give the component stable part classes (`.prompt`, `.prompt-key`, `.prompt-verb`, `.prompt-name`, `.prompt-sub`) and let each world restyle them in its own CSS:
   - Invincible keeps its comic pill.
   - Dot Matrix keeps its pixel box and round key.
   - Albuquerque, Avengers HQ, the Shire family and C-137 keep their cards.
   Only the order, tappability and placement change.
3. Keys follow the platform's canon: Dot Matrix shows X on keyboard and B on touch, and Mario 64 keeps A. Don't force E everywhere.
4. Migrate the key-last worlds (abq, cw, shire/TownHud, rm, mw, me) and the untappable ones (dm, mw) first. Invincible, surface, cyw and galaxy-land already follow the rule and only need to adopt the component when they are next touched.

### 2. Two word orders for the prompt (high)

Code: **holds**. Design: **make-adjusted**. Seen: S12.

*The fix to make:*

Narrow the change to where the key sits and how it is drawn:
- In AbqWorld.jsx:631/634, ShireWorld.jsx:874, CompoundWorld.jsx:733, RmWorld.jsx:1606 and MusicWorld.jsx:303, move `{!touch && <kbd>E</kbd>}` (or `<kbd>P</kbd>`) in front of the label, giving "[E] Go in" and "[E] Play the drums". Keep every verb and the world's own wording exactly as written, and keep each world's door card, its place-name title face and its colours.
- Keep hiding the key on touch.
- In GameWorld.jsx:397, Cybertron, render the key as a real `<kbd>` instead of the plain-text "E  " / "Q  " prefix, keeping the Q transform variant.

Do not merge the door cards into a single pill component, and do not reword canon verbs under this finding. Merging the prompt components is the separate "one prompt component" item in the standard, and should be judged on its own merits.

### 3. The prompt shows a key the player doesn't have (high)

Code: **partly**. Design: **make-adjusted**.

*Corrections:* The pages.js citation is :29, not :33. The Mario64 :268 example is a card button labelled "Go in (A)", not a prompt key; that is arguably consistent with Mario's own A button. Universe accepts E as well as G, so it only shows a different letter, not a different key. "Eight worlds" with E was not counted exactly, but many worlds use E prompts. The core Dot Matrix B-vs-X mismatch holds.

*The fix to make:*

1. Dot Matrix: make the key in the prompt depend on the device. Show X on a keyboard and B on touch or a gamepad, reusing the `touch` flag the hint at line 677 already uses. Keep the key bindings, the A/B touch buttons and the green Game Boy pill as they are.
2. Universe map: change the pill's ::before content from 'G' to 'E'. E already works there and G can stay as a hidden alternative, so no binding changes.
3. Do not rebind Dot Matrix or Mario 64 to E, and leave the "(A)" and "(B)" button labels on Mario 64 as they are, because they are the canon controls. Write down that controller-tribute worlds use their own buttons for the prompt key, and that every other walkable world uses E.

### 4. Seven objective-line components (high)

Code: **holds**. Design: **make-adjusted**. Seen: S10.

*Corrections:* - The bare "world.css:41" and ":49" point to two different files: :41 is albuquerque/world/world.css and :49 is avengers/world/world.css (at albuquerque :49 is `.abq-hud-online`). The citation is ambiguous but each line is a real objective rule.
- surface.css:354 is the comment line; the `.surface-quest` rule starts at 355.
- The "three positions" count is arguably four, since cyw at the top left and surface at the top right are separate positions.

*The fix to make:*

Build one `<Objective>` component (in src/components/games/ or the runtime) that owns the behaviour:
- the text comes from Invincible's `objectiveText`, with the distance appended whenever the world has a target position;
- aria-live="polite";
- one font-size floor (≥0.78rem on phones);
- a max-width of min(30rem, 80vw) with wrapping;
- the phone rule, written once;
- a glass background, so the line stays readable over the 3D.

The world's flavour is passed in as props or CSS variables rather than unified:
- `glyph` (keep ◆, ▲ and ✦; leave it empty where a world has none);
- skin tokens for background, ink, accent, border and shadow (so Invincible keeps its yellow box with black border, offset shadow and purple/red alert states, and Rick and Morty keeps its 12px-radius look);
- `className` or a position slot, so each world's Hud keeps the objective where it sits now.

Let the component set position only for worlds that have no layout of their own (the game.css and surface.css cases). Change any of the three existing positions only if a phone screenshot shows the objective overlapping the stick, the map or the "?" button. Migrate one world at a time, starting with the four in the walkable worlds. Check that every world's objective looks the same before and after, apart from the distance added where there is a target.

### 5. Nine names for the list of things to do (high)

Code: **partly**. Design: **make-adjusted**.

*Corrections:* The core claim holds: the list has 7 distinct user-visible names, not 9. "Objectives" (mission.css:97) is a CSS class name, not a label. "Mission" (ChaseHud.jsx:65) is a start-card kicker and arguably not a name for the list. Stale lines: GalaxySurface.jsx:495 shows a "places found" count, and line 488 is a comment. The "Things to do · n/m" button is at GalaxySurface.jsx:547 and the list title at 553-554. RmWorld.jsx:1748 is EmoteWheel code; "Things to do" is at 1662 and 1885-1888.

*The fix to make:*

Make the entry point and the list's shape consistent, not the noun.

1. Drop the ChaseHud "Mission" kicker and the GalaxyMission "Objectives" heading from the finding. They are not the list.
2. Every world's list is opened from one chip or Menu entry. It uses the same key and always shows progress as "Name · n/m", like GalaxySurface.jsx:488. Where possible it renders through the shared QuestList, re-skinned by the world's CSS variables.
3. Keep the canon or diegetic names on the chip and as the panel title: Passport, Cartridges, Missions, and "This week at Dunder Mifflin" as the panel title. Add a small "Things to do" eyebrow or aria-label under them, so the function reads the same everywhere and the world keeps its voice.
4. Only where a name is a generic paraphrase with no canon weight (for example AbqWorld "Places" or CompoundWorld "The compound", if they are plain lists) change it to "Things to do" and move the flavour into the subtitle.
5. In the Invincible-style Menu (standard item 2), the item can read "Things to do" and open the world's own titled list.

### 6. Twelve words for the menu (high)

Code: **partly**. Design: **make-adjusted**.

*Corrections:* "Twelve words" is wrong: the finding lists 8 distinct words (10 citations). GalaxySurface.jsx:593 should be :671. "Stop" is at GameWorld.jsx:571 and is a touch play-control (stopPlaying) beside Jump/Use/Boost, not really a menu entry; "Missions" (584) is a missions list dialog, arguably not a menu label either.

*The fix to make:*

Apply the single top-right "Menu" button, skinned in each world's own chip style and font, only to the open-world HUDs: Compound, Albuquerque, the galaxy surface, Cybertron and the other free-roam worlds. Put each world's existing settings panel inside it under its current name (for example "Driving" stays as the heading of Albuquerque's settings section). Add Controls (opening the site's guide), Players and the way out. Move Cybertron's touch "Stop" into the menu or rename it "Leave", following the standard's word list.

Leave the game-native pause screens alone, keeping their own titles and look: Mario 64's "Paused" and Minecraft's "Game menu". Their way in should be the game's own pause key or button, not a site Menu chip. Keep "Missions" as Cybertron's own list. Leave the gameplay-verb chips on the HUD (Photo, Swing tour, Run a delivery, time of day) as they are.

### 7. Twenty-plus ways to say “leave” (high)

Code: **partly**. Design: **make-adjusted**. Seen: S13.

*Corrections:* Two citations are wrong. GalaxySurface.jsx:598 is the powers list; "Back to orbit" is at :680. RmWorld.jsx:1734 is the Remember/Shoot prompt; "Back to the site" is at :1851 and :1926. Smaller drift: N64 is :110 not :109, DotMatrix is :735 not :734, and GameWorld "Stop" is :571 not :572. N64 also shows plain "Back" when mode is not 'overlay'. "Exit" is actually "Exit {course.name}". "Twenty-plus" counts places in the code, not distinct labels, of which there are about 14.

*The fix to make:*

Standardise the shape, not the words.
1. Leaving a place: settle on the existing majority pattern, "Back to <place>" + `<kbd>Esc</kbd>` on desktop. Keep each world's destination noun as flavour. Add the missing Esc hints (Mario64:244/337, Minecraft:422/442, N64:109, DotMatrix:734, ChaseHud, GalaxySurface, RmWorld, wherever they are missing). Change the bare "Leave" in Eaglercraft:194 and TownHud:113 to "Back to <place>" only where a clear place exists.
2. Ending an activity: keep the contextual verbs ("Get up", "Stop", "Done"). Make sure each is bound to Esc and shows the kbd hint (GameWorld's "Stop" has none).
3. Canon words stay: Mario 64 keeps "Exit <course>".
4. Leaving the world: keep "Universe map" as the single label.
5. Styling: give every exit control the same ghost button style and the same position (in the Menu or the top-right of the place header) per the standard. Copy only changes where it is missing Esc or has no destination.

### 8. Esc paired with nine verbs (high)

Code: **partly**. Design: **make-adjusted**.

*Corrections:* The count is wrong. Section 3's own row (line 61) says "9 verbs" but then lists 13. The code has about 15-20 distinct Esc labels if you include the "Back to X" place buttons. So "nine" understates the problem rather than inflating it.

*The fix to make:* Keep the verbs that are tied to each scene: Get up, Get down, Put the bow down, Back out into the rain, Back to the path, Back to the concourse, Leave it, Take the controls and Let go. Make the Esc control itself consistent instead. 1) Every inner place or dialog that Esc closes gets one shared button: label first, then the `.guide-kbd` Esc key on desktop, in the same spot and with the same styling (TownHud's place frame or InvHud's pill). Check that every exit uses this button, so none can show without its Esc key. 2) Use "Leave" + Esc only where the label is a vague catch-all with no action behind it: "Done" (OfficeWorld.jsx:1060), and "Stop" where it means leaving a place rather than stopping an activity. 3) Where Esc does something other than leave, such as Earth taking control back from the autopilot, keep the verb. Do not count it as an exit. 4) Leave the guide wording as it is. In section 9 of the standard, change "'Leave' + Esc inside a world" to: "a context verb (or 'Leave' when there is none) + Esc, shown in one shared exit button".

### 10. Five close controls (medium)

Code: **partly**. Design: **make-adjusted**.

*Corrections:* Wrong line numbers. RmWorld.jsx:1753 is the onClose prop passed to EmoteWheel, not an icon button; the icon close is at RmWorld.jsx:1890 (ThingsToDo). GalaxySurface.jsx:494-507 is the HUD place/count readout and the compass, not a panel; the close-less panel is surface-list at GalaxySurface.jsx:552-566, which closes on Esc (line 468).

*The fix to make:* Add one small `<PanelClose onClose label>` component (for example in src/components/games/, next to the planned Prompt/Toast). It is an icon-only "×" glyph, with an aria-label naming the panel ("Close the list"), a hit area of at least 44px, and fixed placement at the top right of the panel's header row. Its colours come from the world's existing CSS variables (`--shire-line` / `--shire-gold` style tokens), so each world keeps its look. Pass an optional `hint` prop so Cybertron keeps its toggle key as a small `.guide-kbd` "M" beside the ×, rather than as part of the word. Use it only on floating HUD panels you toggle open and shut over a live world: the things-to-do lists and passport (Albuquerque, Avengers, TownHud, Cybertron, Dot Matrix, Earth, C-137, the galaxy surface), the players lists and similar. Do not use it on full-screen Place frames, pause/end cards or game overlays, which keep "Leave"/"Again" + Esc. Every such panel also closes on Esc and on its toggle key. Do the galaxy surface list first, since it is the real gap. Leave Invincible's Controls dialog alone, because finding 16 replaces it with openGuide. Standard item 7's "'Close' on every panel" then means this one control (accessible name "Close…"), not a visible word on every panel.

### 12. 58 key-cap rules (medium)

Code: **partly**. Design: **make-adjusted**. Seen: S12.

*Corrections:* "Three sizes" is wrong and contradicts its own list, which names four (0.65/0.68/0.72/0.75). The real spread is about ten rem sizes. dotmatrix.css:105 is `.dm-prompt b`, not a kbd rule, although it is round and filled. The second real round, filled kbd is cockpit.css:107 `.cockpit-chip kbd` (20px, radius 50%, filled background). The "square x38" and "40 in world CSS" sub-counts were not confirmed exactly, but they are roughly plausible.

*The fix to make:* Add one HUD keycap rule in `runtime.css`, for example `:where(.hud-kbd, [data-hud] kbd)`. It fixes the structure: inline-grid, centred, min-width 1.5em, one size of 0.7rem, mono font, line-height 1.4. It takes its colours from the world through variables: `border: var(--kbd-line, 1px) solid var(--kbd-ink, currentColor)`, `border-radius: var(--kbd-radius, 4px)`, `background: var(--kbd-fill, transparent)`, `color: var(--kbd-text, inherit)`. Wrap it in `:where()` so it has zero specificity and a world can still override it. Then remove only the world rules that already match this default, that is, the ~0.68rem currentColor outlines in Albuquerque, Avengers, the Shire, Earth and the surface prompt. Re-express the deliberate looks as variable overrides on the world root, not as separate rules: Invincible (`--kbd-line: 2px; --kbd-ink: #111`), Rick and Morty (1.5px), galaxy-land and Dot Matrix (`--kbd-radius: 50%; --kbd-fill: var(--accent)`), and the music courtyard's warm border. Fix the one off-standard size, Earth's 0.65rem, which is under the 0.7rem floor. Leave mini-game and panel caps (cockpit, Roy, HQ, tide, trickshot, portal) and in-panel guide tables as they are. Keep `.guide-kbd` for the guide panel only.

### 13. Twelve toast components (medium)

Code: **holds**. Design: **make-adjusted**.

*Corrections:* The count of 12 is a little loose. .cw-pack (the backpack card) is counted as one of the toasts even though the fix says it should stay a world card. .g3-callout is a single class shared across 3 games, not one component. C-137's "memory card" (.rm-recall) is not one of the 12 toasts; it is listed in the speech-bubble row. The real count is roughly 11 or 12.

*The fix to make:*

Limit the shared `<Toast>` to the HUD notices of the walkable worlds: `.abq-toast`, `.shire-toast`, `.rm-toast` (its plain notice variant), `.cyw-toast`, `.surface-toast`, `.iw-toast` and `.cw-tour-msg`. Check `.dm-banner` on its own: include it only if it is a plain notice and not a scripted banner.
- What the component shares: position (top centre, under the HUD's top row, on desktop and phone, with no per-world phone offsets), `role="status"`, timing and enter/exit, a max-width, and `data-bad`.
- What each world keeps: font, colours, border and shape, through CSS variables (`--toast-bg`, `--toast-ink`, `--toast-face`, `--toast-line`, `--toast-radius`), the same way `TownHud` is re-skinned. For example, Invincible keeps its white comic box with the black 2px border and Cybertron keeps its Orbitron title.
- What stays out of scope: the speech variant `.rm-toast[data-kind=say]`, which belongs with the bubbles. Also leave `.m64-starget`, `.mc-say` and `.g3-callout` alone, since they are game moments, not HUD notices. The only change worth making there is the phone wrap rule from finding 53 for `.g3-callout`.
- As the finding already says, the Avengers backpack card and the C-137 memory card stay as world cards.

### 14. Twelve speech bubbles and dialogue boxes (medium)

Code: **partly**. Design: **make-adjusted**.

*Corrections:* Bubble is used by 8 worlds, not 14. me-bubble does not use the `width: 0; height: 0` trick, so only 3 of the 4 cited rules share it. Also, shire-bubble is the same CSS class that Bubble itself renders: ShireWorld.jsx:862 duplicates the JSX, not the CSS.

*The fix to make:*

Do not make Avengers, Invincible or the map use TownHud's Bubble markup or its voice hook, and do not drop their CSS skins. Two narrower options:
(1) Pull out a shared anchor class (say .hud-bubble: absolute, 0x0, pointer-events none, opacity fade; the child is width max-content, translateX(-50%), tail ::after at left 50%) along with the phone rule (max-width about 13rem, font 0.8rem). Leave colours, border, shadow, radius, name font and pop animation to each world's skin class.
(2) Optionally let TownHud's Bubble take a className prop and an optional voice prop, so another world can reuse the component without the Shire skin.
Keep Invincible's comic balloon, Avengers' cyan glass and the map's Cinzel veil exactly as they are. If (1) is done, the only visible change should be the phone-size fix on the Avengers and Invincible bubbles.

### 15. Three key-hint shapes (medium)

Code: **partly**. Design: **make-adjusted**.

*Corrections:* Two line ranges are a little off. Mario64.jsx:332-340 points mostly at the pause row (the Sound, Controls and Back buttons); the dl itself is at 342-349. N64.jsx: the dl is at 163-170, not 160-167; lines 160-162 are a button and the drop/note paragraphs. KeyTable.jsx:25 is the function declaration; the <table> element is at line 27.

*The fix to make:* Standardise how keys are drawn, not the container they sit in. In each world's existing key list (Cybertron cyw-keys, Mario 64 m64-controls, N64 n64-keys), draw the key column with the shared `Keys` component so every key renders as a `.guide-kbd` keycap that reads `keys.js` notation. Either keep the world's own `dl` and grid, or use `KeyTable` with the world's own className (e.g. `className="m64-controls"`). Keep each world's CSS: title face, colours, panel. Let world CSS tint `.guide-kbd` through variables if it needs to match. Where a world's list repeats the guide's rows, take the rows from `guide/pages.js` so there is one source of words. For Invincible, make "Controls" open the site guide instead of its own `dl` (covered by the guide-duplication finding), so nothing there needs restyling. Leave the first-move sentence hint as it is: no one-minute timer.

### 16. Invincible’s Controls repeats the guide (medium)

Code: **partly**. Design: **make-adjusted**.

*Corrections:* The GalaxySurface citation is wrong: src/pages/GalaxySurface.jsx:592 is the heat meter markup. The openGuide button is at line 670 (key handler at line 466). Mario64.jsx is src/components/mario64/Mario64.jsx, not src/pages/Mario64.jsx. Also, the Mario 64 CONTROLS duplicates the '/dot-matrix/64' guide entry (pages.js:428+), not pages.js:224-268, which is Invincible's entry.

*The fix to make:*

1. Invincible: change Controls in the InvHud Menu to call openGuide and remove the iw-help dialog (InvHud.jsx:68-92). Before removing it:
   - Move the pad line into the guide's /invincible entry, as a "Pad" group or a tip.
   - Fix the speed wording so the guide and the world agree.
   - Keep the live "{found} of {cards} title cards" count somewhere visible, either in the Menu or as a Things to do line. Don't lose it with the dialog.
2. Mario 64: keep the Controls chip on the pause screen and keep the list showing right there. Add a '/mario64' entry to the guide's pages.js. Then make the list on the pause screen draw from that one source, by rendering KeyTable from the pages.js rows (or by importing the guide's rows instead of the local CONTROLS array). The keys are then written once, but the player still reads them on the pause screen, in the pause screen's own m64 styling.
3. Cybertron: keep the key list on the start card. Add the world's keys (WASD, Mouse, Click/F, Q, Shift, Space, E, M, Esc) to the guide's /cybertron entry as a separate group from "Roll out", and have the start card render that group from the guide data. Don't replace the card with a link.

In short: one data source for the keys everywhere, the site's guide as the help screen only where the world already has a Menu, and pause screens and start briefings left in place.

### 17. Two shared game frames (medium)

Code: **partly**. Design: **make-adjusted**.

*Corrections:* The finding says 8 games use .hq-*, but it is 9: ThinkMark.jsx (Invincible) also uses hq-screen/hq-overlay. Also, widow.css, smash.css and thwip.css have no `.xx-touch-btn`, only `.xx-hud`, so "each HQ game's own .xx-hud/.xx-touch-btn" is true for only 5 of the 8. The core claim, duplicate game frames (.g3 vs .hq vs .trench), holds.

*The fix to make:*

Keep `.hq-*` and HQFrame as the Avengers HQ games' frame; do not rename it to `.g3`. Make two narrower changes instead:

1. Move the trench run onto `.g3`. Drop `.trench-screen`, `.trench-touch`, `.trench-touch-btn`, `.trench-levels` and `.trench-overlay` for `.g3`, `.g3-touch`, `.g3-touch-btn`, `.g3-seg` and `.g3-overlay`. Keep only the Laser/Torpedo colouring and the in-button key labels as trench modifiers, coloured through `--g3-pick` / `--saber`.

2. Give the eight HQ games one shared touch-button base, `.hq-touch-btn` in `hq.css`. It has two sizes: 64 px for the main action and 52 px for the rest. It also sets the stroke, glass and pressed state, and keeps `touch-action: none` and the tap-highlight reset. Colour comes from `--hq-accent`, or the game's own variable, so lawn, repulsor, ricochet, tesseract and the others keep their tint and fonts. Each game's `.xx-touch-btn` shrinks to positioning plus colour overrides. That removes the 44 px and 48 px sizes and the one-off shapes.

Each game's own score and status HUD (`.xx-hud`) stays per-game: that is flavour, not duplication.

### 18. Four copies of the inner-place frame (medium)

Code: **holds**. Design: **make-adjusted**.

*Corrections:* Minor line drift: Abq Place starts at 962 (956 is end of previous component); Office Place runs 1127-1175, not 1128-1165; Avengers is 155-213. C-137's JSX copy lives in RmWorld.jsx:~2299, not only the CSS cited. Small differences between copies: Office's Esc handler skips the defaultPrevented check, and it uses `.dm-place-where` where the others use a sub class. Neither change the claim.

*The fix to make:*

Share the behaviour and the structural frame, and leave the skin to each world:
- **Hook:** add `usePlaceFrame({ onLeave, focus: 'back'|'shell' })` in src/components/games/. It handles the portal to body, the `html` overflow lock and its restore, Esc with `!e.defaultPrevented` through a ref to `onLeave`, and restoring focus on leave.
- **Thin component:** add `<PlaceFrame>` with `title`, `sub`, `backLabel` (the world's own words, e.g. "Back to the car"), `fallback`, `full` and a `className` prefix or skin variables, plus children.
- **Shared CSS:** give it one structural stylesheet for position, flex column, z-index (`--z-place`), the header padding with safe-area insets (from C-137), and the scrolling body.
- **Kept per world:** the title font, the sub colour, the header background, the accent, the entry animation, the loading line and the back wording, through each world's existing CSS on its own class or variables.
- **Words:** do not swap "Back to the X" for a generic "Leave".

Verify Esc in Scranton's paper toss and fact check after the move.

### 19. Five copies of the world-list panel (medium)

Code: **partly**. Design: **make-adjusted**.

*Corrections:* The finding says "five copies" but lists seven (abq, cw, shire, rm, dm, surface, cyw). Several bare `world.css` citations point to different folders (albuquerque, avengers, rickmorty), which makes them ambiguous. The 16 files that match QuestList include TownHud.jsx itself, so it has about 15 users, not 16. The cited line ranges are close: `.surface-list` starts at line 389, not 386.

*The fix to make:*

Share the frame, not the content:

1. **One position rule.** Add a `.hud-list` shell, or `--hud-list-top`, `--hud-list-right` and `--hud-list-max-h` tokens in runtime.css. Every world's list then uses the same corner: top right, under the HUD's top row.
   - Inset it by `--hud-pad`, clear the right side by `--guide-reserve`, and cap the height so it stops above `--hud-foot`.
   - Write the phone rule once.
   - Delete the seven hand-tuned offsets (bottom 4.5 rem, 3.6 rem, 110 px, nav+96 and the others).
2. **One behaviour.** The header holds the title and a Close button in the same corner. The body scrolls with overscroll contained, and Esc closes the panel. This overlaps with finding 10.
3. **Keep each world's own content and skin.** Leave the list items, fonts, borders and shadows as they are: Dot Matrix's numbered pixel cartridges, C-137's Luckiest Guy header and ink border, Albuquerque's Georgia header, Cybertron's mission states and the surface's swatches.
4. **Move to QuestList only where the content already is a seal-and-blurb quest list.** Albuquerque's places and maybe the Avengers compound list are candidates. Theme them through the --shire-* variables, as the 17 existing re-skins do.

Leave font-size floors, such as Dot Matrix's 0.56 rem items, to the readability findings, not this one.

### 22. The achievement toast lands on the HUD’s foot (high)

Code: **holds**. Design: **make-adjusted**.

*Corrections:* Small citation offsets: the universe bottom 24px is on line 973, not 972, and the surface bottom 64px is on line 428, not 425. Those cited lines open the same rules. Two of the eight are weaker than the rest. `.iw-hud-bottom` is not strictly centred: it has a large right padding and its children are laid out with space-between. `.surface-health` sits at 64 px, so it only overlaps if the toast is tall enough to reach it.

*The fix to make:*

On world and game routes, move the toast to the top centre, just under the nav, and touch nothing else. Do not build the per-world `--hud-foot` option.

Make it narrower and sturdier than written:
1. Drive it from one marker, not a hand-kept `:has(.world-host, .abq-world, .cw-world, …)` list that will drift. Only 8 files use WorldHost. Have each world/game root (or WorldHost plus the few non-WorldHost roots) carry a shared attribute such as `data-hud-world`. Then one rule, `body:has([data-hud-world]) .toast-host { top: calc(nav height + gap); bottom: auto; }`, flips the existing `.toast-host`. The nav slides away on scroll, so use the nav's own height variable.
2. Check the top-centre spot against the HUDs that use that band. Invincible's compass and its centred objective line (`.iw-goal`) sit top centre. Several worlds also have their own top toasts (`.abq-toast`, `.shire-toast`, `.rm-toast`, `.cw-pack`). Verify at 390 px and 1280 px that the site toast does not cover the Invincible objective while it is showing.
3. Keep the toast's look, its pointer-through behaviour and its timings. In a world, consider capping it at a compact height so a GIF toast does not hang a large card over the scene for 7 s.

Leave every world's prompt where it is.

### 23. Mario 64’s A button over the “?” (high)

Code: **holds**. Design: **make-adjusted**.

*Corrections:* Minor: the cited block mario64.css:544-577 starts at 545 (`.m64-abz`). In page mode the route opens on the N64 emulator view (`view==='emu'`), and the Mario64 tribute with this pad appears only after onTribute. The pad is drawn only on touch devices (Mario64.jsx:356) while playing, in a dialog or on a card. On phones the guide button can be tucked on scroll (extras.css:961).

*The fix to make:* Take only the first option. Do not hide the "?". Set .m64-abz right to calc(16px + 42px + 0.9rem + env(safe-area-inset-right)), or to var(--guide-reserve) once that token exists, and keep the bottom where it is so the A button stays at the thumb. Give .m64-cam the same right inset so the camera keys stay lined up above the A/B/Z cluster. Leave the button sizes, colours, font and the A/B/Z arrangement alone. Afterwards, check on a 360 px-wide phone that the left edge of the moved cluster (B ends about 222 px from the right) still clears the stick.

### 24. Minecraft’s jump key over the “?” (medium)

Code: **holds**. Design: **make-adjusted**.

*Corrections:* Minor: the right 18 / bottom 60 + safe values come from .mc-pad (css:243-252), not .mc-keys itself; .mc-keys (273-276) only sets flex/gap. Cited range 245-250 sits inside .mc-pad, so it is effectively right.

*The fix to make:* Raise the whole touch row so it clears the "?" instead of narrowing it. In `minecraft.css`, change `.mc-pad` `inset` bottom from `calc(env(safe-area-inset-bottom, 0px) + 60px)` to `calc(env(safe-area-inset-bottom, 0px) + 22px + 42px + 10px)`. That is the "?" button's bottom offset plus its height plus a gap, about 74px. Once section 9's `--guide-reserve` token exists, the vertical counterpart can come from it. Keep the stick, keys and 18px side padding exactly as they are, and leave `.mc-inv-key` alone because it is at the top and already clear. Check on a 375px phone, with and without a home bar, that the jump key's bottom edge sits above the "?" and the hotbar still clears the raised row. Don't reserve a right column and don't hide the "?".

### 25. The Caribbean’s and the trench run’s fire buttons under the “?” (medium)

Code: **partly**. Design: **make-adjusted**.

*Corrections:* The finding leaves out an existing mitigation. On phones (max-width 639px), Guide.jsx:105-134 tucks the "?" away while the page scrolls down past 160px (extras.css:961 `.guide-btn[data-tucked]` uses translateY plus opacity 0 and pointer-events none). It comes back on scroll up or near the top. The overlap is therefore real only when the user stops after scrolling up, or at widths of 640px and up (tablets and touch laptops), where nothing tucks. That makes it a partial, situational problem rather than "with the screen scrolled to the foot of the viewport". The Fix also only names `.g3-touch` (the tide class); the trench run uses `.trench-touch`, not g3-touch.

*The fix to make:* Copy Cybertron's approach instead of adding a right reserve. While Dead Man's Tide or the trench run is in its playing phase, set document.documentElement.dataset.playing ('tide' or 'trench') in a useEffect, and clear it on exit or unmount using the same check as Cybertron's cleanup. Change the CSS rule from Cybertron's specific one to a general one in extras.css, next to .guide-btn: `:root[data-playing] .guide-btn { visibility: hidden; pointer-events: none; }`. One rule then covers all three games, and the next game only needs to set the flag. Do not move or resize the fire buttons. The "?" must reappear whenever the game is paused, on the title screen or at the end, so the guide can still be reached.

### 26. The “?” clearance is a copied constant (medium)

Code: **holds**. Design: **make-adjusted**. Seen: S9.

*Corrections:* These are small omissions; the claim itself stands. invincible:49 is not the bare constant: it adds `+ 200px + 0.75rem` for the map. rickmorty:61 also adds `env(safe-area-inset-right)`. The finding misses a third variant at rickmorty/world/world.css:289, which uses `+ 0.6rem` in its phone rule.

*The fix to make:* In extras.css next to .guide-btn, declare `--guide-reserve: calc(16px + 42px + 0.9rem + env(safe-area-inset-right))` on :root. Also define the button's own `right` and `width` from two small tokens, e.g. `--guide-inset: 16px` and `--guide-size: 42px`, so the button and the clearance can't drift apart. Then swap the token in only where a value is clearly the "clear of the site's guide button" sum. That is albuquerque world.css:35, avengers world.css:36, shire.css:35, invincible world.css:49/129/131, rickmorty world.css:61, and rush.css:63. Remove any env(safe-area-inset-right) these places already add themselves, so it isn't counted twice. Normalising the 1rem and 0.9rem gaps to one value is fine, since the difference is about 2px. Keep a narrower phone variant, e.g. `--guide-reserve-tight` for rickmorty:289's 0.6rem, rather than forcing the wide gap onto small screens. Leave earth.css:72, citadel.css:40, dotmatrix.css:122, bree.css:46, office world.css:56 and shire.css:138 alone unless reading each one shows it is truly the guide-button clearance. Convert those one at a time, checked at phone width, not in a blanket sweep. Check one world at 390px and at desktop width before and after, to confirm nothing moves except where a gap was knowingly normalised.

### 27. Seven edge-margin formulas (medium)

Code: **partly**. Design: **make-adjusted**.

*Corrections:* The 36 px upper bound is wrong. universe.css:712 is `.universe-boost { right: calc(var(--panel-w) + 36px) }`, a touch button placed 36 px from the side panel. It is not HUD padding from the stage edge, and section 4's own table says Universe's panel padding is 12 px. The real spread of edge padding is about 9.6 px to 22.4 px (Earth and Music at 1.4rem), or a little more if Cybertron's fixed 22 px bottom is counted.

*The fix to make:* Add `--hud-pad: clamp(0.75rem, 2vw, 1.25rem)` and `--hud-pad-b: max(var(--hud-pad), env(safe-area-inset-bottom))` to runtime.css, plus left and right versions that use the side insets. Point the full-stage world HUDs at them: Albuquerque, Avengers, Invincible, C-137 (its own safe-area rule can then go), shire.css (which covers the Shire, the towns, Scranton and the Citadel), Earth, Music and Dot Matrix. The win is safe-area coverage on notched phones, not the sub-pixel matching. Dot Matrix moves from 9.6 to 12 px. Leave its 3 px borders and hard shadow alone. Its retro feel comes from those, not from the padding. Leave the in-frame game screens as they are: g3/games.css, tide.css, deathstar.css, mario64.css, minecraft.css, n64 and Cybertron's full-screen layout. Their tighter padding suits a bounded screen, and they already handle the safe area where they need to. Leave universe.css:712 alone too: it is a gap beside the side panel, not an edge margin. Fix the finding's table so it no longer lists 36 px as an edge value.

### 28. Safe-area insets missing in seven worlds (medium)

Code: **partly**. Design: **make-adjusted**.

*Corrections:* 1) The "sticks sit 1 rem from the physical bottom" wording is loose. Three of the cited lines (albuquerque :32, avengers :33, shire :32) are HUD bar padding of about 0.75 to 1.25rem, not the stick rules. The sticks themselves are at albuquerque :78, avengers :84 and shire :95. Music's stick is at 1.4rem. 2) Invincible's touch row at :139 has 9.5rem of bottom padding, so its stick is far above the home bar. Invincible is missing the inset, but it is not 1rem from the bottom and not under the bar. 3) The "five vs seven" count was not checked exactly. Besides rickmorty, at least roy, dotmatrix, surface, worldgate and cybertron/game use safe-area insets.

*The fix to make:* Make the change only where the bottom edge actually comes near the home bar. Albuquerque: .abq-hud-bottom and the touch/stick row (albuquerque/world/world.css:32-35). Avengers: the matching bottom rules (avengers/world/world.css:33-36). The Shire family: .shire-hud-bottom, .shire-panel's bottom and the stick row (shire.css:35, :80). This reaches every town, Scranton and the Citadel through shire.css. Music: .mw-hud-bottom (music/world/world.css:14, :30). In each one, set only the bottom padding to max(<that world's existing clamp>, env(safe-area-inset-bottom)) and keep each world's clamp value. Use C-137's pattern (rickmorty/world/world.css:15-18) or the shared --hud-pad-b token if runtime.css gets it. Leave out Invincible's 9.5 rem touch row, which already clears the bar. Fold that into the --hud-foot finding instead. Add the Caribbean (tide.css touch row), which the spacing section lists as missing safe-area padding but this finding leaves out. Don't touch the top/left/right insets or anything visual. Check it in a 390 px iPhone viewport with a bottom inset, scrolled to the foot of the stage.

### 29. Eleven bottom offsets for the prompt (medium)

Code: **holds**. Design: **make-adjusted**.

*Corrections:* dotmatrix.css:126 (9.5rem) is a touch-only rule (`:has(.dm-touch)`), not a base offset, so using it as the top of the base range is wrong. The base rules top out around clamp(...,7.5rem) (albuquerque:66). The phone-list cite ":214" comes right after dotmatrix but points to avengers/world/world.css:214. dotmatrix has no 9.2rem. surface.css:330 is the `.surface-toast` line; the 168px prompt rule is at :332. The count of "eleven" can't be confirmed exactly, but the number of distinct values is the same order or higher.

*The fix to make:* Drop the phone magic numbers rather than flattening every offset. Define a measured --hud-foot in runtime.css (set by a ResizeObserver on whatever sits at the bottom of each world: the touch row on touch, the instruments or bottom row on desktop, falling back to --hud-pad-b), and place each world's prompt at calc(var(--hud-foot) + a small gap). Keep a world's own gap or stacking where it is deliberate, such as C-137's prompt above its hint. On touch, where the prompt becomes the action button (standard item 6), leave out the floating prompt and do not offset it. Make sure the resulting position stays clear of the achievement toast zone (finding 30). Ship this per world as each one moves to its own Hud.jsx, not as an eleven-file CSS sweep, and check each world at phone width with the touch row wrapped.

### 30. Albuquerque’s door card: two phone rules disagree (medium)

Code: **holds**. Design: **make-adjusted**.

*Corrections:* Calling the 9.5rem rule "dead" goes a bit too far. It loses only on touch devices, and it still applies to narrow non-touch windows (a desktop browser under 640px wide). The 15rem rule also moves `.abq-hint`, which the finding does not mention. Everything else is accurate.

*The fix to make:* Keep the touch and non-touch cases separate. Replace the hard-coded 15 rem with a measured value. In AbqWorld.jsx, use a ResizeObserver on `.abq-hud-bottom` (which holds the pads row on touch) to write its height into a stage variable, `--abq-foot`, the same pattern as Invincible's `--iw-under`. Then change world.css:122 to `.abq-world-stage[data-touch] .abq-door, .abq-world-stage[data-touch] .abq-hint { bottom: calc(var(--abq-foot, 15rem) + 0.75rem); }`, keeping 15 rem as the fallback. Leave the 9.5 rem rule in the 639 px media query for narrow screens without touch, and add a short comment saying it is for the case without touch. Check on a portrait phone, a landscape phone (short stage) and a narrow desktop window. In each, the card should sit just above the controls, never on them, and should not reach the middle of the screen. Don't change the card's look or text.

### 31. C-137’s phone toast in the middle of the stage (medium)

Code: **partly**. Design: **make-adjusted**.

*Corrections:* The cited selectors, values and line numbers are all exact. The weak part is the framing. The stage is 30rem only at its minimum: on phones it is 100svh minus the nav bar, so on most phones 15.5rem and 30% land in the upper third, not the middle. The code shows no evidence of where the player sits on screen. The lower position on phones also looks deliberate. The :107 comment says the caption goes "up under the objective", and the brand/objective column is narrowed on phones (:282-284), which stacks the HUD taller. Copying the desktop clamp(5.5rem, 17%, 9rem), as the proposed fix does, could put the toast on top of that HUD.

*The fix to make:*

Do not copy the desktop rule onto phones. Follow Invincible's measured stacking:
1. In RmWorld.jsx, put a ResizeObserver on .rm-hud-top and write its measured bottom (in px) to a --rm-under variable on the stage.
2. In the phone media query in src/components/rickmorty/world/world.css:
   - .rm-toast: top: calc(var(--rm-under, 15.5rem) + 0.5rem)
   - .rm-shipline: top: calc(var(--rm-under, 11.5rem) + 0.5rem)
3. Keep the two from overlapping. Either push the ship caption down by the toast's height while a toast shows, or let the toast replace the caption for its duration.
4. Keep the toast centred and the caption at the left/right pads as now. Change no visual styling: speech-bubble tail, Luckiest Guy names, eye glyphs and colours stay as they are.
5. Leave the desktop rules (the toast's clamp and the caption's low-left placement by the cruiser) untouched.
6. Check at phone heights of about 600, 700 and 850px, with a one-line and a three-line objective, that the toast sits just under the HUD and never over the objective, the map or Morty.

### 32. The Shire’s list placed by a hand sum (medium)

Code: **holds**. Design: **make-adjusted**.

*Corrections:* Minor: the extra gap is 3.4rem minus clamp(0.7rem,2vw,1.2rem) (~2.2-2.7rem), not exactly 3.4rem, though list also sits below map by the intended chip allowance either way.

*The fix to make:* In shire.css, add one token, `--shire-bar-clear: 3.4rem`. Use it in `.shire-hud-top { padding-top: var(--shire-bar-clear) }` and in `.shire-list { top: calc(var(--shire-bar-clear) + 150px + 3.4rem) }`. Do the same for max-height, so it reads `calc(100% - var(--shire-bar-clear) - 150px - 4.6rem)` or similar. In world.css:31 and citadel.css:44, set `--shire-bar-clear: clamp(0.7rem, 2vw, 1.2rem)` on `.dm-stage` and `.citadel-stage` and drop the padding-top override. The panel then sits right under the chip in every world. Leave the mobile rule (top:auto, bottom) alone. Only switch to measuring the column (the `--iw-under` approach) if a world's side column really changes height, for example when extra chips wrap.

### 33. Avengers’ right column of ten chips (medium)

Code: **holds**. Design: **make-adjusted**. Seen: S7.

*Corrections:* The code never states a "38%". It only sets the brand's max-width at 62%. The side column takes whatever width its nowrap chips need, minus the 1rem gap, so "about 148 px" is an estimate, not a value in the code. Best style and the tour-on chip are conditional, so on a phone the column usually shows 8 items.

*The fix to make:*

Make the right column the map, the stones counter, the backpacks counter and one Menu button, in that order.

The Menu holds:
- The buildings (M)
- Settings (O)
- Photo (P)
- Swing tour, with the best time shown inline
- Best style, as a read-only line
- Players
- Controls (the site's guide), so the keys aren't written twice

Keep the M, O and P hotkeys working directly, and show their kbd hints inside the Menu on desktop.

Show the tour clock chip (`cw-tour-on`) only while a tour is running. It is live race state, so it belongs in the visible HUD, ideally next to the objective or at top centre rather than in the column.

Keep the stones chip exactly as it is (the glow dots in each stone's colour). Keep the 🎒 counter, the Avengers HQ title face and the colours.

Don't take this as a reason to restyle the chips into the shared glass. Reuse Invincible's Menu behaviour (it closes on a click elsewhere or on Escape) and skin it with Avengers' own chip styling. The gain is the cleared stage on a phone, not a new look.

### 34. Albuquerque’s four bottom buttons (medium)

Code: **holds**. Design: **make-adjusted**. Seen: S7, S8.

*Corrections:* The 120px stick is defined at world.css:78, not in :118-124. That range holds .abq-pads (118), the touch wrap rule (120), the door at 15rem (122) and the 84px .abq-hand (123). The stick row sits above the buttons, not below them. Whether the buttons really wrap to two rows depends on the viewport width and the clock label; the code allows it but does not force it.

*The fix to make:* Move the Driving and Places buttons into one Menu button placed top right, Invincible's shape, and keep the time-of-day chip next to it. Keep their O and M keys and keep both panels as they are, opened from inside the Menu. Keep "Run a delivery" / "On a run" visible on touch as the one primary action in the bottom row. Put it in the right-hand column above Slide, or as a single pill centred between the stick and Slide, so the foot stays one row. Then set the touch door and hint offsets (bottom: 15rem) from a measured --hud-foot instead of a magic number, so they sit just above that single row. Leave the stick, Slide, the colours and the labels unchanged. Don't rename anything.

### 35. Earth’s touch controls in three absolutes (medium)

Code: **holds**. Design: **make-adjusted**.

*Corrections:* The values are right, but two wordings are loose. The touch layer is one absolute container (the stick and boost share its flex row) plus a separately absolute Roll, not "three separate absolutes". "Over the instruments' area" overstates it: `.earth-instruments` sits at bottom 1-2.2rem (:59), well below Roll at 11.6rem, so Roll is only above that HUD region, not on top of it.

*The fix to make:* In EarthWorld's .earth-touch, wrap Faster and Roll in one right-hand container, for example .earth-buttons { display: grid; justify-items: center; gap: 0.6rem; margin-right: 3.6rem; pointer-events: none }. Put Roll first so it sits above Faster, and centre it over Faster on the same axis. Move the margin-right from .earth-boost to that container. Remove position/right/bottom from .earth-roll. Keep both buttons' sizes (84 and 56), fills, borders, fonts and labels exactly as they are. The whole touch set then shares the one bottom, 5.6 rem plus the safe area, and stays clear of the "?" button. Do not adopt the 64 px uniform buttons or Invincible's colours. Check on a narrow phone that Roll's new top (about 5.6 + 5.25 + 0.6 + 3.5 ≈ 15 rem) doesn't clash with the hint line or the passport.

### 36. Invincible’s two magic numbers (medium)

Code: **partly**. Design: **make-adjusted**. Seen: S9.

*Corrections:* The fitHud line range is wrong. fitHud starts at InvWorld.jsx:810, with the --iw-under setter at :817. Lines 769-790 are the touch-controls JSX (.iw-touch, stick and buttons). "Otherwise measures" goes too far: the same HUD has other fixed offsets too, such as `+ 52px` for .iw-goal (world.css:56, :82) and `5.2rem`.

*The fix to make:* Do it in fitHud next to the --iw-under write, with two measured variables. (1) --iw-foot = stage.bottom - (.iw-hud-bottom).getBoundingClientRect().top + 8px. Measure the whole bottom row's top edge, not the gauge alone, so its padding and anything added later are included. Then use `.iw-touch { padding: 0 1rem var(--iw-foot, 9.5rem) }`, keeping 9.5rem only as the fallback. (2) For the phone map, set --iw-map-top from the lower of the compass bottom and the visible goal's bottom, plus about 10px, and use `top: var(--iw-map-top, calc(max(5.2rem, var(--iw-under, 0px)) + 112px))`. Because the goal's text and visibility change while playing, re-run this measurement when the goal changes, not only on resize. A ResizeObserver on .iw-goal and .iw-hud-bottom covers both. Leave the 64/116 touch sizes, the gauge styling and all colours and faces as they are.

### 37. Overlay z-indexes disagree (medium)

Code: **holds**. Design: **make**.

*Corrections:* Some of the cited files sit under src/components/ (e.g. src/components/mario64/mario64.css). For .m64, .mc and .n64 the z-index:80 is on the [data-mode='overlay'] variant, not the bare selector. The line numbers point at the z-index line itself.

*The fix to make:* As the audit says.

### 38. Cybertron alone goes full-screen on a phone (medium)

Code: **holds**. Design: **make-adjusted**.

*Corrections:* The Stop label is at GameWorld.jsx:571 (the button spans 570-572), which is close enough. "The only way back" overstates it: the code comment at game.css:73-75 says "Stop, or the back gesture, gives the page back". Also, z-index 60 is set on both .cyw-host (line 79) and .cyw, and the media block runs from 77 to 84.

*The fix to make:* Keep Cybertron full-screen on coarse pointers, and add no fullscreen button to the other worlds. Take "Stop" out of the .cyw-buttons action grid and put a dedicated exit control in the top-right corner, offset by the safe area beside or inside .cyw-stats. That is either the standard's one Menu with "Controls" (which opens the site guide) and "Leave", or at least a "Leave" chip in Cybertron's own glass and colours, using the standard word "Leave" in place of "Stop". Leave a 64 px touch target that is far from the fire and boost thumb zone. The action grid then holds only the five actions, so on a phone held upright it can sit cleanly in two or three rows. Optionally ask for confirmation or hold-to-leave if a run is in progress. Fonts, colours and the full-screen behaviour all stay as they are.

### 42. Dot Matrix’s HUD at 8–11 px (high)

Code: **holds**. Design: **make-adjusted**.

*Corrections:* "Whole HUD" is a slight overstatement: .dm-turn .dm-chip is 0.8rem (:87), .dm-title clamps 0.72-0.95rem (:61), .dm-banner 0.9-1.4rem (:89). Also .dm-row 0.62rem (:62) and .dm-list-head 0.66rem (:93) are in range but not cited. Dialog text clamps 0.56-0.68 and title 0.66-0.82, so "0.68-0.82" is the two maxima.

*The fix to make:* Keep Press Start 2P and the palette. Set one pixel-text floor for every HUD text the player reads, rather than only the chips and prompt: `--dm-text: 0.75rem` (12 px, which is 1.5 times the font's 8 px grid and renders crisper than 0.7 rem = 11.2 px). Apply it to `.dm-chip` (desktop and phone), `.dm-hint`/`.dm-prompt`, `.dm-list li`, `.dm-dialog-kicker`, `.dm-dialog-link`, `.dm-name` and `.dm-where`, and raise the lower bound of the `.dm-dialog-text` clamp from 0.56 rem to 0.75 rem. Delete the phone rule that shrinks `.dm-chip` to 0.5 rem. Make the chips fit by other means: let `.dm-chips` wrap or widen past 52%, tighten the chip padding, and hide the chip `kbd` key hints on touch, where they mean nothing. Leave the display sizes (banner, dialogue title, turn chips) as they are. Check at 360 px width that the chips and the bottom prompt (raised to 9.5 rem above the touch row) still fit without clipping.

### 43. Eleven HUD texts under 10 px (high)

Code: **partly**. Design: **make-adjusted**.

*Corrections:* The universe.css citation is stale. The 0.55rem lock/nav rule is at lines 1475-1478, not 1433-1436, which hold the unrelated .universe-record-* rules. Every other cited line and value matches.

*The fix to make:* Raise only the cited during-play labels to 0.7 rem, the value of a shared --hud-min token in runtime.css. In each fixed-size button, check the longest label at 360 px width and fix overflow there: let Cybertron's buttons widen or wrap to two lines rather than shrink, shorten "hold: swing" to "hold", and keep the zip glyph or label inside its 52 px. For universe nav and lock names on phones, use 0.7 rem with ellipsis truncation instead of 0.55 rem. Keep each world's colours, letter-spacing and uppercase treatment as they are. Scope the health.mjs check to world HUD stylesheets, warning on literal font sizes under 0.7 rem, with an inline allow comment for deliberate decorative cases. Handle Dot Matrix's Press Start 2P separately: raise its working text, not its face.

### 44. Cybertron’s undefined --font-body (high)

Code: **holds**. Design: **make**.

*Corrections:* Minor: the six affected rules include the intro lede, the key-list labels and the list items, as well as the mission text, dialogue and toasts the finding names.

*The fix to make:* As the audit says.

### 45. Earth’s undefined --font-display (medium)

Code: **holds**. Design: **make-adjusted**.

*Corrections:* Minor omission: the same dead token is also used at earth.css:106 (.earth-postcard-text h2), which the finding doesn't mention.

*The fix to make:* Don't swap in var(--font-sans). Add a scoped token next to Earth's other variables, such as `--earth-display`, in the `.earth-world` block (earth.css:4-12), and use it in both places: `.earth-title` (:44) and `.earth-postcard-text h2` (:106). Give it a real title face that suits Earth's travel and passport mood, such as a condensed travel-poster or aerospace face that no other world uses, self-hosted the way the Caribbean's fonts are. Keep Archivo as the fallback. If the owner decides Earth's title should stay in Archivo, then the token should say so on purpose, for example `--earth-display: var(--font-sans)` with a comment. Either way, fix both lines, not just :44. Working text and numbers stay in Archivo and mono, as they are now.

### 46. Shadow-only text over 3D (medium)

Code: **holds**. Design: **make-adjusted**.

*Corrections:* ":107-108" comes right after the game.css citations, but it actually means surface.css:107-108. The Cybertron compass label at game.css:34 is also shadow-only. Minor: game.css:29 has its own text-shadow, so the mission text is not bare.

*The fix to make:* Make it narrower and in each world's own style. (1) Galaxy surface: give the tracked quest block (.surface-quest-step, .surface-quest-name, link) and .surface-count a backing panel made from the page's own tokens, with an --accent hairline. Leave .surface-place as a display heading with its shadow, made stronger with a second tight 0 0 2px layer. (2) Cybertron: keep the amber-ruled gradient plate. Change the gradient so it stays near-opaque, about rgba(5,9,18,0.8), across the text's width and fades only in the last 20 to 30%, for example linear-gradient(90deg, rgba(5,9,18,.82) 0 70%, rgba(5,9,18,0)). Put .cyw-stats on the same dark plate, mirrored with a cyan rule on the right, keeping the Orbitron cyan numbers and their glow. Give .cyw-compass-label a small dark pill behind it. (3) Earth: wrap .earth-sub in an inline pill using the existing --earth-glass/--earth-line chip tokens, so it matches Earth's own chips. Leave .earth-title as it is. Do not import Shire styling anywhere. If a shared --hud-glass token arrives later, each world can map its own glass value onto it.

### 47. Ten glass alphas and six blurs (medium)

Code: **holds**. Design: **make-adjusted**.

*Corrections:* Minor only. The universe citation (144-146) points at the panel padding and border; the comment is on lines 146-147 and the background on line 148. The lowest alpha found was 0.62, not 0.58 (possibly a value outside these folders). The surface citation (line 125) is the blur line, which is right.

*The fix to make:* Remove backdrop-filter from every HUD box over a live world canvas. This part is a hard rule because it is about performance. Define `--hud-glass: rgba(8, 12, 20, 0.78)` in runtime.css as the default box, and make 0.78 a floor rather than a fixed value. A world may re-tint the colour and may raise the alpha up to fully solid, as Dot Matrix's palette, Invincible's yellow objective and C-137 already do, but nothing goes below 0.78. In practice: delete the blur lines in avengers/world/world.css:49, shire.css:38, earth.css:47 and surface.css:125. Raise the surface prompt (0.58) and Avengers (0.7) to at least 0.78. Leave the per-town --shire-glass tints in place, only checking that each one is at or above the floor. To make up for the lost frost, a world that wants a glassy edge can use a 1 px border in its own accent colour, which costs nothing per frame.

### 48. Earth’s first hint can’t wrap (medium)

Code: **holds**. Design: **make**.

*Corrections:* The text is 109 characters, not "about 105". That is a minor difference.

*The fix to make:* As the audit says.

### 49. Avengers’ and Albuquerque’s paragraph-long first hints (medium)

Code: **partly**. Design: **make-adjusted**. Seen: S11.

*Corrections:* The Albuquerque hint is about 189 characters (desktop), not about 230. The Avengers hint is 341, which is close to the claimed 330. "Four rows" holds for Avengers' walk step only: Albuquerque's drive step has 3 key rows, and both briefs spread their keys over several steps.

*The fix to make:* Make each first hint one short line: how to move, plus the world's one signature verb or fail rule, then GuideCue. Leave the rest to the brief and the guide. Avengers, desktop: "W A S D to walk, Space to jump; hold Space in the air to swing." Avengers, touch: "Stick to walk; hold Jump in the air to swing." Albuquerque, desktop: "W A S D to drive, Space to slide. The flashing dot is Hank: don't race past him." Albuquerque, touch: "Stick to drive, hold Slide into a turn. The flashing dot is Hank: don't race past him." Each line about 80 to 110 characters, close to the Shire's. Leave the separate in-suit hint in Avengers (shown when you're in the armour) alone, or trim it the same way if it runs over one line on a phone. Keep the canon words (Aztek, Hank, swing, web) as they are, and don't change the hint's style or position.

### 50. Three minimaps soft on 2× screens (medium)

Code: **partly**. Design: **make-adjusted**.

*Corrections:* The Invincible line numbers are wrong. InvWorld.jsx:756-768 is JSX for the bubble, loading text, InvHud and touch controls. The DPR map drawing is `fitCanvas` at 797-809, called from `fitHud` at 811. Everything else matches the code.

*The fix to make:* Move fitCanvas out of InvWorld.jsx into a small shared module, unchanged, and use it on every minimap canvas that is still a fixed 150×150. That is AbqWorld:600, CompoundWorld:666, ShireWorld:832, BreeWorld:828, WeathertopWorld:1034, RivendellWorld:864, CitadelWorld:1070 and OfficeWorld:962, not only the three named. Call it with unit=150 so each world's existing drawMap code keeps its 150-unit coordinates: at the start of each draw, call g.setTransform(box.s,0,0,box.s,0,0) and clear the 150×150 logical area. Re-fit on resize or with a ResizeObserver, including the phone breakpoint that shrinks the map to 96–104 px, not on every frame. Keep the width/height attributes as the fallback for the first paint. Do not touch map styling, colours, frame or placement, and do not otherwise convert these maps to Invincible's look.

### 52. Chips truncate silently on phones (low)

Code: **holds**. Design: **make-adjusted**.

*Corrections:* The two world.css files are different: .abq-hud-chip is in src/components/albuquerque/world/world.css and .cw-chip is in src/components/avengers/world/world.css. The .surface-quest-name rule is at surface.css:365-372, not 362-370; 362-364 belong to the .surface-quest block. "Truncate" is loose wording. With no overflow:hidden or ellipsis on the chips, the text spills out, and the world root's overflow:hidden then clips it.

*The fix to make:*

Chips (`.abq-hud-chip` world.css:44, `.cw-chip` world.css:53): keep `nowrap` so counters stay on one line. Cap the chip with `max-width: 100%` (or a phone-only cap from the side column, e.g. `min(14rem, 44vw)`). Truncate only the words, never the number: put the label text in a span with `min-width: 0; overflow: hidden; text-overflow: ellipsis`, and give `b` and `kbd` `flex: none`. `.abq-hud-chip` also needs `display: inline-flex` so this works. Keep the full text in the existing `title` / `aria-label`. On phones, cutting wordy copy is better than ellipsis: drop "in town" from the drivers chip, and in the abq rank chip let only the rank title truncate after the money. Check at 360px with the longest money, rank and player-count values.

Surface quest name (surface.css:364): keep it as a coloured uppercase eyebrow. Raise it to about 0.72–0.75rem and tighten the tracking to about 0.12em. Do not adopt a site-wide ban on tracked capitals. Just enforce the 0.7rem floor that is already in the standard.

### 53. The Caribbean’s callout phone rule (low)

Code: **holds**. Design: **make-adjusted**.

*The fix to make:* Add a phone media query in games.css next to the base rule: `.g3-callout { white-space: normal; max-width: min(90vw, 90%); text-align: center; text-wrap: balance; }`. Use `max-width`, not `width: 90%`, so short callouts like "3x combo" stay tight and keep their scale-in punch instead of sitting in a wide box. Then remove only `white-space`, `width` and `text-align` from tide.css:82, and keep `.dt-hud .g3-callout { top: 34%; }` there, because that offset comes from the Tide layout and should stay out of the shared rule. Don't touch the per-world font, size or colour rules. Check on a 360px phone with the longest Roll Out bad/boss lines and Tide's largest boss size.

### 54. Fourteen stick implementations (high)

Code: **partly**. Design: **make-adjusted**.

*Corrections:* - Wrong line: RmWorld.jsx:1680 is a toast/shipline. The rm-stick div is at :1793 and its onStick handler at :1521.
- Counts too low: "fourteen onStick handlers" undercounts. grep finds about 24 `const onStick` definitions in 23 files (every Middle-earth town world, Rush, Shire, Citadel, Office and others), plus stickDown/moveStick/onPad variants.
- Ring sizes: there are about seven (100, 112, 116, 120, 124, 128, 140), not six.
- File paths: the finding cites bare filenames. The real paths are under src/components/<universe>/..., for example cybertron/game/GameWorld.jsx and galaxy/surface/SurfaceView.jsx.

*The fix to make:*

1. Build one shared `useStick` hook or headless `<Stick onMove>` in src/components/games/ next to pad.js. It owns pointer capture, lost-capture and cancel reset, normalised -1..1 output, one dead zone, one throw radius as a fraction of the ring, and writing to rt.input.setStick where a world is on the runtime. It also offers a `floating` mode that recentres on the first touch, for Universe and Dead Man's Tide.
2. The component renders bare markup: ring, knob and the --sx/--sy variables. Each world sizes and styles it through a className or CSS variables (--stick-ring, --stick-knob, colours, art). 116/46 is the default for worlds that have no stick look of their own (most of the Shire family, Music, C-137, Albuquerque, Earth, Surface, Minecraft), and only there.
3. Keep Dot Matrix's D-pad, Dead Man's Tide's pill, Cybertron's knobless ring and Mario 64's sizing as world skins. Dot Matrix can share the pointer-capture helper but keeps its own 4-way quantise.
4. Fold the onStick maths into the hook in the same change. Do not alter any world's visible stick size unless it fails a reach or thumb-cover check on a phone.

### 55. Fifteen touch-button sizes (high)

Code: **partly**. Design: **make-adjusted**.

*Corrections:* 1. The count is off by one. The finding lists 14 distinct sizes, not "fifteen": 44, 48, 52, 54, 56, 60, 62, 64, 70, 74, 76, 78, 84 and 86.
2. Several line numbers are off by 1 to 6:
   - minecraft.css:290 should be 292-293.
   - minecraft.css:277 should be 279-280.
   - mario64.css:583 should be about 588.
   - mario64.css:550 should be about 556 (line 550 is the 170x150 cluster box).
   - mario64.css:571 should be about 575.
   - avengers/world/world.css:86 should be 87 (line 86 is the 46px stick knob).
   - earth.css:72 should be 73 (line 72 is the 52px stick knob).
   - universe.css:712 should be about 716.
   - surface.css:299 should be 300-301.
   - tide.css:90 should be 91.
3. "Two shapes" undercounts. Besides round buttons and rectangles there are rounded squares: tesseract has border-radius 18px, and Cybertron has 76x52 buttons with radius 14px.
4. Some cited values are not single square sizes. tide's 86 is a min-width, and Cybertron's 52 is the height of a 76-wide rectangle.

*The fix to make:*

Put a three-step size scale in runtime.css as tokens, plus a minimum:
- --touch-primary: 76px, for one main action per world at most (Mario A, Tide Fire, Avengers Jump, C-137 Use/Shoot, Albuquerque Slide, Earth Faster).
- --touch-action: 64px.
- --touch-secondary: 52px.
- 48px minimum for anything a thumb presses while playing.

Snap each existing button to the nearest step (54/56 → 52, 60/62 → 64, 70/74/78/84/86 → 76; for Mario keep A 76 / B 64 / Z 52 so the N64 order survives). Raise the 44 px trickshot pills and the Minecraft pause/inventory buttons to at least 48 tall.

Have .g3-touch-btn and each world's button classes read size from these tokens only. Each world keeps its own shape, colour, gradient, font, rotation and cluster layout (Mario's diamond, Dot Matrix's tilted A/B, Cybertron's and the Tide's rectangles). Do not replace world classes with a single shared class.

### 56. Cybertron’s rectangular touch pad (medium)

Code: **holds**. Design: **make-adjusted**.

*Corrections:* Minor: border-radius 14px means rounded rectangles, not sharp ones. In landscape (max-height 500px) the buttons drop to 44px tall. I did not check the claim that these are the only rectangular pads in the repo.

*The fix to make:*

Keep the cause but narrow the fix.
(a) Rebuild the pad on the shared TouchButton sizes and placement:
- Fire is the large 64 button in the thumb's home spot.
- Boost, Jump, Transform and Use are 52 buttons in an arc around it, bottom-aligned to --hud-pad-b, with the right column reserving --guide-reserve.
- Labels are at least 0.7 rem (or short glyph and word pairs), so "Transform" fits without shrinking.
(b) Let Cybertron skin the component through variables: chamfered or hex-cut corners, the dark rgba(5,9,18) glass, the 127,216,255 cyan edge and Orbitron labels. Do not force the circles.
(c) Move Stop out of the action cluster now, as a small labelled exit control in the top-right row by .cyw-stats, inside the safe area. Fold it into the world's Menu only when that Menu is built (it is a separate finding).

### 57. Dot Matrix’s and Mario 64’s hand-placed buttons (medium)

Code: **partly**. Design: **make-adjusted**.

*Corrections:* The cited values and line numbers are correct. The claim that "B's hit area [is] partly under the '?' reserve" is not supported. B is the left button, well clear of the guide button. A is the one nearest it, and the -22deg rotation lifts the right side (A) up and away. The 3.6rem margin is there to clear the guide button, as the comment on line 122 says. So the overlap claim looks wrong. What holds is the "hand-placed, not on a shared button/reserve" point, and the observation about 3.6rem of right inset. The Mario64 block starts at about line 545 (.m64-abz), not 544.

*The fix to make:* Keep both hand-placed clusters, with their sizes, colours, glyphs, tilt and offsets. Mario 64: move the whole .m64-abz box (and .m64-cam above it) clear of the "?" by setting right: max(var(--guide-reserve), env(safe-area-inset-right)) (or a 72px equivalent until the token exists), or by lifting the cluster above 64px from the bottom. Then check on a phone, with safe areas, that A, B, Z and cam no longer overlap .guide-btn. Dot Matrix: no change in layout. At most, replace the literal margin-right: 3.6rem with the shared --guide-reserve token once it exists in runtime.css, so the clearance has one source. Do not move either world onto the shared TouchButton sizes.

### 59. Touch-button guards repeated by hand (medium)

Code: **partly**. Design: **make-adjusted**.

*Corrections:* The claim of hand-repeated onContextMenu holds only for SurfaceView (11 written in the source, not 9) and RmWorld (wrong lines: it is at 1799-1828, not 1685-1711). CompoundWorld 768-830 does not repeat it. touch-action: none is never set inline on the buttons; it is set by class in every world, so the "repeated by hand" part is wrong for touch-action. GameWorld buttons do get touch-action from game.css:71 (the class covers the element), so "missing" applies only to onContextMenu. Mario64 already uses the shared helper the finding proposes as the fix.

*The fix to make:* Make the scope "every hold or tap touch button behaves the same under a long press", not "remove the repeated attribute". Add one shared rule, either a `.touch-btn` base class in runtime.css or the `<TouchButton>` from standard item 6, that applies `touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent` and blocks `contextmenu`. Each world keeps its own skin class for size, shape, colour and label glyphs. Apply it first where the block is missing (Cybertron's GameWorld buttons, and every button that relies only on its class but has no contextmenu handler). Switch Surface, C-137 and Compound over only when they move to `<TouchButton>`, not as a separate cleanup. Check on a real iOS and Android long press on a hold button: no callout, no selection, and the action keeps firing.

### 60. The prompt is the action button on touch (low)

Code: **holds**. Design: **make-adjusted**.

*Corrections:* surface.css cite is line 313, not 312. ShireWorld.jsx:873 is the button's `<button>` opening line; the E kbd is at 874. The C-137 button shows a context verb (here.verb, or 'Land' while flying) and only falls back to 'Use'.

*The fix to make:* Don't remove any action button. Write the rule as 'one tappable action per prompt, never two': in a world with a right-thumb button cluster (C-137, the surface), the thumb button carries the verb and on touch the prompt becomes a label only, with no E kbd and not tappable. That is C-137's model, which needs no change. In a world with only a stick (music, the Shire family), the prompt pill is the button and drops the E kbd on touch, which music already does. The only code change is in the surface: make its act button (SurfaceView.jsx:151) show the current verb, falling back to 'Use' when idle, and make sure the surface prompt isn't also tappable on touch. Also check that the Shire's touch prompt hides its E. Leave styling, colours and faces as they are. Update section 9 item 6 of the standard to match.

### 61. Only Invincible’s HUD has tested rules (high)

Code: **partly**. Design: **make-adjusted**.

*Corrections:* RmWorld.jsx has 2,335 lines, not 2,198, so the top of the range is stale. "The other sixteen HUDs are CSS constants inside world files" overstates it, because some HUDs already have their own *Hud.jsx files: galaxy/WarHud.jsx, galaxy/surface/ChaseHud.jsx, galaxy/surface/AssaultHud.jsx and middleearth/towns/TownHud.jsx. None of these has a rules file or tests, though, so the problem the finding describes still stands.

*The fix to make:*

Make the change narrower and tie it to visible fixes.
(1) Create src/components/games/hud.js with tests. Fill it only with the rules that the spacing and touch fixes from sections 4 to 6 actually need: the foot measured from the touch row, the guide reserve, stacking under a wrapping top row, and minimum text and marker size. Seed it from Invincible's hud.js; move that file's general rules there and leave Invincible-specific ones like objectiveText local. Pair it with the runtime.css tokens (--hud-pad, --hud-pad-b, --guide-reserve, --hud-foot), so the shared layer is layout only and never sets fonts or colours.
(2) Move a world's HUD markup into its own *Hud.jsx only when that world's HUD is being changed for a player-visible reason, such as adopting the Menu, prompt pill or measured foot. Never do it as a sweeping refactor of sixteen worlds. Worlds that already share TownHud (the Shire, the towns, Scranton, the Citadel) need no new file.
(3) Each world's CSS keeps its own title face, big-number face, colour variables and decoration. The shared module never touches those.

### 62. The runtime has no HUD parts (medium)

Code: **holds**. Design: **make-adjusted**.

*Corrections:* The galaxy is named as one of the five runtime worlds, but no line range is cited for it. All the cited ranges are accurate.

*The fix to make:* Make this finding narrower and fold it into finding 54. Add only a headless `runtime/hud/Stick.jsx`, plus an optional `TouchButton`, that the runtime itself provides. It handles the pointer capture, the getBoundingClientRect maths, one travel convention and the dead zone, and it writes straight to `rt.input.setStick`. Its bottom position is anchored to `--hud-pad-b`, which includes `env(safe-area-inset-bottom)`. Size and look are set by CSS variables (`--stick-ring`, `--stick-knob`, colours), so Mario 64 keeps its larger stick and its A/B/Z glyph buttons, Minecraft keeps its own look, and the surface keeps its look. Move Earth, surface, Mario 64 and Minecraft onto it, plus the galaxy where it has a stick. Leave Prompt, Objective, Menu, Toast and Players out of the runtime. Those stay with each world's own Hud.jsx and follow the section-9 rules only where the genre fits. Mario 64 and Minecraft keep their canon pause menus and get no objective line or players chip.

### 63. GuideCue missing from seven first cards (medium)

Code: **partly**. Design: **make-adjusted**.

*Corrections:* GalaxySurface.jsx:583-589 is the combat guard/heat meter markup, not the landing card. The landing `.surface-title` card is at GalaxySurface.jsx:661-665. "19 first hints" is really 19 files; the total count of GuideCue tags is 24.

*The fix to make:*

Add <GuideCue /> (and <GuideCue touch /> on touch) only where a first hint or key list already exists:
- Cybertron: as a last line under the .cyw-keys list (GameWorld.jsx ~452), or after the lede on touch, where there is no key list.
- The trench run and Caribbean overlays: at the end of their existing keys/callout line.
- The galaxy surface: at the end of the landing card's text.

Leave the Mario 64 and Minecraft title screens untouched. Instead, put the cue in the first in-play moment: a one-line first-move hint shown after Start (in the world's HUD type, not on the logo screen), or in their pause menus, which they already have.

For Invincible, add it only once the world gets its first-move hint (the standard's item 2/3 work). Don't create a card just to hold the cue.

### 64. The surface offers the guide three ways (medium)

Code: **partly**. Design: **make-adjusted**.

*Corrections:* The GalaxySurface line numbers are stale. The Controls button is at :670, not :592 (:592 is the guard/heat meter). The H-key handler is at :466, not :407 (:407 is assault-mission scoring code). The other citations are accurate.

*The fix to make:* Make the rule "one guide, one visible button per screen", not "one way per world". (1) In Invincible, have Menu > Controls call the site's `openGuide` and delete the `iw-help` dialog and its duplicated key list. Move any Invincible-only lines (the pad mapping, the "Things to do" progress) into the guide's Invincible page in pages.js. (2) On the galaxy surface, remove the standalone "Controls" pill from `.surface-corner` and keep the corner "?". If that world later gets a Menu, Controls goes in it as a menu item that calls `openGuide`. Keep the H shortcut, and keep its `aria-keyshortcuts` hint wherever the action shows up. (3) Do not change the universe and galaxy panels, where GuideLink stands in for the hidden corner "?". (4) Do not remove keyboard aliases anywhere.

### 65. Six copies of the 2D fallback (medium)

Code: **partly**. Design: **make-adjusted**.

*Corrections:* - The finding says "six times" but cites seven files. The copy is actually in at least 22 files, so the count is far too low.
- CitadelWorld.jsx:1116-1130 is wrong. Those lines are the emote wheel and door UI; the fallback is at :1256-1265.
- EarthWorld.jsx:437-449 catches only the end of the button. The message is at :431, and Earth says "passport", not "cards".
- CompoundWorld's copy says "from the air", not "as cards".
- The other ranges are within a few lines.

*The fix to make:* Pull the shared state logic and button into one small component, for example `<NoWorld three={three} gl={gl} retry={retry} noun="compound" shown="from the air" />`. It owns the four-state sentence pattern, the retry handler (`if (!three.on) three.set('auto'); retry();`) and the canon labels "Try 3D again" / "Load the 3D" / "Turn 3D on", which stay as they are. Each world passes its own noun ("town", "compound", "office", "Shire") and its own way of being shown ("as cards", "from the air", "as stamps"), so the sentences read exactly as they do now. Add `three.hold.mb` to the held line everywhere it is available, which fixes the one real inconsistency. Keep the inherited `text-sm text-muted` / `btn-ghost` styling so each page's typography and colours still apply. Do not change the world's title or intro text around it, and do not change any world's wording beyond the MB addition. Source: AbqWorld.jsx:930-940, CompoundWorld.jsx:1134-1146, OfficeWorld.jsx:1190-1199, and the other files cited in finding 65.

### 66. No way to the universe map from inside a world (low)

Code: **partly**. Design: **make-adjusted**. Seen: S13.

*Corrections:* The RmWorld line numbers are out of date. The touch branch is at :1791, not :1678, and the RouterLink is at :1850, not :1733. "Desktop-only" is only partly true: a second "Back to the site" link at RmWorld.jsx:1926 (the rm-list-back link in the M list panel) shows on every device. Also, both "Back to the site" links go to "/", not to the universe map. Many other pages also have "Back to the site" buttons (Caribbean:171, Cybertron:194, Invincible:156 and others), but they seem to be in page hero sections rather than inside the 3D stage, and none of them goes to the map either. The core claim holds: from inside the stage there is no link to the universe map.

*The fix to make:* Add a "Universe map" item now to Invincible's existing Menu (InvHud.jsx, after "Think, Mark!"). Make it a router Link to the same target WorldSwitcher uses (`/universe/${here.id}`, via byPath), so it returns to this world's spot on the map. Don't add a separate map button to the other HUDs. Instead, list "Universe map" as a required last item in the shared Menu spec (section 9, item 2) so each world gets it when it moves to that Menu. On C-137, don't touch the wording of "Back to the site". Do take out the `touch ? … :` branch (RmWorld.jsx:1678/1732) that hides that link on touch, so phone players also have a way out. Keep WorldSwitcher below the stage as it is.

### 67. Title cards beside the brief (low)

Code: **partly**. Design: **make-adjusted**. Seen: S14.

*Corrections:* Two line references are stale. `.iw-card` is at InvWorld.jsx:752, not 711; line 711 is wind/stick code. `.surface-title` is at GalaxySurface.jsx:661-665, not 583-589; lines 583-589 are the combat heat/guard meters. The Cybertron reference (420-452) is accurate.

*The fix to make:* Leave Invincible's `.iw-card`, the surface's `.surface-title` and GalaxyIntro exactly as they are; they are title flourishes, not key lists. On Cybertron, keep the key legend on the `.cyw-start` click-to-play card, which stays desktop-only as now, and keep the card's title face and side picker. Stop writing the keys twice: build both the card's `dl` and the tour brief's `keys` from one Cybertron controls list, drawn with the shared `KeyTable`/`.guide-kbd` style if that sits within the card's look. That way the wording matches and the missing keys (Mouse, Click/F, E, M, Esc) also appear in the brief and the guide. Write it into the standard as: "a world may open with a title card; a click-to-play or pointer-lock gate may show the keys, taken from the same source as the brief/guide, never hand-written."

### 68. Eaglercraft’s half-hidden leave bar (low)

Code: **holds**. Design: **make-adjusted**.

*Corrections:* Small point: line 45 is the 10px font declaration inside .eg-chip, and that rule begins at line 44. The claim is otherwise accurate. "Only HUD that hides itself" was checked only roughly, with the opacity grep.

*The fix to make:* Remove the opacity 0.55 and the hover/focus-within rule so the bar is always fully opaque, and keep the existing rgba(0,0,0,0.6) box and white border. Keep var(--mc-font) (Press Start 2P) and do not switch it to Archivo or the generic chip font. Set it to a crisp integer multiple of its 8px grid, 16px (or at least 12px on narrow screens if 16px crowds the bar), and pad the chip so each button reaches at least 44px of tap height on touch while keeping the shared HUD's top/right inset. Keep the "Saved? Leave" confirm wording and the red .eg-sure state exactly as they are.

## Dropped findings

### 9. Seven retry words (medium)

Code: **holds**. Design: **reject**. I'd reject this one. The seven retry labels are not seven words for the same thing in a way a player would notice. Each one sits on a different game's end card, and the button's place and style already say "retry". Several of the labels are where the world's character comes through.

- "Fill the pipe again" belongs to the Shire's smoke-ring game.
- "Fly it again" belongs to the trench run, paired with its "Start the run".
- "Continue" under "Game over" is the Nintendo/Mario 64 convention (Mario64.jsx:303-305).
- The finding already keeps Minecraft's "Respawn" as canon. The Mario line has the same claim, and Gorgoroth's "Walk it again" is the same kind of label as the Shire's.

Replacing them all with a flat "Again" makes these worlds more alike and gives the player nothing. Nobody hesitates over "Fly it again". That is the same mistake as renaming a canon word.

Two of the seven are miscounted:
- "Try again" is cited without a file. Its only button use is Online.jsx:153, a network error retry, not a game end card.
- AssaultHud's "Start over" is a different action. It restarts the whole battle from a deploy screen where reinforcement posts are the main choice, so "Again" would be less accurate there.

Where a shared standard does pay off is in how the retry button behaves, not what it says:
- It is the primary button.
- It is first in the row.
- It gets focus when the card opens, so Enter or Space replays. ChaseHud does this through its "again" ref, and Mario 64 through autoFocus.
- It sits next to one consistent way out.

That is a behaviour check, not a word change, and these cards mostly pass it already. So item 7 of the standard should not hold "Again" for every world: it should say "Again" is the default, for games with no flavour word of their own.

### 11. Nine copies of the other-players chip (medium)

Code: **partly**. Design: **reject**. This is a code tidy-up, and players would see no difference. I opened the copies the finding cites (AbqWorld.jsx:590-598, CompoundWorld.jsx:970-983, TownHud.jsx:158-171, MusicWorld.jsx:346-356, InvHud.jsx:143). Every one already behaves the same way: nothing shows when online play is unavailable, a "See other X" button shows while offline, and "<b>n</b> X here" shows once online, with the singular and plural forms handled. Each copy is about 12 lines.

What actually differs between them is the flavour:
- The noun: drivers, players, travellers, listeners, Ricks, Mortys.
- The tooltip lore: a ghost Aztek, a hologram, a floating lamp, a pale Mark. A `noun` prop alone would drop this, so a shared `<Players>` would need a second and third prop for it.
- The chip styling: each copy uses its own world's chip class (abq-hud-chip, cw-chip, shire-chip, mw-chip).
- Where it sits: in Invincible it is a `role=menuitem` inside the one Menu, which is the reference shape. Elsewhere it sits in the HUD's chip row.

The nine CSS classes are not nine looks for one thing. They are how the chip borrows each world's own chip styling, and they should stay.

A shared component would need noun, tooltip, className and wrapper/role props, plus a menu-item variant for Invincible. It would touch nine world files and save a few lines of trivial logic. No player-facing problem is fixed: no readability issue, no layout issue, nothing inconsistent in how the chip behaves, and no wrong word. The only small mismatches (a `<p>` versus a `<span>`, a missing `data-on` in the music courtyard) can't be seen in play.

A strong game-UI designer would spend this effort on the findings that change what players see: the touch sticks, the prompt word order, the toast positions. The audit already lists the players chip in its standard (section 9, item 3) as "one players chip". The right time to fold it in is when a world moves to the Invincible-shaped Hud.jsx and the chip goes into its Menu. A standalone refactor ahead of that is churn.

Every world's face survives either way, because the words, lore, class and placement stay per world. The change simply isn't worth making on its own.

### 20. Three loading styles (low)

Code: **partly**. Design: **reject**. The finding misstates its own evidence: section 3 counts 13 loading strings in 10 styles, and the code shows those styles are each world's face rather than drift. Shire uses Cinzel, Invincible uses 2rem Bebas in navy, Dot Matrix uses its pixel font (--dm-font), and Scranton uses Courier Prime. C-137 uses a cartoon paper chip with an ink shadow, Cybertron uses uppercase cyan on a radial glow, and Avengers uses wide uppercase tracking. The loading line is the first thing a player reads in a world, so it works as a title card, and section 9's standard says the world's face belongs on the title. One .world-loading style in runtime.css would turn every world's arrival into the same generic line, which is homogenising flavour for its own sake. Treating the class as a skeleton with per-world overrides wouldn't help either: the layout part (absolute, inset 0, centred grid, margin 0) is a one-line pattern, and the player would see no difference, so it's churn. The lines are also not hard to read: the smallest is the universe map's 0.78rem mono, which is above the standard's 0.7rem floor, and no HUD collides with a loading line. The 13 different strings are written for each world ("Clocking in at Dunder Mifflin…", "Walking into Hobbiton…"), so those should stay too. If a later spacing or readability pass finds a loading line that is actually hard to read, fix that one line in its world's CSS.

### 21. Several touch words for one action (low)

Code: **partly**. Design: **reject**. The different words are not one action named several ways. Each one fits what the player is doing in that world, and each matches that world's own desktop controls guide:
- **"Boost" for vehicles and flight.** Invincible flies a hero (`InvWorld.jsx:781`), and Cybertron is a vehicle with a visible boost bar (`GameWorld.jsx:488`).
- **"Faster" for Earth's plane.** It matches `pages/Earth.jsx:20`, "Shift or Space (A, RT) — Faster".
- **"Run" when on foot.** This is the galaxy surface. `UniverseMap.jsx:357` already switches between Run on foot and Boost in the ship.
- **"Up" means rise, not jump.** Avengers shows Up only in the suit (`CompoundWorld.jsx:782`), and Invincible uses it to climb while flying.
- **A and ⇧ are canon glyphs.** Mario 64's and Dot Matrix's A is the real controller button, and Minecraft's ⇧ follows its own glyph set. Renaming any of them to "Jump" would remove canon flavour that a game designer keeps on purpose.

A shared `TOUCH_WORDS` map would make every world use the same words for their own sake. It would get context wrong (a plane does not "Run", and flying "Up" is not "Jump"), and it would break the match between each world's touch labels and its own key guide. That match is the consistency players actually notice. `SurfaceView.jsx:9`'s `TOUCH` map is a different thing: it shortens long ability names to fit the thumb buttons inside one world, not across worlds. Nobody switching worlds is confused by "Faster" in a plane and "Boost" in a car, so the change is churn with no gain the player can see.

### 39. Two systems for the HUD’s top offset (medium)

Code: **partly**. Design: **reject**. The two "systems" exist because the worlds are built differently, and the finding treats that as inconsistency. The galaxy surface is a full-screen page (`surface.css:6-10`: `height: 100svh; overflow: hidden`), so measuring its HUD from the nav is correct. The audit's own scope line, "every world that is not full-screen", already leaves it out. That leaves Earth. Its stage is a full-bleed `100svh` globe in deep space (`earth.css:17-24`), and the space running under the glass nav is part of how the world looks. The padded model would shorten the stage and put a band of page background above the globe, which is a loss the player sees in exchange for a gain they don't.

The offsets the player sees are already nearly the same. Earth's title sits about 17-26 px below the nav (4 px + `clamp(0.8rem,2vw,1.4rem)`), against 12-20 px in the padded worlds. When the nav slides away (`index.css:634`), Earth shows more globe above the title. A padded world shows a strip of page background above its stage. Neither is a defect. Restructuring Earth to remove a difference nobody notices is churn, not a fix. A strong game-UI designer would not cut the edges of the orbit view to tidy up the CSS. The real spacing work belongs in the shared `--hud-pad` token from section 9 item 4, when those tokens land. At that point Earth's top row can take `top: var(--nav-h)` plus the shared pad, and its full-bleed stage stays as it is.

### 40. Compass strips at three heights (low)

Code: **holds**. Design: **reject**. These are three different compasses in three separate worlds, and nobody sees two of them at once. Invincible's is a 46px strip that follows the measured bottom of its wrapping buttons (--iw-under). The galaxy surface's is a 40px masked bar that sits under the site nav. On phones it drops to nav + 82 so it clears the .surface-where and .surface-corner chips. Cybertron's is a single amber arrow with a label. It sits at 16px because nothing else is top-centre in that world. Its boss bar at 74px sits under the arrow on purpose. Each height comes from what sits above that compass in its own world. That is the rule section 9 asks for: stack under the top row and clear it. A player in one world never compares the gap with another world, so the 'three heights' gain is invisible. Adding a shared --hud-strip token would mean rewriting three working layouts. It would also risk Invincible's measured stacking and Cybertron's compass and boss-bar pairing, for consistency that exists only in the code. The real standard is already covered by finding 1, 'measured stacking under the top row', and by the shared spacing tokens. A compass-height token on top of that adds churn without player-visible gain. If the surface page is ever moved onto the shared Hud, its compass should follow the measured bottom of its top row, as Invincible does. That belongs to that migration, not to a cross-world token.

### 41. The tour offer on game routes (low)

Code: **refuted**. Design: **reject**. The overlap the finding describes cannot happen, so a player would see no difference. The offer card is styled in src/components/tour/offer.css:4-8, not tour.css:57-60. It only appears where offerHere() in src/lib/tour.js:18-23 is true, which is the universe map and the feed pages (home, experience, projects, resume, contact, travel). The comment in that file says it never appears in a world. TourHost.jsx:95-111 hides it as soon as the path stops qualifying ("leaving for a world takes it down"). So it is never on screen at the same time as Dead Man's Tide's chart (tide.css:42) or Cybertron's health bars (game.css:36). Giving the offer a separate position for game routes would be dead CSS and churn. The finding says the offer already moves to the top 'on the universe', but it doesn't: on the map it moves up to bottom: 128px, and it only goes to the top on phones. That misreading is part of how the false conflict came about. Nothing about the worlds' title or number fonts, colours or character is involved.

### 51. C-137’s rectangular map (medium)

Code: **partly**. Design: **reject**. Nobody playing is hurt by this. C-137's map (src/components/rickmorty/world/RmWorld.jsx:1649-1652, world.css:79-81, 285-286) is already one of the better minimaps on the site. It is drawn at 2x (MAP_PX = 2), so it avoids the softness that finding 50 reports for the three round 150 px maps. Its frame is the world's own chunky style: a 2 px --rm-ink border, a 14 px radius and a hard 0 3px ink drop shadow, matching the .rm-chip buttons. It shrinks properly on phones (124x84). Its caption shows the current place name, a cue the round maps lack. A wide rectangle also suits a world that is wider than it is deep. Making it a circle would crop the corners of that wide map, lose the place caption or force it somewhere else, and remove one of the world's cartoon cues, all to make it match a count of other worlds ("five to one"). That is matching for its own sake. The standard in section 9 does not require one minimap shape. It asks for one tested layout, measured stacking and canvases drawn at device pixel ratio, and C-137 already meets the last of these. The real minimap problems are elsewhere: the soft 150 px canvases (finding 50) and the hand-summed positions (finding 32). If anything is shared here, it should be how the map is sized and stacked, not whether it is round or rectangular.

### 58. The surface’s thumbs not level (medium)

Code: **partly**. Design: **reject**. The proposed fix would make things worse for the player. On the surface page the site's "?" guide button stays visible. It sits at right 16 px, bottom 22 px + safe area, and is 42 px tall (src/styles/extras.css:958), so its top edge is at about 64 px. The button grid's 74 px bottom offset (src/components/galaxy/surface/surface.css:294) is what keeps the grid clear of that "?" button, with a 10 px gap. That is the --guide-reserve clearance the audit's own section 9 item 6 asks for ("right column reserving --guide-reserve", 16 + 42 + 0.9 rem, about 72 px). If the buttons' bottom moved down to --hud-pad-b, the bottom-right 64 px button would sit on top of the "?" button and steal its touches. Having the thumbs at different heights is also not a real fault here. The right side is a tall two-column grid, and the right thumb rests near its middle (where the 2-row Use button sits), not at its bottom edge. Raising the stick to 74 px to level them would only push the left thumb higher for no gain. Renaming 74px to var(--guide-reserve) would change nothing the player sees, so it belongs in the shared-token refactor if that happens, not in a fix of its own. Nothing here touches the world's face: no title, number font or colour is involved.
