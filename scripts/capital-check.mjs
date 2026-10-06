/* global window */
// A browser check of the fight with the director's capital ship
// (universe/capitalRules.js, setpieces.js, scene.js) and of the newer
// characters (npcs/brains/). With the dev server up (npx vite --port 5173)
// and Chrome at $CHROME:
//   OUT=/tmp/shots node scripts/capital-check.mjs [cruiser|xwing|falcon|rv]
//   ONLY=streak … for the jump alone, held still to look at
// It brings the capital ship in and checks it's here with its shield parts
// on the guns, knocks them out, sees the bridge open and the ship run,
// brings another and kills its bridge, sees it go up; then brings each of
// the side's newer characters by and checks they fly and have their say.
import { chromium } from 'playwright-core';

const out = process.env.OUT ?? '.';
const crew = process.argv[2] ?? 'xwing';
const URL = 'http://localhost:5173/?quality=low#/universe';
const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const errors = [];
const problems = [];
const check = (ok, what) => {
  console.log(ok ? 'ok  ' : 'FAIL', what);
  if (!ok) problems.push(what);
};
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript((s) => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"universe"');
  window.localStorage.setItem('tp-universe-ship', JSON.stringify(s));
  window.localStorage.setItem('tp-universe-drive', '"super"');
}, crew);
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship, null, { timeout: 180000 });
await page.waitForTimeout(2500);
const dbg = (fn, arg) => page.evaluate(fn, arg);
const shot = (name) => page.screenshot({ path: `${out}/${name}.png`, timeout: 120000 });
// software GL draws a frame or two a second, so the scene's clock crawls:
// the rules are run on ahead by hand (their events reach the scene on its
// next frame), and the characters' brains the same way
// the ship put where it sees the capital ship: off its beam, facing it
const frame = (dist = 34) =>
  dbg((dist) => {
    const d = window.__universeDebug;
    const c = d.pieces.capital;
    if (!c.state) return;
    const h = c.heading;
    const sx = Math.cos(h) * dist;
    const sz = -Math.sin(h) * dist;
    const s = d.state.ship;
    s.x = c.at[0] + sx;
    s.y = c.at[1] + 6;
    s.z = c.at[2] + sz;
    s.heading = Math.atan2(sx, sz); // (the nose on the ship: heading h points along (−sin h, −cos h))
    s.pitch = -0.15;
    s.speed = 0;
  }, dist);
