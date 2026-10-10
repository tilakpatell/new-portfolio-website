# Outlaw: harder enemies, a law that hunts you, bosses: design

Date: 2026-10-06. Status: written from the user's request; built in parts,
each its own PR, merged as they land.

## Intent

What the user said: "The games and general NPC AI needs significant
improvement and also we need it so the enemies are harder (different types
etc and bounty system and other stuff like rdr2 and make it hard yk, space
cops etc). That being said dont change targetting stuff more like
difficulty and bosses and stuff throughout the universe and galaxy."

What that means here:

- Enemies in the universe map and the galaxy fight like pilots, not like
  turrets on rails: better shots, they break when you line up on them, the
  good ones work together, and there are more kinds that each want a
  different answer (a missile boat, an ion enforcer that slows you, a
  rammer, a medic that patches the pack, a sniper).
- A law that hunts you, after Red Dead Redemption 2 and GTA: a crime seen
  by the law (or reported by a witness who gets away) puts stars on you and
  a bounty on your head. Stars bring the space cops, harder the more
  stars. Break their line of sight and they search where they last saw
  you; stay hidden long enough and the stars go. The bounty stays: it
  brings bounty hunters until you pay it off.
- Bosses: at the top of the wanted scale, and as bounty targets, named
  bosses with phases, escorts that shield them, and attacks of their own.
- A difficulty setting, defaulting to a fight harder than today's.
- Out of bounds: `targeting.js` (lock-on, aim assist, nose tracking) and
  how the player's own guns aim are not touched. Enemy AI may call its
  pure helpers (`intercept`, `sweptHit`, `nose`) as it already does.

## Decisions

Made for the user, who asked for this without checking in.

- **One engine, more rules.** `hunterRules.js` stays the one flight and
  fight engine for both maps. New behaviour is a pilot `skill` (a tier
  that scales lead, scatter, rate of fire, reaction, evasion) and new
  `traits` the engine reads, all pure and tested. A kind may now list
  several traits (`traits: [...]`); the old single `trait` still works.
- **Difficulty is a flight setting** (`controls.js`, kept with the rest at
  `tp-universe-controls`), so both maps read it with no new storage:
  `story`, `normal` (default), `hard`, `outlaw`. `difficulty.js` (pure)
  turns it into numbers: the skill tier a pack flies at, the damage of
  their shots, pack size, how long the law searches, how fast shields
  come back.
- **Wanted is its own pure module** (`wanted.js`), next to `standing.js`.
  Standing stays what the universe thinks of you over time; wanted is the
  chase happening now, plus the bounty that outlives it. Stars and the
  search are kept for the visit; the bounty is kept per side at
  `tp:universe-wanted`.
- **Witnesses.** A crime the law sees counts at once. One only civilians
  see starts a report: a few seconds while any of those ships is still
  near; shoot it or leave it behind and the report dies with it.
- **Space cops are a faction role, `police`, in `sides.js`**, with kinds
  of their own drawn with existing models (`model:` alias, so no new
  downloads): the Empire's ISB patrol, enforcers and a missile gunboat;
  the Federation's police cruisers, enforcers and wardens; Albuquerque PD,
  DEA enforcers and a SWAT truck.
- **Credits come from the site's wallet** (`economy.js`, which landed on
  main meanwhile): kills of the law pay nothing; landing with no stars on
  you pays the bounty off out of the wallet (`spend`) if it covers it. The
  loop: be an outlaw, then go hunting to clear your name. `law.js` is the
  scene's glue (crimes from the deeds already noted, witnesses from
  `traffic.near`, police by stars, bounty hunters by the bounty).
- **Bosses use the ace `stages` that exist**, plus a `guarded` trait (no
  damage while its escort lives), a `salvo` trait (a spread of missiles),
  and a HUD bar for the boss in the fight.

## Parts (one PR each)

1. **Enemy AI.** `hunterRules.js`: skill tiers; evasion (a pilot you line
   up on breaks off its line: jinks, more often the better it is);
   tighter run slots for skilled packs; new traits `missile` (a homing
   missile that can be out-turned or outrun), `ion` (a hit slows you and
   drains the boost), `rammer` (straight in, bursts close), `medic`
   (patches the most hurt of its pack), `sniper` (long range, slow, true).
   Per-kind `damage`. `difficulty.js`; difficulty in the flight settings;
   scene passes it in and plays the new laser kinds (ion, missile, ram).
2. **Wanted and bounty, universe.** `wanted.js` (stars, pursuit/search,
   witnesses, bounty, pay off from the wallet, law response by stars);
   `police` factions and their kinds in `sides.js`; scene wiring (crimes
   from the deeds already noted, cops dispatched by stars, the search,
   pay off on landing); a HUD strip (stars, bounty, search);
   crew lines for being wanted, searched for, losing them.
3. **Bosses, universe.** A Most Wanted boss per side at five stars and as
   the top bounty: guarded phase, then the ace's own stages, salvos and
   summons; boss HUD bar; big payout.
4. **Galaxy.** Difficulty, wanted (the Empire as the law over its worlds,
   the Republic's over the Clone Wars'), bounty, bosses, and the
   ace `stage`/`summon` events the galaxy ignores today.
5. **The other games.** Smarter and harder enemies where they are
   weakest (map: Cybertron's world, the Middle-earth watchers,
   Albuquerque's Hank, Hold the Lawn and Repulsor Range): lead their
   shots, flank, search where they last saw you, alert each other.

## Testing

Every rule is pure and tested in Node with vitest and a seeded random, as
`hunterRules.test.js` and `standing.test.js` are. Each part runs the full
suite, lint and build before its PR; the scene changes are checked in
headless Chromium (see the HQ testing memory) through
`window.__universeDebug`.

## Done when

Pick any crew on the universe map, or fly the galaxy: shoot a patrol in
front of the law and the stars come up, the cops come harder with each
star, you can lose them by breaking sight and staying hidden, the bounty
stays and brings hunters until you pay it off, and at five stars the
side's Most Wanted boss comes for you. On `normal` a pack of veterans is
a real fight; on `outlaw` it is meant to kill you.
