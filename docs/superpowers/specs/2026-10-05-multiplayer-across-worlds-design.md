# Multiplayer across the worlds and areas

## What's wanted

Multiplayer that works wherever you go on the site, not only in the places
that happened to get it. Today:

- The site has one link to the other visitors (`universe/online/client.js`,
  held by `OnlineProvider` above the pages) that carries the roster, the
  ships on the universe map and in the galaxy, the crews on foot, and the
  pointers on ordinary pages.
- Some walkable worlds open a room of their own for the people walking them
  (`middleearth/towns/travellers.js` through `useTravellers`, drawn by
  `ghosts.js`): the Middle-earth map, the Shire, Bree, Weathertop,
  Rivendell, Moria, Lórien, Amon Hen, the Dead Marshes, Orthanc, the Avengers
  compound and Albuquerque.
- The rest have nobody else in them: the Office (Scranton), the Invincible
  world, Cybertron, Dimension C-137, Dot Matrix island, Earth, the
  Caribbean, Cirith Ungol and Mount Doom.

And where it does work, the pieces don't know about each other:

1. **A new identity in every room.** Each room makes its own key, so the
   person in your Bree is a stranger to the roster: blocking someone in the
   roster doesn't hide them in a town, and nothing ties a ghost to a name in
   the list.
2. **Middle-earth is one place.** `whereOf` folds every chapter into
   `/middle-earth`, so the roster says "on Middle-earth" for someone in Moria,
   its "go there" button drops you on the map, and "is here" fires for
   someone in another town.
3. **Pointers over the worlds.** The page pointers (`Presence.jsx`) are drawn
   over the full-screen 3D worlds too, where a mouse position over a canvas
   means nothing, on top of the ghosts that do.

## Success

- Every walkable world has the others in it: go online, open any world,
  and anyone else in the same world shows up there as a ghost, with a
  "N here" chip in its HUD (or a "go online" chip).
- You're the same person in every room for the visit: a block in the roster
  holds in every world.
- The roster says exactly where each person is ("in Bree", "at Avengers
  HQ", "in Scranton") and its button takes you there, into that world.
- "X is here" means here: the same world or town.
- No page pointers drawn over a world that has its own ghosts.

## Design

### One key for the visit (`nostr.js`)

`joinRoom` takes a key; by default it's one made once per visit
(`visitKeys()`, module-level in `nostr.js`), so the site's room and every
world's room sign as the same pubkey and every peer id matches across them.
A test can still pass its own. Nothing else about a room changes: each is
still its own topic on the relays, its own `known`/`seen`, its own goodbye.

### Worlds honour the roster (`useTravellers`, `travellers.js`)

`createTravellers` takes `hidden(id)`; `list()` leaves those out.
`useTravellers` passes one that reads the site client's peers (`blocked`),
so a block in the roster hides that person's ghost too.

`useTravellers` also tells the site link a world is up (`online.inWorld`,
counted, so two at once don't fight), and `OnlineProvider` draws no page
pointers while one is.

### Exact places (`where.js`)

`whereOf('/middle-earth/bree')` is `/middle-earth/bree`; the map is still
`/middle-earth`. `placeName` names the chapter ("Bree", "the Shire",
"Orthanc"), and the roster's "go there" goes to the path, which opens that
chapter's world. The experience page's roles stay one place (the pointers
are on the same scrolling page).

### Every world gets ghosts

Each world without them calls `useTravellers(room, gl === 'on', opts)` the
way Bree does: sends its player's step from the frame loop
(`trav.ref.current?.pose(h, flags)`), draws `trav.ref.current?.list()`
through `createGhosts` in its scene, and shows the "N here" chip. Each world
picks a figure that fits (a person for the walkers, its own vehicle for one
you drive), `bound` for its size and `motion` where people fly or jump.

### Not in scope

- One socket per relay shared by every room (worth doing later: a world room
  opens four more WebSockets today).
- Anything shared between players beyond where they are (the co-op kitchens
  and the siege have their own rooms and messages already).

## Testing

- `nostr.test.js`: two rooms joined in one visit sign with the same pubkey;
  a passed key is used.
- `travellers.test.js`: `hidden` leaves a peer out of `list()`.
- `where.test.js`: Middle-earth chapters are places of their own and named.
- Each world: build, lint, and a two-browser check on the real relays (two
  Playwright contexts online in the same world see each other's ghost
  count go to 1).
