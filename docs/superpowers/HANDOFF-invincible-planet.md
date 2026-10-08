# Handoff: the Invincible planet (universe map)

Done in `src/components/universe/planets.js` (`BUILDERS.invincible`) and `scripts/build-invincible-planet.mjs` (now `scripts/planets/invincible.mjs`):

- New maps generated offline (`node scripts/planets/bake.mjs --only invincible`, ~20 s): `public/textures/universe/invincible{,-sm}.webp` (rust plateaus, dark sea beds, craters, rifts), `invincible-normal.webp`, `invincible-glow.webp` (molten rifts and vents), `invincible-night{,-sm}.webp` (city lights on the night side, through `airGlow`), `invincible-clouds{,-sm}.webp` (high dust bands). Registered in `PLANET_MAPS` / `FIXED` / `DATA`.
- Material with relief and a breathing molten glow, a dust shell, a debris belt (instanced rocks + faint dust disc), a broken moon with glowing cracks and drifting chunks, and two comet-like flyers with tapered trails and a periodic shockwave ring.
- Falls back to the old painted map if the textures don't load.

Not done (merged without a test run, at the owner's request):
- Run `npm run lint`, `npm test`, `npx vite build` and look at it in the browser (`/#/universe/invincible`).
- Tune: glow strength, dust opacity (`#f3d4b4`, alpha map), debris belt size vs. the halo, moon orbit radius (r × 2.15) against neighbouring planets.
- See also `docs/superpowers/HANDOFF-abq-city-and-invincible-planet.md` (on the Albuquerque city PR) for the city's remaining QA and phone performance.
