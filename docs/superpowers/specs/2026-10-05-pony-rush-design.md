# A busy night at the Pony: the co-op rush (design)

## Intent

The user, after Bree landed: "keep making the other towns and stuff in the
story … Basically this will be our online overcooked like game."

So the Middle-earth journey becomes an online co-op game in Overcooked's
mould. Each town keeps its walk-about story, and gains a **rush**: a busy
kitchen (or forge, or feast) where one to four friends race the clock,
cooking and serving together, online from any network. Bree's comes first:
the Prancing Pony on the night the hobbits arrive, with Butterbur shouting
for Nob and Bob and the common room crying out for pints, stew and bread.

Success:

- Two browsers on different networks join one room by a four-letter code or
  an invite link and play the same rush, each moving their own hobbit with
  no felt lag.
- Solo works the same, with no network at all.
- A round is three minutes, has a score and one to three stars, and needs
  the Overcooked loop: fetch, prepare, cook, plate, serve, wash up, with
  things that burn and customers who leave.
- Phones work: a stick and two buttons.

## The rush (any town)

A level is a grid of one-metre tiles: floor, counters and stations, in a
room seen from above at a fixed angle, Overcooked-style.

- **Hobbits.** Frodo, Sam, Merry, Pippin (one per player, in that order).
  Walk on the floor (4 m/s), dash (a short burst, with a cooldown), and face
  the way they walk. The tile in front of you is the one you act on.
- **Grab** (E, Space; the A button; the touch Grab button): pick up, put
  down, or combine what you hold with what's there.
- **Work** (hold F; the X button; hold the touch Work button): chop at a
  board, wash at the tub, scrape a burnt pot.
- **Items** are things with a state: a mug (clean, dirty, ale), a bowl
  (clean, dirty, stew), a carrot or potato (raw, chopped), dough, a loaf
  (baked, burnt).
- **Stations:** crates and shelves hand things out; counters hold one thing;
  a board chops; the pot cooks three chopped vegetables into stew and burns
  it if left; the oven bakes dough and burns it if left; the tap fills a mug
  and spills over if left; the tub washes dirty mugs and bowls; the bin takes
  what you don't want; the serving counter takes finished dishes.
- **Orders** come in at intervals (faster with more players), each with a
  patience bar. Serving a match pays a price and a tip for speed; a lapsed
  order costs coins. Served mugs and bowls come back dirty a few seconds
  later.
- **A round** is 180 s. Stars at three coin totals, per level.

## The Pony's level

The Pony's kitchen and bar, 12 × 8 tiles: the tap (a barrel), the hearth
with its stew pot, the bread oven, the chopping board, crates of carrots
and potatoes, the dough tub, the mug and bowl shelves (a few of each, so you
have to wash), the wash tub, the bin, and Butterbur's counter to the common
room, where served things go and dirty ones come back. Orders: a pint, a
bowl of stew, a loaf. Butterbur's lines call the orders ("Nob! Two pints for
the corner!") and cheer or grumble.

Reached from the Bree chapter: a section under the town ("A busy night at
the Pony"), and a button in the Pony's common room panel. An invite link is
`#/middle-earth/bree?rush=ABCD`.

## Online

- Rooms over the public Nostr relays the universe's multiplayer already
  uses (`universe/online/nostr.js`: signed, ephemeral, no server of our
  own). App id `tilakpatel-portfolio-rush`, room `pony-ABCD`.
- **The host** (whoever made the room) runs the round: orders, items,
  stations, coins. Everyone else sends input; the host sends the state ten
  times a second.
- **Your own hobbit is yours**: you move it locally and send where it is, so
  walking has no lag; the host only checks the speed is believable. Grabs
  are requests the host applies in order and answers with the next state
  (a pickup shows within a few hundred milliseconds). Work is a held flag
  the host reads while you stand at the station.
- Up to four players; a fifth is told the room is full. A player who goes
  quiet for ten seconds is dropped and whatever they held is put down.
- If the host leaves, the round ends for everyone, with the score so far.
- Rate limits and size limits on everything received, as the universe does.

## Code layout

- `middleearth/rush/rules.js`: pure, tested. Level parsing, movement and
  collision on the grid, items and stations, grab and work, orders, coins,
  the round clock. `newRush(level, players)`, `stepRush(state, inputs, dt)`
  → events.
- `middleearth/rush/net.js`: the room. Host and guest roles over
  `joinRoom`, messages, limits. `protocol.js` (pure, tested) for reading and
  writing them.
- `middleearth/rush/scene.js`: three.js. The room from the level's tiles,
  the stations, the hobbits, the items, progress rings, the camera.
- `middleearth/rush/Rush.jsx`, `rush.css`: lobby (alone / make a room /
  join), the HUD (orders, coins, clock), results, touch controls.
- `middleearth/rush/levels/pony.js`: the Pony's tiles, recipes, timings,
  stars and lines.

Later towns add a level file each (the Shire: Bilbo's party; Rivendell:
Elrond's table; Moria, Lothlórien, Mordor, each their own) and reuse the
rest.

## Not in this round

Throwing items, plates on plates, moving hazards, levels beyond the Pony,
voice or chat, saved high scores across visitors.
