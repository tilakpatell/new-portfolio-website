# The planet skins, from orbit

Lane K (`docs/superpowers/plans/2026-10-10-bf2017-phaseK-planet-skins.md`), 2026-10-10. Each shot is `scripts/galaxy-check.mjs space <id>` at the default spawn, headless Chromium in software GL; `before` is the same build with `src/data/planetSkins.json` empty (the procedural look, byte for byte main's shader), `after` wears the game's maps.

| world | high | ultra | what it wears |
|---|---|---|---|
| Naboo | `naboo-high-{before,after}.jpg` | `naboo-ultra-{before,after}.jpg` | colour, relief, clouds; the lakes from the colour's smoothness |
| Endor | `endor-high-…` | `endor-ultra-…` | colour, relief, clouds, its air's colour (`#7c94b2`, from the atmosphere picture) |
| Bespin | `bespin-high-…` | `bespin-ultra-…` | colour |
| Kamino | `kamino-high-…` | `kamino-ultra-…` | colour, all of it sea; the site's storms over it |
| Geonosis | `geonosis-high-after.jpg` | | the rings only (the game's strip), behind the site's own asteroid field |

The counts, after against before (`galaxy-check`): draw calls unchanged on every world; textures +3 to +7; programs +0 to +1.

The bucket on 2026-10-10: 103 planet textures listed, 69 non-sequel fetched, all as PNG. What the maps are and why the rest stay procedural: `docs/superpowers/HANDOFF-bf2017.md`, lane K.

Not shot: a grazing sun (the relief's sign, `greenDown`, is unchecked); flying down to a skinned world (the skin's ease-out is unit-tested in `bodySkin.test.js`).
