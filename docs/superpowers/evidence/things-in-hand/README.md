# Things in hand: the evidence

What the checks of the things-in-hand work (`docs/superpowers/specs/2026-10-09-things-in-hand-design.md`) found, kept so a later session can see what each world's models could do before it was changed.

- `audit-<world>.md` and `audit-<world>.json`: `node scripts/cast-audit.mjs --world <world> --md … --json …`, one row a figure: its file and size, its bones by role (hips, both hands, toes, head), the vertices skinned to each hand (40 or more gives `held.js` a grip frame), the locomotion clips it carries or borrows, whether its walk's stride can be measured, what the world says it holds, and its warnings. The JSON is the same rows, for a script.
- `anim-<route>.json` (from W-B on): `node scripts/anim-check.mjs --held --talk` on a route: each held item's grip-to-palm distance and axis angle, a still carry's arm swing, an upright item's angle from the world's up, and per talker whether E's prompt and the body's reaction came.

Middle-earth's audit was taken first (W-A, before any world changed), the Rick and Morty and galaxy ones in their own waves.
