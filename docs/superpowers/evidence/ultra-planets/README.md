# Ultra planets: evidence

Screenshots from `scripts/galaxy-check.mjs surface` (the `*-landing-*` shots,
the landing view) and from a close-up script that holds the camera low over
each landing site through the dev server's `__surfaceScene.view` (`*-ground-*`
looking along the ground, `*-feet-*` looking down at it), at `QUALITY=high`
and `QUALITY=ultra`. Headless Chromium, SwiftShader (software GL): the counts
mean the same anywhere, the frame times don't. 960 px WebP.

## Counts at the landing

One frame's draw calls and triangles once the floor's light is baked (before
the bake the scene still runs its shadow pass, which adds hundreds of calls
for a few frames; Hoth and Endor were measured again with a 15-minute bake
wait so the frames counted are the settled ones).

| world | before, high | this branch, high | this branch, ultra |
|---|---|---|---|
| Tatooine | 76 calls · 0.82M | 76 · 0.82M | 76 · 1.70M |
| Hoth | 249 · 1.51M | 249 · 1.51M | 249 · 3.30M |
| Endor (settled) | — | 233 · 3.35M | 231 · 6.29M |
| Mustafar | 110 · 1.03M | 110 · 1.03M | 110 · 1.97M |
| Dagobah | 78 · 1.29M | 78 · 1.29M | 78 · 2.58M |
| Scarif | 107 · 1.45M | 107 · 1.45M | 107 · 2.84M |

"Before" is the commit this branch started from (27823667) on the same
machine; the original code at ultra drew exactly what it drew at high
(Tatooine 76 · 0.82M, Hoth 249 · 1.51M). High is unchanged on every world
(Endor's unsettled frames were 825 calls against the base's 894, both
caught mid-bake). Ultra adds triangles (the ground grid ×4, the grass ×2,
half as many props again, the sea ×2) at the same draw calls, well under
the ultra row's 1,500.

No page errors at either level on any of the six worlds other than the 403s
both runs share (resources the sandbox can't reach).

The `*-high` screenshots were taken before review moved the seating
(`seat.js`) and the cliff fade of the flat-laid scan to ultra only, so their
props sit seated as ultra's do; at high now, things stand as on main. The
counts are the same either way (neither changes a draw call or a triangle).