const ff = async (seconds) => {
  await dbg((seconds) => {
    const d = window.__universeDebug;
    for (let t = 0; t < seconds; t += 0.1) d.pieces.capital.update(0.1, d.state.ship);
  }, seconds);
  await page.waitForTimeout(1500);
};
const ffNpc = async (seconds) => {
  await dbg((seconds) => {
    const d = window.__universeDebug;
    const world = { you: d.state.ship, hunters: d.hunters.targets, stations: [], solids: [], next: { id: 'hunt', in: 30 }, heat: d.state.heat, shield: d.state.shield };
    for (let t = 0; t < seconds; t += 0.1) d.npcs.update(0.1, t, world);
  }, seconds);
  await page.waitForTimeout(800);
};
// (ONLY=streak: just the jump, held still, below)
if (process.env.ONLY !== 'streak') {
// 1. the capital ship arrives, and its shield parts are on the guns
await dbg(() => window.__universeDebug.director.soon('destroyer'));
await page.waitForFunction(() => window.__universeDebug.pieces.destroyerHere, null, { timeout: 90000 }).catch(() => {});
check(await dbg(() => window.__universeDebug.pieces.destroyerHere), 'the capital ship is here');
await page.waitForFunction(() => window.__universeDebug.pieces.capital.state === 'here', null, { timeout: 30000 }).catch(() => {});
const arrived = await dbg(() => {
  const c = window.__universeDebug.pieces.capital;
  return { state: c.state, kind: c.kind, len: c.len, targets: c.targets.map((t) => t.name), parts: c.parts.map((p) => ({ id: p.id, at: p.at.map((v) => +v.toFixed(1)), alive: p.alive })), at: c.at.map((v) => +v.toFixed(1)) };
});
console.log('arrived:', JSON.stringify(arrived));
check(arrived.state === 'here', 'it has snapped to its shape');
check(arrived.targets.length === 2 && arrived.targets.every((n) => /Shield/.test(n)), `its shield parts are on the guns: ${arrived.targets.join(', ')}`);
await frame();
await page.waitForTimeout(1500);
await shot('capital-here');
// its fighters come out
await ff(3);
check(await dbg(() => window.__universeDebug.hunters.count > 0), `its fighters have launched (${await dbg(() => window.__universeDebug.hunters.count)})`);
// (and the guns can lock on to a dome)
const lock = await dbg(() => window.__universeDebug.state.lockTarget?.id ?? null);
console.log('lock:', lock);

// 2. shots into a dome: a hit, then down; then the other; the bridge opens and it runs
const knock = (id) =>
  dbg((id) => {
    const d = window.__universeDebug;
    const c = d.pieces.capital;
    const p = c.parts.find((o) => o.id === id);
    if (!p || !p.alive) return null;
    let r = null;
    for (let i = 0; i < 40 && p.alive; i++) {
      const from = new d.THREE.Vector3(p.at[0], p.at[1] + 20, p.at[2]);
      const to = new d.THREE.Vector3(p.at[0], p.at[1] - 20, p.at[2]);
      r = d.pieces.hit(from, to, 1);
    }
    return r && { type: r.type, down: r.down, left: r.left };
  }, id);
const shieldedHit = await dbg(() => {
  const d = window.__universeDebug;
  const c = d.pieces.capital;
  const at = c.at;
  const r = d.pieces.hit(new d.THREE.Vector3(at[0], at[1] + 20, at[2]), new d.THREE.Vector3(at[0], at[1] - 20, at[2]), 1);
  return r?.type ?? null;
});
check(shieldedHit === 'shielded', `a shot into the hull splashes off the shield (${shieldedHit})`);
const first = arrived.parts.filter((p) => p.id !== 'bridge').map((p) => p.id);
const r0 = await knock(first[0]);
check(r0?.down === true && r0.left === 1, `the first shield part went down: ${JSON.stringify(r0)}`);
const r1 = await knock(first[1]);
check(r1?.down === true && r1.left === 0, `the second went down: ${JSON.stringify(r1)}`);
await page.waitForTimeout(500);
const open = await dbg(() => {
  const c = window.__universeDebug.pieces.capital;
  return { shielded: c.shielded, targets: c.targets.map((t) => t.name), state: c.state };
});
check(!open.shielded && open.targets.length === 1 && !/Shield/.test(open.targets[0]), `the bridge is open: ${JSON.stringify(open)}`);
await frame(30);
await page.waitForTimeout(1500);
await shot('capital-open');
// it runs FLEE seconds on: run the rules up to the jump, a step at a time, and
// catch it a third of the way into the streak out
const ran = await dbg(() => {
  const d = window.__universeDebug;
  const c = d.pieces.capital;
  for (let i = 0; i < 400 && c.state === 'here'; i++) c.update(0.1, d.state.ship);
  c.update(0.25, null);
  return { state: c.state, reason: c.reason, age: +c.age.toFixed(2) };
});
check(ran.state === 'out' && ran.reason === 'fled', `it ran with its shields down: ${JSON.stringify(ran)}`);
await frame(60);
await page.waitForTimeout(1500);
await shot('capital-fled'); // (mid-streak: the nose away ahead, the stern where it was)
await ff(1);
check(await dbg(() => !window.__universeDebug.pieces.destroyerHere), 'and it is gone');

// 3. another, and this time the bridge goes: it dies
await dbg(() => {
  const d = window.__universeDebug;
  d.hunters.clear();
  d.director.soon('destroyer');
});
await page.waitForFunction(() => window.__universeDebug.pieces.destroyerHere, null, { timeout: 120000 }).catch(() => {});
await ff(1);
check(await dbg(() => window.__universeDebug.pieces.capital.state === 'here'), 'a second capital ship is here');
for (const id of first) await knock(id);
const heavy = await dbg(() => {
  const d = window.__universeDebug;
  const c = d.pieces.capital;
  const p = c.parts.find((o) => o.id === 'bridge');
  let r = null;
  for (let i = 0; i < 6 && p.alive; i++) {
    r = d.pieces.hit(new d.THREE.Vector3(p.at[0], p.at[1] + 20, p.at[2]), new d.THREE.Vector3(p.at[0], p.at[1] - 20, p.at[2]), 8);
  }
  return r && { type: r.type, down: r.down, state: c.state };
});
check(heavy?.type === 'bridge' && heavy.down && heavy.state === 'dying', `heavy rounds took the bridge: ${JSON.stringify(heavy)}`);
await ff(2.5);
await frame(40);
await page.waitForTimeout(1500);
await shot('capital-dying');
const dying = await dbg(() => ({ roll: +window.__universeDebug.pieces.capital.roll.toFixed(2), state: window.__universeDebug.pieces.capital.state, heat: window.__universeDebug.state.heat }));
check(dying.state === 'dying' && dying.roll > 0.3, `it is going up, listing (${JSON.stringify(dying)})`);
await ff(4);
const after = await dbg(() => ({ here: window.__universeDebug.pieces.destroyerHere, heat: window.__universeDebug.state.heat }));
check(!after.here, 'and it is gone');
check(after.heat >= 3.5, `heat for the kill: ${after.heat.toFixed(1)}`); // (it cools a little a second)

// 4. the newer characters: each comes by, flies, and has its say
await dbg(() => window.__universeDebug.hunters.clear());
const sideOf = { cruiser: 'rickmorty', xwing: 'starwars', falcon: 'starwars', rv: 'breakingbad' }[crew];
const who = await dbg((side) => Object.values(window.__universeDebug.NPCS).filter((c) => c.side === side && ['inspector', 'nemesis', 'tagalong', 'trickster'].includes(c.brain)).map((c) => c.id), sideOf);
console.log('characters:', who.join(', '));
for (const id of who) {
  await dbg(() => {
    window.__universeDebug.npcs.clear();
    window.__universeDebug.hunters.clear();
    window.__universeDebug.state.shield = 100;
  });
  await dbg((id) => window.__universeDebug.meetNpc(id), id);
  await page.waitForTimeout(400);
  const came = await dbg(() => window.__universeDebug.npcs.live.map((m) => ({ id: m.npc.id, brain: m.npc.brain, hp: m.hp, hpMax: m.hpMax })));
  check(came.length === 1 && came[0].id === id, `${id} came (${JSON.stringify(came)})`);
  // let it fly a while (the brains run on by hand): it should move, and say hello
  const before = await dbg(() => window.__universeDebug.npcs.live[0] && { ...window.__universeDebug.npcs.live[0].pos });
  await ffNpc(4);
  const now = await dbg(() => {
    const m = window.__universeDebug.npcs.live[0];
    return m && { pos: { ...m.pos }, said: [...m.said], hostile: m.hostile, targets: window.__universeDebug.npcs.targets.length, memory: { ...m.memory } };
  });
  if (now && before) {
    const moved = Math.hypot(now.pos.x - before.x, now.pos.y - before.y, now.pos.z - before.z);
    check(moved > 1, `${id} flew (${moved.toFixed(1)} units) and said: ${now.said.join(', ')}`);
    check(now.memory.met >= 1, `${id} remembers meeting you (${JSON.stringify(now.memory)})`);
    if (['nemesis'].includes(came[0]?.brain)) check(now.targets === 1, `${id} is on the guns`);
    await shot(`npc-${id}`);
    // and on, standing still: the law scans you clean (or busts you), the trickster takes his toll, the nemesis fights on, the tagalong chats
    await ffNpc(12);
    const later = await dbg(() => {
      const m = window.__universeDebug.npcs.live[0];
      return { said: m ? [...m.said] : null, live: window.__universeDebug.npcs.count, hunters: window.__universeDebug.hunters.count, hostile: m?.hostile ?? null };
    });
    console.log(`${id} later:`, JSON.stringify(later));
    const brain = came[0].brain;
    if (brain === 'inspector') check((later.said ?? []).includes('clean') || (later.said ?? []).includes('busted') || later.live === 0, `${id} scanned you`);
    if (brain === 'trickster') check((later.said ?? []).includes('paid') || later.live === 0, `${id} took his toll`);
    if (brain === 'nemesis') check(later.live === 1 && (later.said ?? []).includes('hello'), `${id} fights on`);
    if (brain === 'tagalong') check((later.said ?? []).includes('hello'), `${id} is along for the ride`);
  } else console.log(`${id}: gone already (${JSON.stringify(now)})`);
}

}

