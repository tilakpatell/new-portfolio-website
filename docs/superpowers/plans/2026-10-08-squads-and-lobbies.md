# Squads, Lobbies and Allies That Last Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let people play together on purpose: a pilot key that lasts, saved allies, squads of four joined by one link, pings and chat, lobbies that launch private games, a dogfight arena, and other players in the worlds that have none.

**Architecture:** Everything rides the Nostr relays the site already uses; a room is a topic. A shared socket pool makes extra rooms cheap. The site's room (`universe-v2`) stays public and carries who is online, invites and chat; a squad has a secret room of its own carrying leader-signed state; a private game moves a pilot's place messages to an instance room. Rules are pure modules with tests beside them; links take an injected `load` and clock.

**Tech Stack:** React 19, three.js, Vite, Vitest, ESLint, `@noble/secp256k1`, WebCrypto, Playwright (`playwright-core`, Chromium at `/opt/pw-browsers/chromium`). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-08-squads-and-lobbies-design.md`. Read it first; this plan argues from it and does not repeat it.

## Global Constraints

- Four pull requests, in order, each from a branch `claude/squads-<n>-<slug>` off `origin/main`, merged with a merge commit once `npm run lint`, `npm test`, `npm run build` and `node scripts/health.mjs --check --skip build` pass locally and CI is green. Merge, never rebase or force-push. A push to main deploys the site.
- Commits: one per task step that says “Commit”, the message a plain sentence saying what now holds (the repository's style: “The roster lists saved allies, online first.”). Authored as `Tilak Patel <108555753+tilakpatell@users.noreply.github.com>`. No `Co-Authored-By`, `Claude-Session` or “Generated with” lines in commits or pull requests.
- Where the workspace can't reach the npm registry (so no local Vitest, Vite or dev server), CI is the test runner: push the branch, open the pull request early, read the failing step's log with `gh api`, fix, push again. A pure module's test may be run locally through a throwaway shim kept outside the repository. Wherever a step below says “run” or “check by hand” and that can't be done, the pull request and the handoff say what was not seen in a browser.
- TDD for every pure module: write the test, see it fail, write the code, see it pass, commit. A test runs under a second and touches no network.
- Health rules (`docs/health/RULES.md`): a file stays under 800 lines; `x.js` has `x.test.js` beside it; no `TODO` notes; no new lint disables; worlds import the online code only through `src/components/universe/online/` paths already imported by `useTravellers.js`. `client.js` (619 lines) and `protocol.js` (571) stay under 800: new wire readers go in `online/wire2.js`, and when `client.js` would pass 760 lines its place handlers (Task 3.1's `wirePlace`) move to `online/clientPlace.js` with the same behaviour and tests.
- Everything a peer sends is untrusted: read through a `read*` function that returns null for junk, rate-limited by `createLimiter`, shown only as text nodes or `textContent`.
- Bundle: nothing new loads before a visitor goes online, except `invite.js`'s link reader (under 1 kB) in `OnlineProvider`. UI chunks are `lazy`.
- UI follows the house rules (RULES.md “UI”): tokens from `src/index.css`, `.btn`, `.chip`, `.switch`, `CopyButton`, 44 px targets on a coarse pointer, British spelling, curly quotes, sentence case, one sentence to a toast.
- Exact values from the spec: squad of 4; `sid` 12 letters of `BCDFGHJKLMNPQRSTVWXZ`; `st` every 2 s; `hi` every 3 s (1.5 s till seated); away at 10 s, gone at 45 s; handover after 8 s quiet, live means heard within 6 s; invite rate `[0.2, 2]`, No holds 60 s; ping life 12 s, rate `[1, 3]`; quick-chat rate `[1, 3]`, bubble 4 s; squad text 200 characters; everyone's text 160 characters, rate `[0.5, 3]`, same words three times in 30 s dropped; chat log 50 lines, closed lines show 6 s; countdown 3 s; “Start without them” after 10 s; arena radius 400, spawn safe 3 s, respawn 3 s, out of bounds 8 s, first to 3, 5 or 10; pay `assist` 10/5, `arenaPlayed` 20/10, `arenaWin` 60/30; allies 64, blocks 128; pool linger 5 s.
- Keys: chat `Y`, quick-chat `C`, ping `N`, handled by one window listener in `chat/keys.js` (not in the scenes), ignored while a field has focus or the visitor is offline. Before binding, grep each scene's key handlers; where a letter is taken on that page, that page uses the next free of `U`, `H`, `K`, and the guide says so.

## Review Focus

1. Two tabs of one browser with a kept key: the second must not sign as the first (Task 1.3 tests the roll-call; `squad-check.mjs` opens a second tab).
2. A squad link opened by someone who has never been online, on a phone: the join card must appear over any page and the squad must be joined after the callsign is given (Task 2.3 test “a newcomer joins after going online”; `squad-check.mjs` at 390×844).
3. Leader and one member both reload at once: nobody is left leading a squad of ghosts, and the squad re-forms with one leader (Task 2.1 test “both gone, both back”).
4. A pilot in a private game is asked to ally, invited, or blocked from the public roster: all three still work across the split (Task 3.1 tests for site messages with an instance set).
5. Typed text built to break the page or the owner's name: right-to-left overrides, 5,000 characters, markup, a link spelt with spaces (“example . com”), a rude word with digits (Task 2.5 tests each).

---

## PR 1: foundations (`claude/squads-1-foundations`)

### Task 1.1: one socket per relay

**Files:** Create `src/components/universe/online/pool.js`, `pool.test.js`. Modify `nostr.js` (`relaySocket` moves to `pool.js`; `joinRoom` uses a pool). Extend the fake in `nostr.test.js` to answer `CLOSE` (delete the subscription).

**Interfaces:**
- Produces: `relayPool({ relays, WebSocket, lingerMs = 5000 }) → { subscribe({ filter, onEvent, onChange }) → { send(eventJson), up(), close() }, sockets() → number }` and `poolFor(WebSocket, relays) → pool` (one per class and list, kept in a `Map`). Each `subscribe` gets its own `REQ` id (`tp1`, `tp2`, …), re-sent whenever a socket opens; `close()` sends `CLOSE` and, when no subscription is left, closes the sockets after `lingerMs`. A relay's rate-limit `OK false` holds every subscription on that socket for 10 s.
- `joinRoom(opts, roomId)` is unchanged for callers; it gains `pool` (default `poolFor(WebSocket, relays)`).

- [ ] Write `pool.test.js`: `two rooms share one socket per relay` (join two rooms on 4 fake relays; expect 4 sockets, not 8); `each room hears only its topic`; `the last leave closes after the linger` (fake timers; sockets still open at 4.9 s, closed at 5.1 s); `a room joined inside the linger reuses the sockets`; `a relay down and back resubscribes both rooms`.
- [ ] Run `npx vitest run src/components/universe/online/pool.test.js`; expect failures for a missing module.
- [ ] Implement `pool.js` and switch `joinRoom` to it.
- [ ] Run `npx vitest run src/components/universe/online src/components/middleearth`; expect every existing test still green.
- [ ] Commit.

### Task 1.2: a fake relay for the browser checks

**Files:** Create `scripts/lib/fake-relays.mjs`. Modify `scripts/online-check.mjs`, `scripts/flyto-check.mjs`.

**Interfaces:**
- Produces: `fakeRelays() → { attach(context) }`: `context.routeWebSocket(/^wss:\/\//, …)` answers every relay URL from one in-process relay per URL host. Handles `REQ` (store filter by subscription id), `CLOSE`, `EVENT` (answer `['OK', id, true, '']`, pass to every subscription in every attached context whose `kinds` and `#x` match, the sender's included). No signature check.
- `RELAY=fake` in the environment makes both scripts call `attach` on each context in place of `BRIDGE`.

- [ ] Implement, then run `npx vite --port 5173` in the background and `RELAY=fake node scripts/online-check.mjs --universe`; expect it to pass with exactly one other pilot seen. Run `RELAY=fake node scripts/flyto-check.mjs`; expect a pass. If either script fails for a reason that predates this work, record it in the handoff rather than changing the script's checks.
- [ ] Commit.

### Task 1.3: the key that lasts

**Files:** Create `online/identity.js`, `identity.test.js`. Modify `nostr.js` (`visitKeys` asks `identity.js`), `useOnline.js` (`remember`, `setRemember`, `newIdentity`, `guestTab`), `Online.jsx` (the switch, the button, the small print).

**Interfaces:**
- Produces: `createIdentity({ saves, keygen, channel }) → { keys() → { secretKey, publicKey }, remember (boolean), setRemember(yes), renew() → keys, guest (boolean) }`. Keys `tp-pilot-key` (hex secret) and `tp-pilot-remember` (`'off'` when off). `channel` is a `BroadcastChannel('tp-pilot')`-shaped object: on start it posts `{ t: 'who', id }` and a tab already online answers `{ t: 'here', id }` within 300 ms, on which this tab sets `guest = true` and uses a fresh key for the visit.
- `visitKeys()` returns `identity.keys()`; `setIdentity(identity)` is exported for tests.

- [ ] Write `identity.test.js`: `the key is kept and read back`; `the switch off gives a visit's key and removes the stored one`; `renew makes a different key and stores it`; `storage that throws gives a visit's key`; `a second tab takes its own key and says guest`; `a stored value that isn't 64 hex digits is replaced`.
- [ ] Run it; expect failures.
- [ ] Implement. In `Online.jsx`: a `.switch` “Remember me on this browser”, a quiet “New identity” link that asks once (“Your allies won't know you. Start again?”), the guest line, and the join card's small print now reading “Your callsign and a key for this browser are kept here, so allies know you next time. Nothing is stored anywhere else.”
- [ ] Run `npm test`; expect green.
- [ ] Commit.

### Task 1.4: allies and blocks that last

**Files:** Create `online/allies.js`, `allies.test.js`. Modify `client.js` (take `allies`, restore and save), `client.test.js`, `protocol.js` (`allyStep` unchanged; the `ally` reader keeps `k`), `useOnline.js`, `Online.jsx` (the Allies section), `middleearth/towns/travellers.js` and `travellers.test.js` (ask `hidden` before seating).

**Interfaces:**
- Produces: `createAllies({ saves, now }) → { isAlly(id), isBlocked(id), allies() → [{ id, name, since, seen }] newest seen first, saveAlly(id, name), seenAlly(id, name), dropAlly(id), block(id, name), unblock(id), on(fn) → off }`. Keys `tp-allies` and `tp-blocked`, version 1, registered with `saves.register`. Past 64 allies the least recently seen goes; past 128 blocks the oldest.
- `createClient({ …, allies })`: on a first hello from `allies.isAlly(id)`, `seenAlly` and `setAlly(p, 'ask')` with `{ t: 'ask', k: 1 }`; an incoming `ask` with `k: 1` from a saved ally is accepted without a feed line asking; `state === 'ally'` calls `saveAlly`; an incoming `no` or `end`, or a local `end`, calls `dropAlly`; `peerOf` starts `blocked` when `allies.isBlocked(id)`; `block()` saves and unsaves.
- `snapshot()` gains `away: [{ id, name, seen }]`: saved allies with no peer.

- [ ] Write the tests: in `allies.test.js` the store's round trip, both caps, a corrupt save; in `client.test.js` `two saved allies are allies again after both say hello`, `one-sided: the other sees an ordinary request`, `a no forgets the ally`, `a blocked pilot's hello starts blocked`; in `travellers.test.js` `a hidden traveller takes no place` (fill a town to `MAX` with hidden ids, then a visible one is still listed).
- [ ] Run them; expect failures.
- [ ] Implement, with the roster's “Allies” section (online first, then away with “last seen …” from `Intl.RelativeTimeFormat` and Remove).
- [ ] Run `npm test` and `npm run lint`; expect green.
- [ ] Commit.

### Task 1.5: what the audit found broken

**Files:** Modify `src/components/galaxy/warfront.js`, its test, `src/components/universe/scene.js` (the siege's tally), `src/components/middleearth/rush/protocol.js` (the comment).

- [ ] Write a failing test beside `warfront.js`'s existing ones: a pilot adds damage, “reloads” (a new peer id, the same saved tally id) and tells it again; the objective's value counts it once. If the test passes as the code stands, the audit's suspicion was wrong: delete the test, note that in the handoff, and skip the fix.
- [ ] Give the battle's tally an id kept with the battle's save (`createTally(epoch, { cap: 4000, id })`), as `warState.js:124` does.
- [x] Dropped: no `forget(peerId)` on a roster drop. Forgetting folds a pilot's share into the floor and hides the new work of those who stay (measured on the battle's tally: 100 seen where 130 were done), so nothing forgets; a pilot back after a reload is matched by tally id, and the siege gets an id and a save for that (`siege.js`, as `warState.js` and `warfront.js` keep theirs).
- [ ] Fix the comment (`./net.js` → `./online.js`).
- [ ] Run `npm test`, `npm run lint`, `npm run build`, `node scripts/health.mjs --check --skip build`. Commit.

### Task 1.6: the browser checks in CI

**Files:** Modify `.github/workflows/ci.yml`.

- [ ] Add a third job, `online` (“Multiplayer”), `continue-on-error: true`, `timeout-minutes: 20`: checkout, Node 22 with the npm cache, `npm ci`, `npx playwright-core install --with-deps chromium`, start `npx vite --port 5173` in the background and wait for it to answer, then `RELAY=fake CHROME="$(node -e "console.log(require('playwright-core').chromium.executablePath())")" node scripts/online-check.mjs --universe`, and from PR 2 on `node scripts/squad-check.mjs` the same way. It is evidence, not a gate: a red run is read and either fixed or explained in the pull request.
- [ ] If the push is refused because the token may not change workflows, drop this task, leave the file as it was, and say so in the handoff.
- [ ] Push, open the pull request (“Multiplayer foundations: one socket per relay, a key that lasts, saved allies”), wait for CI, merge.

---

## PR 2: squads and talking (`claude/squads-2-squads`)

### Task 2.1: the squad's rules

**Files:** Create `online/squad/squadRules.js`, `squadRules.test.js`, `online/squad/invite.js`, `invite.test.js`.

**Interfaces:**
- `invite.js` produces: `ALPHABET`, `makeSid(rand) → string` (12 letters), `cleanSid(raw) → string | null`, `roomOf(sid) → Promise<string>` (`'sq-'` + 24 hex of SHA-256 of `'tp-squad-room:' + sid`), `linkFor(sid, origin) → '<origin>/#/?squad=<sid>'`, `sidFromSearch(search) → string | null`, `instanceOf(sid, n) → Promise<string>` (10 hex of SHA-256 of `sid + ':' + n`). `rush/protocol.js` imports `ALPHABET` from here.
- `squadRules.js` produces: `SQUAD = { size: 4, stateMs: 2000, helloMs: 3000, seekMs: 1500, awayMs: 10000, goneMs: 45000, leaderQuietMs: 8000, liveMs: 6000 }`; `newSquad(sid, me, now) → state`; `joining(sid, me, now) → state`; `squadStep(state, event, now) → { state, send: [[ns, data]] }` for events `{ type: 'hello', from, card }`, `{ type: 'state', from, wire }`, `{ type: 'bye', from }`, `{ type: 'tick' }`, and local `{ type: 'leave' | 'kick', id | 'rally', rally | 'open', open | 'lobby', lobby | 'instance', instance }`; `writeState(state) → wire`, `readState(wire) → object | null`, `readCard(data) → { name, kind, where, shield, level, ready } | null`; `view(state, now) → { sid, leader, mine (seat or null), members: [{ id, seat, name, kind, where, shield, level, ready, away, leader }], open, rally, lobby, instance, gone (boolean) }`.
- State shape: `{ sid, me, epoch, version, leader, members: [id], out: [id], open, rally, lobby, instance, cards: Map(id → { …card, at }), leaderAt, joinedAt }`.

- [ ] Write `invite.test.js` (round trips; junk reads null; `roomOf(sid)` doesn't contain the sid; `instanceOf` differs by `n`) and `squadRules.test.js`: `the leader seats a hello`; `a fifth is not seated`; `a turned-out pilot is not seated again`; `quiet 10 s is away, 45 s frees the seat`; `a reload keeps the seat` (same id, hello inside 45 s); `the leader quiet 8 s: seat 1 leads at a higher epoch`; `seat 2 does not claim while seat 1 is live`; `two claims at one epoch: the lower seat wins`; `the leader back finds a higher epoch and is a member`; `both gone, both back: one leader`; `a state from a stranger is dropped`; `a state with five members, an unknown field type, or an out list over 32 is dropped whole`; `no state within 15 s of joining: gone`.
- [ ] Run them; expect failures. Implement both modules. Run; expect green. Commit.

### Task 2.2: the squad's link

**Files:** Create `online/squad/squad.js`, `squad.test.js`. Modify `client.js` (`setSquad`, `inv`), `client.test.js`, create `online/wire2.js`, `wire2.test.js`.

**Interfaces:**
- Consumes: `squadRules.js`, `invite.js`, `joinAsVisitor`.
- `wire2.js` produces `readInvite(data) → { sid } | null` and (later tasks) the other new readers; `RATES2 = { inv: [0.2, 2], say: [0.5, 3], qc: [1, 3] }` merged into the client's limiter.
- `squad.js` produces: `createSquad({ sid, lead, card: () => card, load, now }) → { status, view(), on(fn) → off, leave(), kick(id), rally(rally | null), open(yes), lobby(lobby | null), instance(i | null), ping(p), quick(i), text(s), onPing, onQuick, onText }`. It joins `roomOf(sid)` under app `tilakpatel-portfolio-squad` with `cheap: new Set()`, feeds `squadStep`, ticks once a second, and emits `{ type: 'squad' }` on any change of `view()`.
- `client.js` gains `setSquad(ids)` (`p.squad = true` for those; `hit()` returns early for them; `hitCounts` gets `peer.ally === 'ally' || peer.squad`), `invite(id, sid)` (targeted `inv`), and events `{ type: 'invite', from, sid }` (dropped if one from that pilot was turned down inside 60 s) with `declineInvite(id)`.

- [ ] Write `squad.test.js` on the fake relays from `nostr.test.js` (export `createRelays` from a new `online/fakeRelays.testkit.js` so both use it): `three pilots end with one view`; `the leader leaving hands over`; `kick removes and keeps out`. In `client.test.js`: `a hit is not sent at a squadmate`; `an invite arrives once and a refusal holds 60 s`.
- [ ] Run; expect failures. Implement. Run `npm test`; expect green. Commit.

### Task 2.3: squads on the page

**Files:** Create `online/squad/Squad.jsx` (the roster's squad section and invite badge), `online/squad/SquadStrip.jsx`, `online/squad/squad.css`. Modify `useOnline.js`, `OnlineProvider.jsx`, `Online.jsx`, `pilots.js` and `tagRules.js` (squad mark, squad first among mates), `pages/Universe.jsx`, `pages/Galaxy.jsx`, `pages/GalaxySurface.jsx` (mount the strip in their HUD), `middleearth/towns/useTravellers.js` and `ghosts.js` (`mark`).

**Interfaces:**
- `useOnlineState` gains `squad` (the `view()` or null), `startSquad()`, `joinSquad(sid)`, `leaveSquad()`, `inviteToSquad(id)`, `squadLink` (string or null), `invites: [{ from, name, sid }]`, `answerInvite(from, yes)`, `followLeader` and `setFollowLeader(yes)` (`tp-squad-follow`), and keeps the sid in `sessionStorage['tp-squad']`. It calls `client.setSquad(ids)` on every squad change.
- `OnlineProvider` reads `sidFromSearch(useLocation().search)` (the router's, so the part after `#/`) on every page; offline, it opens the join card with the line “<leader's callsign, once known, else ‘A pilot’> asked you to fly with their squad”; after `goOnline` (or at once) it calls `joinSquad`, removes the parameter with `navigate(pathname, { replace: true })`, and shows the toast “Go to <leader>”.
- `tagRules.js`: `mateOrder(peers) → ids`, squadmates first, then allies, four at most. `ghosts.js`'s `createGhosts` takes `mark(id) → 'squad' | 'ally' | null` and draws the name card's fill `#1f5a3a` for either, with a leading “◆ ” for squad.
- Rally: `squad.rally({ w: where, p: client.poseOf(self) })`; members get one toast per new rally (`<leader> rallies at <placeName(w)> · Go`); with `followLeader` on, a three-second toast with Cancel, then the roster's Go.

- [ ] Write `tagRules.test.js` additions (`squadmates come before allies; four at most`), and a `useOnline` test with a fake client and squad: `a newcomer joins after going online`; `the sid survives a reload and is dropped on leave`.
- [ ] Implement the UI. Check by hand with `RELAY=fake` and two contexts through a scratch run of `scripts/squad-check.mjs` (Task 2.6 finishes it): the strip shows on `/`, `/galaxy/hoth`, a surface and floating on `/projects`; at 390×844 nothing overlaps the HUD's existing corners.
- [ ] Run `npm test`, `npm run lint`. Commit.

### Task 2.4: pay for flying together

**Files:** Modify `src/components/universe/economy.js` (+ test), `pages/Universe.jsx`, `pages/Galaxy.jsx`.

- [ ] Test `EARN.assist` is `{ credits: 10, xp: 5 }` and `earn('assist')` pays it.
- [ ] In the two pages, on the client's `downed` event with `by` a squadmate, or `helped` from one, and that squadmate's last pose within `GUARD.range` of yours, call `earn('assist')`. Commit.

### Task 2.5: what may be said

**Files:** Create `online/chat/text.js`, `text.test.js`, `online/chat/seal.js`, `seal.test.js`, `online/chat/chat.js`, `chat.test.js`. Modify `wire2.js` (+ test), `client.js` (`say`, `quick`), `squad.js` (`ch`, `qc`, `pg`).

**Interfaces:**
- `text.js` produces: `CHAT = { everyone: true, squadMax: 200, everyoneMax: 160, log: 50, repeatMs: 30000 }`; `PHRASES` (the sixteen, in the spec's order, ids `0`…`15`); `phrase(i) → string | null`; `cleanText(raw, max) → string | null`.
- `cleanText`, in order: not a string → null; cut to `max × 8` code units; remove control and direction characters (the class `names.js` uses); collapse whitespace and trim; replace anything matching a link (a scheme and `://`, `www.`, or a dotted name ending in a letters-only label of 2 to 24 before a space, slash or the end, with optional spaces round the dots) by `[link]`; replace each word `isRude` flags by `•••`; cut to `max` characters; empty → null.
- `seal.js` produces: `sealKey(sid) → Promise<CryptoKey>` (HKDF-SHA-256 from the sid's bytes, info `tp-squad-chat`, AES-GCM 256), `seal(key, text) → Promise<string>` (base64 of nonce and ciphertext), `unseal(key, sealed) → Promise<string | null>` (null on any failure; refuses over 1,024 base64 characters).
- `wire2.js` adds `readSay(data) → { text, all } | null`, `readQuick(data) → number | null`, `readPing(data) → { kind, where, p: [x, y, z], sec, target } | null` (kinds `go`, `help`, `foe`, `look`; coordinates clamped as `readPose` clamps).
- `chat.js` produces: `createChat({ now }) → { add(channel, { from, name, text, phrase }), lines(channel) → [{ id, from, name, text, at }], muted(id), mute(id, yes), on(fn) → off, allow(from, text) → boolean }` with channels `'squad' | 'here' | 'all'`; `allow` is false for the third identical text from one pilot inside 30 s; each channel keeps 50 lines.
- `client.say(text, all)` sends `say { t, s }` only when `CHAT.everyone`; incoming `say` is cleaned again, dropped from the blocked and the muted, and emitted as `{ type: 'say', from, text, all }` (`all` false only shown when `p.where === self.where`). `client.quick(i)` and `{ type: 'quick', from, i }` likewise.

- [ ] Write `text.test.js` with one test per rule and these inputs: a right-to-left override; 5,000 characters; `<img src=x onerror=1>` (comes back as the same characters, to be shown as text); `go to example . com now` → `go to [link] now`; `https://x.io/a` → `[link]`; `v2.0 is out` stays; a rude word spelt with digits → `•••`; only spaces → null. `seal.test.js`: round trip; a wrong sid's key gives null; one changed character gives null. `chat.test.js`: the repeat rule, the cap, mute. `wire2.test.js`: each reader's round trip and junk.
- [ ] Run; expect failures. Implement. Run `npm test`; expect green. Commit.

### Task 2.6: the chat panel, pings and the check

**Files:** Create `online/chat/Chat.jsx`, `chat.css`, `online/chat/keys.js`, `keys.test.js`, `online/chat/pings.js`, `pings.test.js`, `scripts/squad-check.mjs`. Modify `useOnline.js` (`chat`, `say`, `quick`, `ping`, `setPingSource`, `everyoneChat` and its switch `tp-chat`), `Online.jsx` (Mute on a row, the switch), `pilots.js` (bubbles on tags, ping markers), `galaxy/surface/peers.js` and `ghosts.js` (bubbles, “here” pings), the three flight pages (register a ping source).

**Interfaces:**
- `keys.js`: `chatKeys({ target, online, bound }) → off`; `bound` is a set of letters the page already uses; exports `pickKeys(bound) → { chat, quick, ping }` (tested: defaults `y`, `c`, `n`; fallbacks in the order `u`, `h`, `k`).
- `pings.js`: `createPings({ now, life = 12000 }) → { add(ping, from), list(where) → [{ id, from, name, kind, p, sec, target, left }], on(fn) }`; at most three live per pilot.
- A page registers `online.setPingSource(() => ({ w, p, sec, target }))`; with none, a ping carries the pilot's own place and no point.
- `Chat.jsx`: lazy; tabs Squad (only in a squad), Here, All (only when `CHAT.everyone` and the switch is on); the field has `maxLength` of the channel's cap and stops key events from reaching the page; the quick-chat grid is sixteen `.chip` buttons.

- [ ] Write `keys.test.js` and `pings.test.js`. Implement the panel, the bubbles and the markers.
- [ ] Write `scripts/squad-check.mjs` on `fakeRelays()` with contexts Alpha, Bravo, Charlie: Alpha starts a squad; Bravo opens Alpha's link from offline and joins; Charlie is invited from the roster and accepts; each strip lists the other two; Alpha reloads and is still seat 0's pilot; Alpha goes offline and Bravo's strip shows Bravo leading within 12 s; Bravo types `see https://bad.example now` and Charlie's panel shows `see [link] now`; a second tab in Alpha's context shows the guest line; one run at 390×844 for the link flow. Exit non-zero on any miss or page error.
- [ ] Run it; expect a pass. Run `npm test`, `npm run lint`, `npm run build`, the health check. Commit, push, open the pull request (“Squads: one link to fly together, with pings and chat”), wait for CI, merge.

---

## PR 3: lobbies and private games (`claude/squads-3-lobbies`)

### Task 3.1: instances

**Files:** Modify `client.js`, `client.test.js`, `protocol.js` (`i` in the hello), `protocol.test.js`, `useOnline.js` (`instance`), `Online.jsx` (“in a private game”), `towns/travellers.js` (+ test), `towns/useTravellers.js`.

**Interfaces:**
- `client.setInstance(i | null)`: `SITE = ['hi', 'ally', 'war', 'inv', 'say', 'qc']` stay on the site's room; every other action is re-made on `joinRoom({ appId: APP_ID }, ROOM + '+' + i)` (or on the site's room when null, the same object). Handlers are attached by one `wirePlace(room)` function used for both. On a switch each peer's `snaps`, `pose`, `foot`, `walk`, `hunters`, `cur` and `shots` are cleared and the old place room is left.
- The hello's `i: 1`; `readHello` gives `instance: boolean`; `snapshot()` passes it on. The roster row reads “in a private game” and hides Fly to.
- `createTravellers({ …, instance })`: room `${town}-v1` or `${town}-v1+${instance}`; `useTravellers` passes `online.instance` and rejoins when it changes.

- [ ] Write the tests: `with no instance one room carries everything` (assert the fake relay sees one topic); `with an instance, a pose goes to the instance topic and a hello to the site's`; `an ally request, an invite and a block reach a pilot in an instance`; `poses from the public room are not drawn once an instance is set`; the hello's `i` round trip; the travellers' room name.
- [ ] Run; expect failures. Implement. Run `npm test`; expect green. Commit.

### Task 3.2: the lobby's rules and the activities

**Files:** Create `online/lobby/lobbyRules.js`, `lobbyRules.test.js`, `online/lobby/activities.js`, `activities.test.js`. Modify `squad/squadRules.js` (`readState` checks `lb` with `readLobby`).

**Interfaces:**
- `activities.js`: `ACTIVITIES` (`roam`, `siege`, `front`, `rush`, `arena`), each `{ id, name, blurb, min, max, kind, private, late, options: [{ id, label, choices: [{ id, label }] }], route(options, leaderWhere) → path }`; `activity(id)`; `cleanOptions(id, raw) → options` (unknown values fall to each option's first choice). `front`'s choices are `galaxy/names.js`'s systems; `rush`'s are the Rush levels with their towns; `arena`'s are mode (`ffa`, `teams`), arena (Task 4.1's ids), kills (`3`, `5`, `10`).
- `lobbyRules.js`: `LOBBY = { countMs: 3000, anywayMs: 10000 }`; `newLobby(activityId, options, n) → lobby`; `lobbyStep(lobby, event, now, members) → lobby` for `{ type: 'options' | 'start' | 'tick' | 'end', … }`; `canStart(lobby, members, now) → { ok, anyway }`; `writeLobby`, `readLobby`; `phaseFor(lobby, receivedAt, now) → 'open' | 'count' | 'live' | 'done'` (the countdown runs from when this browser received `c`).
- Lobby shape: `{ a, o, ph, c, n, sc, w, since }`.

- [ ] Write the tests named in the spec's Testing section for these two modules, plus `every route matches a route in App.jsx` (read `src/App.jsx` as text and check each activity's route against its `path=` patterns).
- [ ] Run; expect failures. Implement. Run; expect green. Commit.

### Task 3.3: the lobby on the page, and open games

**Files:** Create `online/lobby/Lobby.jsx`, `lobby.css`. Modify `useOnline.js` (`lobby` actions; apply `squad.instance` to `client.setInstance`; navigate at `live`), `squad/Squad.jsx` (Play…, Open the squad), `protocol.js` (`g` in the hello) and test, `Online.jsx` (“Open games”).

**Interfaces:**
- `useOnlineState` gains `pickActivity(id, options)`, `setReady(yes)`, `startGame()`, `endGame()`, `openSquad(yes)`. At the leader's start it sets `instance` to `instanceOf(sid, n)` when the activity is private, then the lobby to `count`. Every member, when `phaseFor` turns `live`, navigates to the activity's route once per game number.
- The hello's `g: { a, n, m, s }`, sent by the leader only while the squad is open; `readHello` gives `game: { activity, members, room, sid } | null` (`sid` through `cleanSid`, `activity` through `activity()` or null).

- [ ] Write the protocol tests for `g`. If the instance room's `ready` rejects, the lobby stays `open`, the instance goes back to null and the card says “Couldn't open a private game” with Try again. Implement the card (seats with callsign, ship, level and a ready tick; the activity and its options as `.chip` groups for the leader; Ready; Start and “Start without them”; the countdown; “In progress · Join”), the roster's “Open games” rows, and the navigation.
- [ ] Extend `scripts/squad-check.mjs`: the squad picks `roam`, readies, starts; all three arrive on the leader's page; a fourth pilot, Delta, online and on the same page, sees none of them on the map and “in a private game” in the roster; the squad opens and Delta joins from “Open games”.
- [ ] Run it and `npm test`, `npm run lint`. Commit.

### Task 3.4: Rush on the lobby

**Files:** Modify `middleearth/rush/online.js`, `online.test.js`, `protocol.js`, `protocol.test.js`, `Rush.jsx`.

**Interfaces:**
- `createSession({ …, names })`: `names` is `[callsign × 4]` or null; `writeLobby` sends them as a fourth element, each through `cleanName`; `readLobby` gives `names` (null entries for a client that sends none). Seats show the callsign over the hobbit's name when there is one.
- `Rush.jsx`: when `useOnline().squad?.lobby` is live with activity `rush` for this kitchen, it skips its menu: the squad's leader hosts with the code `codeFrom(instance)` (four letters of `ALPHABET` from the instance's hex, in `rush/protocol.js`), the others join it. On `hostGone` in a lobby game it calls nothing itself; the squad's handover sets the lobby back to `open`.

- [ ] Write the tests: `names round-trip and a rude one reads as none`; `an old client's lobby reads with no names`; `codeFrom is four letters of the alphabet and steady`. Implement. Run the Rush tests and `npm test`.
- [ ] Extend `squad-check.mjs`: the squad plays `rush` in Bree; the three callsigns show in the kitchen's seats.
- [ ] Run `npm run build` and the health check. Commit, push, open the pull request (“Lobbies: pick a game as a squad, and play it privately”), wait for CI, merge.

---

## PR 4: the arena and the empty worlds (`claude/squads-4-arena`)

### Task 4.1: the arena's rules

**Files:** Create `src/components/universe/arena/arenaRules.js`, `arenaRules.test.js`, `arena/places.js`, `places.test.js`.

**Interfaces:**
- `places.js`: `ARENAS = [{ id, name, centre: [x, y, z], radius: 400 }]`, three of them, each centre at least 1,500 map units from every place in `universes.js` and inside the authored map; `arenaById(id)`. The test asserts the distances.
- `arenaRules.js`: `ARENA = { safeMs: 3000, respawnMs: 3000, outMs: 8000 }`; `spawns(arena, seats) → [{ x, y, z, heading }]` evenly round the rim facing the centre, teams on opposite halves; `teamOf(mode, seat) → 0 | 1 | null`; `foes(mode, seatA, seatB) → boolean`; `newScore(members)`; `countKill(score, { victim, by }, members) → score` (no change unless both are members, differ, and are foes); `countOut(score, id)`; `winner(score, mode, target) → id | team | null`; `outside(arena, pose) → boolean`.

- [ ] Write the tests named in the spec; run; expect failures; implement; run; expect green. Commit.

### Task 4.2: the arena in the scene

**Files:** Create `arena/Arena.jsx`, `arena.css`, `arena/useArena.js`. Modify `pages/Universe.jsx`, `src/components/universe/scene.js` (only: a `setArena(arena | null)` on the scene's API that places the ship at a spawn, sets `safe`, and gates the hunters' and patrols' spawning behind `!state.arena`; find the two spawn calls by grepping `hunters.` and the patrol module), `client.js` (`setFoes(ids | null)`: when set, squad no-friendly-fire applies only to squadmates not in it), `economy.js` (`arenaPlayed`, `arenaWin`) and test.

**Interfaces:**
- `useArena(online, scene, earn)`: while the squad's lobby is live with `arena`, it calls `scene.setArena`, `client.setFoes`, counts kills from the client's `downed` events through `countKill` (the leader writes `sc` into the lobby and, on `winner`, `ph: 'done'` and `w`), respawns the pilot after 3 s, and watches `outside` (a HUD arrow back; 8 s out is `countOut` and a respawn). Members show the leader's `sc`. It pays `arenaPlayed` once per game number and `arenaWin` to the winner or the winning team.
- `Arena.jsx`: the scoreboard (a row per pilot or per team, kills, the target), and the end card with Again (the leader's: a new game number, the same options) and Back to the squad (the lobby to `open`, the instance to null).

- [ ] Write the `economy.test.js` and `client.test.js` additions (`with foes set, a hit is sent at a squadmate who is a foe and not at one who isn't`). Implement.
- [ ] Extend `squad-check.mjs`: Alpha and Bravo play `arena`, free-for-all to 3, driving kills through `window.__universeDebug` (add a dev-only `arenaKill(by)` there that emits the same `downed` event a real kill does); both screens show the same winner and the wallet gained `arenaPlayed`.
- [ ] Run it, `npm test`, `npm run lint`. Commit.

### Task 4.3: somebody in every world

**Files:** Modify the world components of Cybertron (`src/components/cybertron/`), the Death Star's corridors (`src/components/deathstar/inside/`), the Expanse's planets (`src/components/expanse/surface/`) and the Galactic Assault (`src/components/galaxy/surface/missions/`), each with its scene.

- [ ] For each, follow `middleearth/towns/BreeWorld.jsx:95` and its scene: `useTravellers(room, up, opts)`, send the player's step from the frame loop, add `createGhosts(…)` to the scene, show `PlayersChip`. Rooms: `cybertron`, `deathstar-inside` (area: the deck or room id the world already has), `expanse-<seed>`, `assault-<system>`. Pick `bound` from each world's own size and `motion: true` where the player jumps or drives.
- [ ] Run `RELAY=fake node scripts/online-check.mjs /cybertron /deathstar/inside`; expect each chip to read “1 other here”. Commit after each world.

### Task 4.4: telling people, and the handoff

**Files:** Modify `src/components/guide/pages.js`, `src/components/tour/chapters/player.js`, `src/data/todo.js` (+ `todo.test.js`), `docs/architecture.md`. Create `docs/superpowers/HANDOFF-squads-and-lobbies.md`.

- [ ] Guide: a “Squads” page (the link, the strip, rally, pings, chat and its keys, lobbies, the arena, the two switches). Tour: one step on the squad link. `todo.js`: four entries of kind `multiplayer` (`squad-up`, `host-lobby`, `arena-win`, `say-hello`), completed from the events `useOnline` already raises. Architecture: a section for `online/squad`, `chat`, `lobby` and `universe/arena`.
- [ ] Write the handoff with Done, Left and Checking it, in the form of `HANDOFF-multiplayer-economy.md`, listing honestly whatever was not checked on the real relays.
- [ ] Run `npm test`, `npm run lint`, `npm run build`, the health check, and the whole of `RELAY=fake node scripts/squad-check.mjs`. Commit, push, open the pull request (“The arena, and other players in four more worlds”), wait for CI, merge.
