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
  the stations, the hobbits, the items, progress rings, the camera. Each
  kitchen's look is a theme in `rush/themes/` (its sky and light, its room,
  its counters, its own stations over the shared ones in `themes/common.js`,
  its water, its moving extras); the things themselves are in `items.js`.
- `middleearth/rush/Rush.jsx`, `rush.css`: lobby (alone / make a room /
  join), the HUD (orders, coins, clock), results, touch controls.
- `middleearth/rush/levels/pony.js`: the Pony's tiles, recipes, timings,
  stars and lines.

Later towns add a level file and a theme each, and reuse the rest.

## Every chapter's kitchen

Each kitchen adds one thing of its own to the rules, so no two play alike:

| Chapter | Kitchen | Its own thing |
| --- | --- | --- |
| The Shire | The Long-expected Party (Bilbo) | Farmer Maggot's patch (`G`): mushrooms grow while you work; an oven with two recipes (seed-cake, mushrooms in the pan) |
| Bree | A busy night at the Pony (Butterbur) | The basics: chop, cook, bake, pour, wash |
| Weathertop | Supper on Weathertop (Strider) | Fires to feed (`fuel`): pans and spits burn down while they cook and stop when they're out; wood from the pile |
| Rivendell | Elrond's table (Lindir) | A stream through the kitchen, bridges over it |
| Moria | The forges of Khazad-dûm (Balin) | A channel of molten rock; crucibles and moulds |
| Lothlórien | Gifts for the Fellowship (Haldir) | Two flets over a drop; the leaf table (`L`), to wrap lembas |
| Amon Hen | Supper at Parth Galen (Aragorn) | The fishing line (`F`): hold Work till a fish bites; serving to the boats |
| The Dead Marshes | Herbs and stewed rabbit (Sam) | A thief (`thief`): Sméagol creeps up to coneys left on a counter and takes them, unless a hobbit gets there first |
| Cirith Ungol | The orcs' mess (Shagrat) | Webs on the floor (`,`): slow going, even at a dash |
| Mordor | The feast at Cormallen (Gandalf) | Carving tables (`A`): a platter put together from a roast, bread and herbs |

New kinds of thing go on the end of `KINDS` (and new states on the end of a
kind's list), and new events on the end of the wire's list, so a guest on
an older copy of the site can still play with a host on a newer one.

## Not in this round

Throwing items, moving platforms, voice or chat, saved high scores across
visitors.