// 5. the jump itself, held still to look at, from where you sit (it drops
// in ahead of you and off to one side): a fifth of the way out of
// hyperspace (the nose no further than where it stops), and a fifth of the
// way back in (the stern no further back than where it was)
await dbg(() => {
  window.__universeDebug.npcs.clear();
  window.__universeDebug.hunters.clear();
  window.__universeDebug.director.soon('destroyer');
});
await page.waitForFunction(() => window.__universeDebug.pieces.capital.state === 'in' && window.__universeDebug.pieces.capital.age > 0.12, null, { timeout: 120000 }).catch(() => {});
const hold = () =>
  dbg(() => {
    const c = window.__universeDebug.pieces.capital;
    if (c.update.__held) return c.state;
    const real = c.update;
    const held = () => true;
    held.__held = real;
    c.update = held;
    return c.state;
  });
const release = () =>
  dbg(() => {
    const c = window.__universeDebug.pieces.capital;
    if (c.update.__held) c.update = c.update.__held;
  });
const inState = await hold();
console.log('held coming in:', inState, await dbg(() => +window.__universeDebug.pieces.capital.age.toFixed(2)));
await page.waitForTimeout(2500);
await shot('capital-streak-in');
await release();
await ff(1);
check(await dbg(() => window.__universeDebug.pieces.capital.state === 'here'), 'and it snapped to its shape');
await dbg(() => window.__universeDebug.pieces.leave());
await page.waitForFunction(() => window.__universeDebug.pieces.capital.state === 'out' && window.__universeDebug.pieces.capital.age > 0.12, null, { timeout: 60000 }).catch(() => {});
const outState = await hold();
console.log('held going out:', outState, await dbg(() => +window.__universeDebug.pieces.capital.age.toFixed(2)));
await page.waitForTimeout(2500);
await shot('capital-streak-out');
await release();
await ff(1);
check(await dbg(() => !window.__universeDebug.pieces.destroyerHere), 'and it is gone');

console.log(errors.length ? `page errors:\n${errors.join('\n')}` : 'no page errors');
check(errors.length === 0, 'no page errors');
await browser.close();
if (problems.length) {
  console.log(`\n${problems.length} problem(s)`);
  process.exit(1);
}
