# Squads, lobbies and allies that last: design

Date: 2026-10-08. Status: written from the owner's request by an
architecting session (Fable 5.1) after an audit of the whole game, for
Opus 5.5 implementation agents. Built in four pull requests (the plan:
`docs/superpowers/plans/2026-10-08-squads-and-lobbies.md`).

## Intent

What the owner said: “Architect a way to improve the multiplayer experience
in the game immensely. Audit the whole game and create a lobby system or
ally system and ways we can make it better.”

What the owner then chose, asked: the squad-centred design in four pull
requests; a pilot key kept in the browser; all three ways of talking
(quick-chat and pings, typed chat inside a squad, typed chat for
everyone); the build run by Opus 5.5 agents, each pull request merged to
main once lint, tests and the build pass.

## What the audit found

The multiplayer (`src/components/universe/online/`) works and is careful
about what it believes. What holds it back is that nothing lets two people
play together on purpose.

1. **Nobody is anybody for long.** The key a pilot signs with is made on
   every page load (`nostr.js`'s `visitKeys`). A reload makes a stranger of
   every ally; blocks and kills go with it.
2. **An alliance is two people for one visit.** There is no group, nothing
   a group shares (a target, a place to meet), and the only way to reach
   someone is one “Fly to” at a time.
3. **Everywhere is one public room.** The universe is `universe-v2` for
   everyone (32 pilots at most, `client.js`); each world is `${town}-v1`
   for everyone (24 at most, `travellers.js`). There is no way to play
   with a friend and nobody else.
4. **One game has a lobby, and it stands alone.** The Rush kitchens
   (`middleearth/rush/`) have a four-letter code, a host and four seats.
   They don't use the roster: no callsigns go over the wire, blocks don't
   hold, and when the host leaves the night is over.
5. **Nobody can say anything.** No chat, no ping, no emote between pilots.
6. **Nobody can find a game.** The roster says where people are, not what
   they are playing or whether there's room.
7. **Whole worlds are empty.** Cybertron, the Death Star's corridors, the
   Expanse's planets and the Galactic Assault have nobody else in them.
8. **The link is heavier and more fragile than it need be.** The universe,
   a world and a Rush room each open their own four WebSockets (twelve at
   worst). A blocked traveller still holds one of a world's 24 places. The
   war front's battle tally has no id of its own (`warfront.js`), so a
   reload may be counted as a second pilot. (Neither the siege's tally nor
   the battle's forgets a pilot who left, and neither should: forgetting
   folds a share into the floor and hides the new work of those who stay;
   a pilot back after a reload is matched by tally id instead.) The
   two-browser checks
   (`scripts/online-check.mjs`) need the public relays, so CI can't run
   them.

One fact shapes the answer: the site is usually empty. Multiplayer happens
when someone sends a friend a link. So one link has to do everything.

## Decisions

1. **The squad is the unit.** Up to four pilots, one of them the leader.
   A lobby is a squad that has picked something to play; a private game is
   a squad with an instance of its own. One invite link takes a newcomer
   online, into the squad and to the leader's side.
2. **Identity lasts, in this browser.** The pilot's key is kept in
   localStorage unless they turn that off. Allies and blocks are saved by
   key, so a name can't be borrowed. Nothing is kept anywhere else.
3. **The site's room stays public; only where you are goes private.** A
   pilot in a private game is still on the roster (so they can be invited,
   allied, talked to); their ship, shots and steps go to the squad's own
   instance, and the roster says “in a private game”.
4. **The leader decides, and anyone can become the leader.** Squad state is
   the leader's word, signed. If the leader goes quiet, the next seat takes
   over. Nothing in a squad is trusted further than the game already
   trusts a pilot.
5. **The economy stays local-first.** Nothing a peer says moves your
   credits. Squad play pays through `earn`, from what this browser saw.
6. **Typed words are untrusted text.** Cleaned, capped, links removed,
   shown as text nodes only. Everyone's chat can be switched off by the
   visitor, and by the owner in one line.
7. **No server, still.** Everything rides the relays the site already
   uses. A room is a topic; a private room is a topic nobody else knows.

## Design

New code lives under `src/components/universe/online/` in folders of its
own (`squad/`, `chat/`, `lobby/`) and `src/components/universe/arena/`.
Rules are pure modules with tests beside them; the links (`squad.js`,
`chat.js`) take an injected `load` and clock as `client.js` and
`travellers.js` do. `client.js` and `protocol.js` gain as little as
possible: both are near the size the health rules allow.

### Part 1: foundations (PR 1)

**One socket per relay (`online/pool.js`).** `relayPool({ relays,
WebSocket })` keeps one `relaySocket` per relay, shared by every room.
`joinRoom` asks the pool for a subscription (its own `REQ` id and filter)
instead of opening sockets; events come back by subscription id. The last
room to leave closes the sockets after a five-second linger, so a page
change doesn't reconnect. The pool is keyed by the WebSocket class and the
relay list, so tests that pass their own fake keep their own pool. A rate
limit from a relay holds back every room on that socket, as it should.
`joinRoom`'s interface does not change.

**A fake relay for the checks (`scripts/lib/fake-relays.mjs`).** Playwright's
`context.routeWebSocket` (already used by `online-check.mjs`'s `BRIDGE`)
answers every `wss://` with an in-process relay: `REQ`, `EVENT`, `CLOSE`,
events passed to every matching subscription in every context. `RELAY=fake`
on `online-check.mjs`, `flyto-check.mjs` and the new `squad-check.mjs` uses
it, so the two-browser checks run with no network.

**The key that lasts (`online/identity.js`).** `pilotKeys({ saves })` reads
a secret from `tp-pilot-key` or makes and stores one; `visitKeys()` returns
it. A switch in the roster, “Remember me on this browser” (on by default,
`tp-pilot-remember`), and a “New identity” button that makes a fresh key.
With the switch off, or storage unavailable, the key is per visit as today.
A second tab of the same browser would sign as the same pilot; a
`BroadcastChannel('tp-pilot')` roll-call lets the later tab find that out
and fly on a key of its own for the visit (“You're online in another tab:
this one flies as a guest”). The join card's small print changes from “made
fresh for each visit” to say what is kept.

**Allies and blocks that last (`online/allies.js`).** A pure store over
`runtime/saves.js`: `tp-allies` (version 1, `{ [id]: { name, since, seen }
}`, 64 at most) and `tp-blocked` (`{ [id]: { name, at } }`, 128 at most).

- An alliance made is saved by both pilots. When a saved ally's hello
  arrives, the client asks again with `ally { t: 'ask', k: 1 }`; a client
  that has the asker saved accepts without a prompt, so two allies are
  allies again a moment after both are online. One that doesn't shows an
  ordinary request. A `no` or an `end` removes the pilot from the store.
- A block is saved; a blocked pilot's hello makes a peer that starts
  blocked. `travellers.js` asks `hidden(id)` before it gives someone a
  place, so the blocked don't fill a world.
- The roster gains an “Allies” section above everyone else: those online
  first, then those saved and away (“last seen 3 days ago”, from `seen`,
  with Remove).

**What the audit found broken.** The battle tally gets a tally id kept
with the battle's save (`warfront.js`), after a failing test shows the
double count, and the siege's gets one too (`siege.js`): a key that lasts
makes a reload the same peer id, and only an id and shares kept in a save
count a pilot back after a reload once, their new work on top of the old.
Nothing forgets a pilot who leaves: forgetting folds a share into the floor
and hides the new work of those who stay. The stale `./net.js` comment in
`rush/protocol.js` goes.

### Part 2: squads and talking (PR 2)

**The squad's room.** A squad is a secret, `sid`: twelve letters from the
Rush alphabet (`rush/protocol.js`'s, moved to `online/squad/invite.js`).
Its room is app `tilakpatel-portfolio-squad`, room `sq-` and the first 24
hex digits of SHA-256 of `tp-squad-room:<sid>`, so the relays see a topic
that doesn't give the secret away. Every message in it is
signature-checked (none is frequent).

| Message | From | Carries |
|---|---|---|
| `st` | the leader, every 2 s and on change | `{ e: epoch, v: version, l: leader id, m: [member ids, in seat order], x: [ids turned out], o: open 0/1, r: rally or null, lb: lobby or null, i: instance or null }` |
| `hi` | everyone, every 3 s (1.5 s till seated) | `{ n: callsign, k: ship, w: where, sh: shields, lv: level, rd: ready 0/1 }` |
| `bye` | a member leaving | nothing |
| `pg` | anyone | a ping: `{ k: 'go' / 'help' / 'foe' / 'look', w: where, p: [x, y, z, sector?], t: target id? }` |
| `qc` | anyone | a quick-chat phrase id |
| `ch` | anyone | sealed text (below) |

**The rules (`squad/squadRules.js`, pure).** `squadStep(state, event, now)`
over events `hello`, `state`, `bye`, `tick`, and the local `invite`,
`leave`, `kick`, `rally`, `open`.

- *Seating.* The leader seats a `hi` from a pilot who isn't turned out and
  isn't blocked by the leader, while a seat is free (four at most).
- *Away and gone.* A member quiet for 10 s is away (their seat held, shown
  dimmed); quiet for 45 s, or a `bye`, and the leader frees the seat. A
  reload with a kept key comes back to the same seat.
- *Handover.* A member who hasn't heard the leader's `st` for 8 s looks at
  the seat order: the first member heard within 6 s is the new leader. If
  that's them, they raise the epoch and send `st`. A `st` is believed from
  the leader on record, or from a member on record with a higher epoch
  once the old leader has been quiet for 6 s. Two claims at one epoch: the
  lower seat wins. A leader who comes back finds a higher epoch and is a
  member again.
- *Turning out.* The leader may turn a member out; their id goes in `x`
  for the squad's life.

**Getting in.**

- *A link.* `https://tilakpatell.com/#/?squad=<sid>` (`invite.js` makes
  and reads it). `OnlineProvider` reads the parameter on any page: someone
  not online gets the join card saying “<callsign> asked you to fly with
  their squad” with the callsign field; then, or at once for someone
  online, the squad is joined, the parameter is dropped from the address,
  and a toast offers “Go to <leader>” (the roster's Go: a page change, and
  `follow(leader)` where the place is flown in).
- *The roster.* Each row has “Invite”: a signed `inv { s: sid }` to that
  pilot in the site's room (rate `[0.2, 2]`). They get a feed line and a
  row badge with Join and No; a No holds for 60 s, as an alliance's does.
  Inviting with no squad starts one. “Start a squad” does the same and
  shows the link with the house `CopyButton` and the share sheet.
- *Staying in.* The `sid` is kept in sessionStorage (`tp-squad`), so a
  reload rejoins and closing the tab leaves.

**What a squad changes.**

- `client.setSquad(ids)`: squadmates are allies for everything the game
  asks (`hit` isn't sent at them, `hitCounts` refuses theirs, tags and
  roster rows take the ally colour with a squad mark).
- **The strip (`squad/SquadStrip.jsx`).** A row per squadmate where the
  page's HUD has room (the universe map, the galaxy, a world's surface,
  and floating over every other page): face, callsign, shield bar, where
  they are (“here”, or the place's name), the distance when they're flying
  where you are. A press opens the roster on them; Fly to and Go are on
  the row. Away is dimmed; the leader has a mark.
- **Edge markers.** Squadmates come first among the `.universe-mate`
  arrows on the map and in the galaxy.
- **Rally.** The leader's “Rally here” puts `r: { w, p }` in the state.
  Each member gets one toast, “<leader> rallies at <place> · Go”; with
  “Follow the leader” on (a switch each member holds, off by default), a
  three-second toast with Cancel and then the same Go.
- **In the worlds.** `useTravellers` takes `mark(id)` → `'squad'`,
  `'ally'` or null and `ghosts.js` colours the name tag by it.
- **Pay.** `EARN.assist` (10 credits, 5 xp): a squadmate downs a hunter or
  a pilot while within `GUARD.range` of you, as this browser saw it.

**Talking (`online/chat/`).**

- *Pings.* A key (and a strip button on touch) pings the locked target,
  or the point 60 units ahead; on foot, where you stand. Drawn for 12 s as
  a marker in the scene and an edge arrow when off screen, with the
  pinger's name and the kind. Flight scenes first (the map, the galaxy),
  then the galaxy's surfaces and the worlds' ghosts (“here” only). One a
  second, three at once.
- *Quick-chat.* Sixteen phrases in `chat/text.js` (`PHRASES`: “Hello”,
  “Follow me”, “On my way”, “Need help”, “Attack my target”, “Cover me”,
  “Regroup”, “Nice shot”, “Thanks”, “Sorry”, “Yes”, “No”, “Watch out”,
  “Truce?”, “Let's go”, “Good game”), sent as an id, shown as a bubble on
  the pilot's tag or ghost for four seconds and as a line in the chat. To
  the squad when in one and the squad channel is picked; else to the
  site's room (`qc`, rate `[1, 3]`), shown to those in the same place.
- *Squad text.* `ch { c }`: up to 200 characters, sealed with AES-GCM
  under a key from HKDF(SHA-256, `sid`, `tp-squad-chat`) (`chat/seal.js`,
  WebCrypto), a fresh 12-byte nonce each. The relays carry ciphertext.
- *Everyone's text.* `say { t, s }` in the site's room: up to 160
  characters, `s` 0 for here (those in the same place show it) or 1 for
  all. Signature-checked, rate `[0.5, 3]`; the same words three times in
  30 s are dropped; a flood mutes, as today.
- *What may be shown (`chat/text.js`'s `cleanText`).* Control and
  direction characters out, spaces collapsed, the cap applied; anything
  that reads as a link becomes “[link]”; a word `names.js` calls rude
  becomes “•••”. Text goes on the page as text nodes, never as markup.
- *Switches.* “Everyone's chat” in the roster (`tp-chat`, on by default
  once online); a row's “Mute” hides one pilot's words without blocking
  their ship; a block hides both. `CHAT.everyone` in `chat/text.js` is the
  owner's switch: false, and `say` is neither sent nor shown.
- *The panel (`chat/Chat.jsx`).* Above the online pill: tabs Squad, Here
  and All, the last 50 lines (kept in memory only), a field, the quick-chat
  grid. Closed, the newest three lines show for six seconds each. A key
  opens it in a scene; the field keeps its keys from the scene.

Keys are chosen in the plan against each scene's bindings (the map already
uses G, E, P, M, J, V, F, R, T, Q and 1 to 3) and go in the guide.

### Part 3: lobbies and private games (PR 3)

**Instances.** The squad's state carries `i`, an instance id (ten hex
digits of SHA-256 of `<sid>:<n>`, `n` counting the squad's games) or null.

- `client.setInstance(i)`: the client's actions split into the site's
  (`hi`, `ally`, `war`, `inv`, `say`, `qc`), which stay in `universe-v2`,
  and the place's (`pose`, `foot`, `walk`, `shot`, `hit`, `down`, `pack`,
  `hhit`, `siege`, `fight`, `cur`), which go to the room `universe-v2+<i>`
  while an instance is set. With none set, the place's room is the site's
  room, the same object, so public play is unchanged, byte for byte. On a
  switch every peer's poses, shots, crews, hunters and pointers are
  cleared.
- The hello gains `i: 1` while in one. The roster says “in a private
  game” for such a pilot and offers no Fly to.
- `useTravellers` reads the instance from `useOnline()` and
  `createTravellers` names its room `${town}-v1+<i>`.

**The lobby (`lobby/lobbyRules.js`, pure; `lobby/Lobby.jsx`).** The squad's
`lb` is `{ a: activity id, o: options, ph: 'open' / 'count' / 'live' /
'done', c: ms left on the countdown, n: game number, sc: scores or null,
w: winner or null }`.

- The leader picks an activity and its options. Every member's card shows
  the seats (callsign, ship, level, ready), what will be played, and
  Ready.
- Start is the leader's: enabled when every seated member is ready, and
  after ten seconds as “Start without them”.
- `count` runs three seconds from `c` as each browser received it, then
  `live`: each member's page goes to the activity's route with the
  instance set. Someone who joins while it's live gets “In progress ·
  Join” if the activity allows latecomers.
- A handover mid-game keeps the lobby; an activity whose host ran the game
  (Rush) goes back to `open` for the new leader to start again.

**Activities (`lobby/activities.js`).** Data: `{ id, name, blurb, min, max,
kind: 'together' / 'versus', private, late, options, route(options) }`.

| Id | What | Route | Notes |
|---|---|---|---|
| `roam` | Fly or walk together, only the squad | where the leader is | private; latecomers welcome |
| `siege` | The Citadel's siege, as a squad | `/universe` | the siege's own tally, in the instance |
| `front` | A battle of the galaxy's war | `/galaxy/<system>` | option: the system; the battle's own tally |
| `rush` | A Rush kitchen | `/middle-earth/<town>` | option: the kitchen; four at most |
| `arena` | A dogfight (PR 4) | `/universe` | options: mode, arena, kills to win |

**Rush on the lobby.** `createSession` takes `names` (seat → callsign) and
the lobby's code (four letters from the instance id). In a lobby the
squad's leader hosts, the squad's seats are the kitchen's and the
callsigns show over the hobbits. Rush's own Host and Join, and old
`?rush=CODE` links, work as they do now.

**Open games.** The leader may open the squad (`o: 1`). The leader's hello
in the site's room then carries `g: { a: activity or null, n: members, m:
room for, s: sid }`; the roster lists “Open games” with Join. Closing it
stops the advert. Opening is the only way a `sid` is ever made public.

### Part 4: the arena, and the empty worlds (PR 4)

**The arena (`universe/arena/`).** `arenaRules.js` (pure), `places.js`
(three arenas to start: a name, a centre on the map clear of stations, a
radius of 400), `Arena.jsx` (the scoreboard and the end card).

- Modes: free-for-all (two to four) and teams (seats 0 and 1 against 2
  and 3; the leader may swap seats in the lobby). First to 3, 5 or 10.
- At `live`, each ship is set at its spawn point on the arena's rim,
  facing in, `safe` for three seconds. While the arena runs, the scene
  raises no hunters and no patrols on its pilots.
- The squad's no-friendly-fire holds within a team and is lifted between
  teams (in a free-for-all, for everyone).
- A kill is the victim's `down { b }`, signature-checked, from a member,
  naming a member the existing guard says had just fired on them. Every
  browser counts; the leader's count goes out in `sc` and is the score.
  Shot down, a pilot is back at their spawn after three seconds.
- Past the radius the HUD points the way back; eight seconds out counts as
  a death to nobody's credit.
- The leader's state names the winner (`ph: 'done'`, `w`). The end card
  has the scoreboard, Again (the leader's) and Back to the squad.
- Pay: `EARN.arenaPlayed` (20 credits, 10 xp) and `EARN.arenaWin` (60,
  30), once a game.

**Somebody in every world.** Cybertron, the Death Star's corridors, the
Expanse's planets (a room per seed) and the Galactic Assault each call
`useTravellers` the way Bree does, draw `createGhosts` and show the
`PlayersChip`. Minecraft, Mario 64, the trench run and the minigames stay
solo.

**Telling people.** The guide (`guide/pages.js`), the tours' multiplayer
steps, `data/todo.js` (squad up, host a lobby, win in the arena, say
hello), `docs/architecture.md`, and
`docs/superpowers/HANDOFF-squads-and-lobbies.md`.

### Not in scope

- Voice. A leaderboard. Reporting a pilot to anyone (there is no one).
- Moving a key to another browser or device.
- Splitting the public room by place (every pose still reaches everyone
  in `universe-v2`; instances take the squads out of it).
- More relays: the four in `nostr.js` were chosen by test. The pool shows
  how many are up; choosing new ones needs that test run again.
- Host handover inside a running Rush night.
- Other players inside Minecraft, Mario 64 or the minigames.

## Error handling

- Storage missing or full: the key is per visit, allies and blocks last
  the visit, and nothing throws (`saves.js` already never does).
- A squad link with a bad `sid`, a full squad, or one whose leader turned
  you out: a toast says which, and the pilot is online with no squad.
- No `st` heard within 15 s of joining by link: “That squad has gone.”
- A `st` that breaks the rules (not from the leader, a member list over
  four, an unknown activity, options outside the activity's lists) is
  dropped whole.
- Text that can't be unsealed, or cleans to nothing, is not shown.
- The instance room fails to open: the squad stays, the game doesn't
  start, the lobby says “Couldn't open a private game” with Try again.
- An arena whose leader leaves mid-game: the next seat's count becomes
  the score.

## Testing

- `pool.test.js`: two rooms share one socket per relay; each hears only
  its topic; the last leave closes after the linger; a relay down and back
  resubscribes both.
- `identity.test.js`: the key is kept and read back; the switch off gives
  a visit's key; a new identity is new; a second tab takes its own.
- `allies.test.js`, `client.test.js`: an alliance is saved and comes back
  on the next hello from both sides; a one-sided save asks; a block
  starts blocked; an end forgets.
- `squadRules.test.js`: seating, full, turned out, away and gone, the
  reload that keeps a seat, each handover case (the leader quiet, two
  claims, the leader back), and every malformed `st`.
- `invite.test.js`: links round-trip; junk reads as none; the room name
  doesn't contain the `sid`.
- `text.test.js`: each cleaning rule, the phrase ids, the repeat rule.
  `seal.test.js`: a round trip, a wrong key, a changed byte.
- `lobbyRules.test.js`: ready and start, the countdown, a latecomer, a
  handover while live. `activities.test.js`: every route is a route the
  app has; options stay in their lists.
- `arenaRules.test.js`: spawn points, a counted kill and each refused
  one, the boundary, winning, teams.
- `protocol.test.js`: the hello's `i` and `g`, `inv`, `say` and `qc`
  round-trip and junk reads as nothing. `client.test.js`: with an instance
  set, place messages go to the instance room and site messages don't;
  with none, one room as before.
- `scripts/squad-check.mjs` on the fake relay, three contexts: Alpha
  starts a squad, Bravo joins by link and Charlie by invite; the strip
  shows both; Alpha reloads and keeps the seat; Alpha leaves and Bravo
  leads; a typed line arrives clean and a link arrives as “[link]”; a
  private `roam` hides the squad from a fourth pilot; an arena game to 3
  ends with one winner on every screen.
- `online-check.mjs` and `flyto-check.mjs` pass with `RELAY=fake`.
- `npm run lint`, `npm test`, `npm run build` and `node scripts/health.mjs
  --check --skip build` clean before every merge.
