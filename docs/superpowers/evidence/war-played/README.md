# The war, played: evidence

What the checks of `docs/superpowers/specs/2026-10-10-war-played-design.md`
found, a folder a part.

## `bloom/` (part 1, the look)

A forced Battle of Endor in `/galaxy` at high quality, 1600×950, read
straight off the WebGL canvas (no HUD), from three places: a panorama from
behind the Rebel line, beside the defending flagship, and in the middle of
the dogfight.

- `*-before.jpg`: main before this part, the universe map’s bloom
  (threshold 1.7, strength 0.8, radius 0.55; three’s bright pass), from the
  session’s gap map (its measuring script, the same three views; the battle
  had run on to a different moment, so the ships are not where they are
  after).
- `*-after.jpg`: the galaxy’s own bloom (`galaxy/look.js`: a soft knee of
  0.5 round 1.4, strength 0.5, radius 0, the wide mips falling off), the
  bolts at one luminance a side (`battleFx.js`’s `GLOW`), the flashes faded
  to their rims. From `scripts/galaxy-bloom-check.mjs`.
- `after-numbers.json`: that script’s numbers, with the bloom on and off.

The darkest half of the pixels’ mean luma (a veil lifts it; 0 with no
bloom):

| View | Before | After |
| --- | --- | --- |
| Panorama | 0.033–0.044 | 0.0004 |
| Flagship | 0.036–0.055 | 0.0000 |
| Dogfight | 0.090–0.150 | 0.022 |

Pixels over 0.9 luma: 0.13%, 0.02% and 0.13% after (under 0.5% before
too: the trouble was never clipping, it was the veil). The dogfight’s 0.022
is the halos of the bolts nearest the camera, which fill much of that view.

## `respawn/` (part 2, back in the fight)

- `back.jpg`: from `scripts/galaxy-respawn-check.mjs` at Endor as the
  Rebellion, at mid quality: shot down in the battle (the page’s dev hook)
  and back under the hangar of the Rebel carrier nearest the line, facing
  the Empire (12 units from your own fleet, 187 from theirs), with the
  “Shielded” chip over the cluster. The check also saw a shot of your own
  end the shield.

## `deathstars/` (part 8, the Death Stars at Scarif and Endor)

From `scripts/galaxy-setpieces-check.mjs` at mid quality, as the Rebellion.

- `scarif-in.jpg`: the gate gone, the Death Star out of hyperspace over
  Scarif, its dish turned onto the planet (it was held away all through the
  battle, where before it cycled in every 150 s mid-fight).
- `scarif-fires.jpg`: the dish charging, about 18 s on.
- `endor-dish.jpg`: the second Death Star turned off its spin, its dish on
  the Rebel fleet (in the foreground), its shield up.

The Endor check goes on past this to the generator, the run and the
reactor. Its run fails at “in the tunnel” on this branch and on main alike
(main also fails the generator and the chamber); that’s the run’s, not this
part’s, and is left to the Yavin part, which reworks boarding in a war battle.
