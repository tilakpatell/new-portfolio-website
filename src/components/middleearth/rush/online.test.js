import { describe, expect, it } from 'vitest';
import { PONY } from './levels/pony';
import { createSession } from './online';
import { movePlayer, newRush, stepRush } from './rules';

// A room in memory: what one member sends, the others get (as the relays do).
function fakeRelay() {
  const members = new Set();
  const muted = new Set(); // members whose messages go nowhere (a stalled page)
  let n = 0;
  const joinRoom = () => {
    const id = `peer${++n}`;
    const acts = {};
    const m = {
      selfId: id,
      ready: Promise.resolve(),
      onPeerJoin: null,
      onPeerLeave: null,
      onStatus: null,
      makeAction(ns) {
        const a = {
          onMessage: null,
          send(data) {
            if (muted.has(id)) return;
            const wire = JSON.parse(JSON.stringify(data));
            for (const o of members) if (o !== m) o.deliver(ns, wire, id);
          },
        };
        acts[ns] = a;
        return a;
      },
      deliver(ns, data, from) {
        acts[ns]?.onMessage?.(data, { peerId: from });
      },
      leave() {
        members.delete(m);
        for (const o of members) o.onPeerLeave?.(id);
      },
    };
    members.add(m);
    return m;
  };
  return { load: () => Promise.resolve(joinRoom), mute: (id, on = true) => (on ? muted.add(id) : muted.delete(id)) };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('a room', () => {
  it('seats guests, plays a round, and carries grabs and the state', async () => {
    const relay = fakeRelay();
    let t = 0;
    const now = () => t;
    const host = createSession({ level: PONY, code: 'BCDF', host: true, load: relay.load, now });
    const guest = createSession({ level: PONY, code: 'BCDF', host: false, load: relay.load, now });
    await settle();
    await settle();
    expect(host.state.status).toBe('online');
    // the guest says hello and is seated in slot 1
    const gs = newRush(PONY, { players: 1 });
    t = 2000;
    guest.guestPump(gs, t);
    expect(host.state.slots[1]).toBe(guest.selfId);
    expect(guest.state.mine).toBe(1);
    // the host starts a round for both
    host.setPhase('play', 5);
    expect(guest.state.phase).toBe('play');
    const hs = newRush(PONY, { players: 2, seed: 5 });
    hs.orders.push({ id: 1, dish: 'pint', t: 40, of: 50 });
    // the guest walks to the carrot crate and grabs
    const local = newRush(PONY, { players: 1 });
    guest.guestPump(local, (t += 100));
    const me = local.players.find((p) => p.slot === 1);
    expect(me).toBeTruthy();
    Object.assign(me, { x: 1.5, z: 1.6, face: Math.PI / 2 });
    movePlayer(local, me, { x: 0, z: -0.2 }, 0.05);
    guest.guestPump(local, (t += 100));
    guest.sendGrab(me);
    // the host takes it in on its next step, and sends the round out
    const grabs = host.hostPump(hs, (t += 16));
    expect(grabs).toEqual([{ p: 1 }]);
    const ev = stepRush(hs, 0.016, grabs);
    expect(hs.players[1].held).toEqual({ k: 'carrot', s: 'raw' });
    host.hostSend(hs, ev, (t += 200));
    const back = guest.guestPump(local, (t += 16));
    expect(back.fresh).toBe(true);
    expect(back.events.map((e) => e.type)).toContain('pick');
    expect(local.players.find((p) => p.slot === 1).held).toEqual({ k: 'carrot', s: 'raw' });
    expect(local.orders.map((o) => o.dish)).toEqual(['pint']);
    // the host's own hobbit shows at the guest's
    hs.players[0].x = 9.5;
    host.hostSend(hs, [], (t += 200));
    guest.guestPump(local, (t += 16));
    expect(local.players.find((p) => p.slot === 0).x).toBe(9.5);
    expect(local.players.find((p) => p.slot === 1).x).toBeCloseTo(me.x); // still where the guest put it
    host.leave();
    guest.leave();
  });

  it('lets go of a guest who leaves, and a room’s over when its host goes', async () => {
    const relay = fakeRelay();
    let t = 0;
    const now = () => t;
    const host = createSession({ level: PONY, code: 'GHJK', host: true, load: relay.load, now });
    const guest = createSession({ level: PONY, code: 'GHJK', host: false, load: relay.load, now });
    await settle();
    await settle();
    const gs = newRush(PONY);
    guest.guestPump(gs, (t = 2000));
    host.setPhase('play', 1);
    const hs = newRush(PONY, { players: 2 });
    guest.guestPump(gs, (t += 100));
    host.hostPump(hs, (t += 100));
    expect(hs.players.map((p) => p.slot)).toEqual([0, 1]);
    // sitting in the lobby isn't going quiet
    host.setPhase('lobby');
    for (let n = 0; n < 8; n++) {
      t += 2000;
      guest.guestPump(gs, t);
      host.hostPump(hs, t);
    }
    expect(host.state.slots[1]).toBe(guest.selfId);
    host.setPhase('play');
    // quiet too long: gone
    host.hostPump(hs, (t += 11000));
    host.hostPump(hs, (t += 16));
    expect(host.state.slots[1]).toBe(null);
    expect(hs.players.map((p) => p.slot)).toEqual([0]);
    // and the host leaving ends it for the guest
    host.leave();
    expect(guest.state.hostGone).toBe(true);
    guest.leave();
  });

  it('a host that only went quiet is welcomed back; one that left isn’t', async () => {
    const relay = fakeRelay();
    let t = 0;
    const now = () => t;
    const host = createSession({ level: PONY, code: 'QRST', host: true, load: relay.load, now });
    const guest = createSession({ level: PONY, code: 'QRST', host: false, load: relay.load, now });
    await settle();
    await settle();
    const gs = newRush(PONY);
    guest.guestPump(gs, (t = 2000));
    expect(guest.state.mine).toBe(1);
    relay.mute(host.selfId); // nothing from the host for twelve seconds
    guest.guestPump(gs, (t += 12000));
    expect(guest.state.hostGone).toBe(true);
    relay.mute(host.selfId, false);
    host.hostSend(null, [], (t += 2500)); // and then the lobby again, when it's next due
    expect(guest.state.hostGone).toBe(false);
    host.leave();
    expect(guest.state.hostGone).toBe(true);
    guest.leave();
  });

  it('a guest let go of for a moment keeps its own hobbit where it is', async () => {
    const relay = fakeRelay();
    let t = 0;
    const now = () => t;
    const host = createSession({ level: PONY, code: 'VWXZ', host: true, load: relay.load, now });
    const guest = createSession({ level: PONY, code: 'VWXZ', host: false, load: relay.load, now });
    await settle();
    await settle();
    const local = newRush(PONY, { players: 1 });
    guest.guestPump(local, (t = 2000));
    host.setPhase('play', 1);
    const hs = newRush(PONY, { players: 2 });
    guest.guestPump(local, (t += 100));
    const me = local.players.find((p) => p.slot === 1);
    me.x = 10.4;
    guest.guestPump(local, (t += 100));
    host.hostPump(hs, (t += 16));
    // the guest's page stalls: the host lets go of it, then it says hello again
    relay.mute(guest.selfId);
    host.hostPump(hs, (t += 11000));
    host.hostPump(hs, (t += 16)); // (and its hobbit's gone from the host's round)
    expect(hs.players.map((p) => p.slot)).toEqual([0]);
    host.hostSend(hs, [], (t += 200));
    expect(guest.state.mine).toBe(null);
    me.x = 8.2; // meanwhile it walks on, at home
    guest.guestPump(local, (t += 16)); // the host's round, without the guest in it
    relay.mute(guest.selfId, false);
    guest.guestPump(local, (t += 3100)); // hello: seated again
    host.hostPump(hs, (t += 16));
    host.hostSend(hs, [], (t += 200)); // the host's copy has the guest back at the door
    guest.guestPump(local, (t += 16));
    expect(guest.state.mine).toBe(1);
    expect(local.players.find((p) => p.slot === 1).x).toBe(8.2);
    expect(hs.players.find((p) => p.slot === 1).x).toBe(8.2); // and the host has it there too
    host.leave();
    guest.leave();
  });

  it('turns a fifth away', async () => {
    const relay = fakeRelay();
    let t = 2000;
    const now = () => t;
    const host = createSession({ level: PONY, code: 'LMNP', host: true, load: relay.load, now });
    const guests = [0, 1, 2, 3].map(() => createSession({ level: PONY, code: 'LMNP', host: false, load: relay.load, now }));
    await settle();
    await settle();
    for (const g of guests) g.guestPump(newRush(PONY), t);
    expect(host.state.slots.filter(Boolean)).toHaveLength(4);
    expect(guests.filter((g) => g.state.full)).toHaveLength(1);
    expect(guests.filter((g) => g.state.mine != null)).toHaveLength(3);
    for (const x of [host, ...guests]) x.leave();
  });
});
