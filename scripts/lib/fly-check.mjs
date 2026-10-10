/* global window */
// The shared world in two browsers (online-check.mjs --fly): Alpha and Bravo
// on /fly/hoth, the room heard by cell and the durable world faked in Node
// (./fake-durable.mjs, one store both reach). Alpha at cell 0,0 and Bravo at
// 5,5 hear no pose of each other; Bravo flies to 1,1 and Alpha hears them
// (how long it took, printed); how many poses a second Alpha takes with two
// pilots, and (on the fake relays) with ten, eight of them sent from here;
// Alpha builds a turret and Bravo has it (how long, printed); both reload
// and both still have it; Bravo shoots it to nothing and it leaves both.
//
// flyCheck({ a, b, relays, durable, base, check, waitFor }) → the numbers measured

const CELL = 2048;
const ROOM_TOPIC = 'tilakpatel-portfolio-flight/fly-v1:hoth';
const hex = (n) => [...Array(n)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// the ship put at (x, z), `up` metres over the ground there, nose to −z, slow
const hold = (page, x, z, up = 40) =>
  page.evaluate(
    ([x, z, up]) => {
      const w = window.__FLIGHT__;
      w.ship = { x, z, pitch: 0, roll: 0, yaw: 0, speed: 40 };
      const g = w.groundUnder();
      w.ship = { y: (Number.isFinite(g) ? g : 0) + up };
      return Number.isFinite(g);
    },
    [x, z, up],
  );
const stats = (page) => page.evaluate(() => window.__FLIGHT__?.shared?.stats() ?? null);
const ready = (page) => page.waitForFunction(() => window.__FLIGHT__?.shared?.stats().online === 'online', null, { timeout: 240000 });

// poses Alpha took a second, over `ms`, while both are held where they are
async function rate(page, other, at, ms, extra = () => {}) {
  const before = (await stats(page)).room.poses;
  const t = Date.now();
  while (Date.now() - t < ms) {
    await hold(page, ...at.a);
    await hold(other, ...at.b);
    extra();
    await sleep(100);
  }
  return ((await stats(page)).room.poses - before) / ((Date.now() - t) / 1000);
}

export async function flyCheck({ a, b, relays, durable, base, check, waitFor }) {
  await durable.attach(a.context(), 'alpha-uid');
  await durable.attach(b.context(), 'bravo-uid');
  await Promise.all([a.goto(base + '/fly/hoth'), b.goto(base + '/fly/hoth')]);
  await Promise.all([ready(a), ready(b)]);
  console.log('ok   both in the planet’s room');
  const numbers = {};

  // far apart: nothing crosses
  const A = [1000, 1000];
  const FAR = [5 * CELL + 1000, 5 * CELL + 1000];
  const NEAR = [CELL + 1000, CELL + 1000];
  // (both start at the planet's spawn, so a pose may cross before they're
  // apart: counted from once each has said its far cell, and the stale ship gone)
  const apart = async (ms) => {
    const t = Date.now();
    while (Date.now() - t < ms) {
      await hold(a, ...A);
      await hold(b, ...FAR);
      await sleep(250);
    }
  };
  await apart(4000);
  const [ba, bb] = [await stats(a), await stats(b)];
  await apart(6000);
  const [sa, sb] = [await stats(a), await stats(b)];
  const took = [sa.room.poses - ba.room.poses, sb.room.poses - bb.room.poses];
  check(sa.cell === 'hoth/0,0' && sb.cell === 'hoth/5,5', `cells: Alpha ${sa.cell}, Bravo ${sb.cell}`);
  check(took[0] === 0 && took[1] === 0 && sa.peers === 0, `five cells apart for 6 s, no pose crosses (Alpha took ${took[0]}, Bravo ${took[1]})`);

  // Bravo comes within a cell
  const t1 = Date.now();
  await waitFor(async () => {
    await hold(a, ...A);
    await hold(b, ...NEAR);
    return (await stats(a)).peers > 0;
  }, 60000, 'Alpha sees Bravo a cell away');
  numbers.crossed = (Date.now() - t1) / 1000;
  check(numbers.crossed <= 2.5, `Bravo at 1,1: Alpha sees their ship in ${numbers.crossed.toFixed(1)} s`);

  numbers.two = await rate(a, b, { a: A, b: NEAR }, 5000);
  console.log(`ok   poses a second Alpha takes, two pilots: ${numbers.two.toFixed(1)}`);
  if (relays) {
    // eight more pilots in Bravo's cell, ten poses a second each, sent from here
    const fakes = [...Array(8)].map(() => ({ pubkey: hex(64), visit: hex(16) }));
    let last = 0;
    const send = () => {
      if (Date.now() - last < 100) return;
      last = Date.now();
      for (const f of fakes)
        relays.publish({
          id: hex(64),
          pubkey: f.pubkey,
          sig: hex(128),
          kind: 22742,
          created_at: Math.floor(Date.now() / 1000),
          tags: [['x', ROOM_TOPIC], ['visit', f.visit], ['g', 'hoth/1,1']],
          content: JSON.stringify([['pose', [NEAR[0], 300, NEAR[1], 0, 0, 0, 100, 0]]]),
        });
    };
    const timer = setInterval(send, 100);
    numbers.ten = await rate(a, b, { a: A, b: NEAR }, 5000);
    clearInterval(timer);
    console.log(`ok   poses a second Alpha takes, ten pilots: ${numbers.ten.toFixed(1)}`);
  }

  // Alpha builds; Bravo has it
  await waitFor(() => hold(a, ...A, 20), 60000, 'the ground under Alpha');
  const t2 = Date.now();
  await a.evaluate(() => window.__FLIGHT__.shared.build(window.__FLIGHT__.ship));
  await waitFor(async () => (await stats(a)).held > 0, 20000, 'Alpha holds the turret built');
  await waitFor(async () => {
    await hold(b, ...NEAR);
    return (await stats(b)).held > 0;
  }, 30000, 'Bravo has Alpha’s turret');
  numbers.built = (Date.now() - t2) / 1000;
  check(numbers.built <= 3, `a turret built by Alpha is in Bravo’s world in ${numbers.built.toFixed(1)} s`);
  const turret = [...durable.store.rows.values()][0];

  // both reload: still there
  await Promise.all([a.reload(), b.reload()]);
  await Promise.all([ready(a), ready(b)]);
  await waitFor(async () => {
    await hold(a, ...A);
    await hold(b, ...NEAR);
    const [x, y] = [await stats(a), await stats(b)];
    return x.held > 0 && y.held > 0;
  }, 60000, 'the turret after both reload');
  console.log('ok   after both reload, both still have the turret');

  // Bravo shoots it to nothing: from a spot 80 m off and over it whose line
  // to the turret's head the ground doesn't cut (Hoth's ridges can rise
  // 200 m in 150), nose on the head, Space held
  const spot = await b.evaluate(async ([tx, ty, tz]) => {
    const { planetField } = await import('/src/lib/land/flight/field.js');
    const { planetSpecOf } = await import('/src/lib/land/flight/planetSpec.js');
    const f = planetField(planetSpecOf('hoth'));
    const head = ty + 6;
    let best = null;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const [dx, dz] = [Math.sin(a), Math.cos(a)];
      const y = Math.max(head + 25, f.heightAt(tx + dx * 80, tz + dz * 80) + 15);
      // the least room between the line of fire and the ground under it
      let room = Infinity;
      for (let s = 10; s <= 80; s += 5) room = Math.min(room, head + ((y - head) * s) / 80 - f.heightAt(tx + dx * s, tz + dz * s));
      if (!best || room > best.room) best = { x: tx + dx * 80, y, z: tz + dz * 80, yaw: Math.atan2(dx, dz), pitch: Math.atan2(head - y, 80), room };
    }
    return best;
  }, [turret.x, turret.y, turret.z]);
  await b.bringToFront();
  await b.keyboard.down('Space');
  const t3 = Date.now();
  try {
    await waitFor(async () => {
      await b.evaluate((s) => (window.__FLIGHT__.ship = { x: s.x, y: s.y, z: s.z, pitch: s.pitch, roll: 0, yaw: s.yaw, speed: 40 }), spot);
      await hold(a, ...A);
      const [x, y] = [await stats(a), await stats(b)];
      return x.held === 0 && y.held === 0;
    }, 120000, 'the turret shot to nothing leaves both');
  } finally {
    await b.keyboard.up('Space');
  }
  numbers.down = (Date.now() - t3) / 1000;
  check(!durable.store.rows.size, `Bravo shot the turret to nothing in ${numbers.down.toFixed(1)} s; it left both worlds and the store`);
  return numbers;
}
