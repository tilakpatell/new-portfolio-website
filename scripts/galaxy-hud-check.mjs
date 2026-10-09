/* global window, document, getComputedStyle */
// A browser check of the galaxy's flight HUD (galaxy/FlightCluster.jsx, cluster.js, radar.js, radarDraw.js, KeysCard.jsx; the
// course on the HUD: pages/Galaxy.jsx and scene.js). With the dev server up (npx vite --port 5188 --host 127.0.0.1, or BASE= for
// another), and after the galaxy map check's parts (galaxy-map-check/lib.mjs: the browser, the check line):
//   BASE=http://127.0.0.1:5188 OUT=/tmp/hud node scripts/galaxy-hud-check.mjs
// At 1440x900, 1280x720, 1366x657 and 390x844 (the last with a touch screen's rules: Chromium won't emulate the pointer, so the
// page's own `(pointer: coarse)` rules are turned on in place): opens #/galaxy, flies the X-wing two seconds, forces a battle
// sworn to the Rebellion, and
//   cluster: it's shown; no two of its parts, the jump button, the Galaxy map and Keys chips, the flight settings' button, the
//     multiplayer pill, the touch buttons (Fire, Boost, View, the climbs) and the power tiles meet (by measured box), and all are
//     inside the window; nothing in it a player reads is under 0.7 rem (11.2 px); each power tile's middle takes a click; on a
//     desktop the tiles say where they stand in words and a refused press says why (the big one, not charged yet)
//   keys: the card is up before the first flight (a desktop's) and clear of the cluster, gone once flown, back from the Keys chip
//   radar: drawn, with allies on it in the battle and the way to go; with the way to go (the course) turned right and left of the
//     nose, its dot is on the side the star is on screen (the camera's projection) and straight ahead it's at the top
//   target: T locks one, and its name is in the cluster
//   course: M, "endo" + Enter plots Endor, M again: the HUD's way-to-go says "Course: Endor", and J (with the nose on no star)
//     starts the jump
// Prints a line per check, ok or FAIL, and exits 1 on any FAIL. Shots are in OUT (hud-<size>.png, hud-<size>-keys.png).
import { browser, check, problems, out } from './galaxy-map-check/lib.mjs';

const base = process.env.BASE ?? 'http://127.0.0.1:5188';
const settle = (page, ms = 400) => page.waitForTimeout(ms);

// a galaxy at Tatooine, flown in an X-wing, nothing else open (the first-flight keys card up)
const open = async (viewport, touch) => {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(() => {
    window.localStorage.setItem('tp-3d', 'on');
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-sound', 'off');
    window.sessionStorage.setItem('tp-galaxy-intro', '1');
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !/GPU stall|swiftshader|WebGL|403/i.test(m.text()) && errors.push(m.text().slice(0, 200)));
  await page.goto(`${base}/#/galaxy`, { waitUntil: 'domcontentloaded' });
  await page.locator('text=An X-wing').first().click({ timeout: 180000 });
  await page.waitForFunction(() => typeof window.__galaxy === 'function' && window.__galaxy().system && window.__galaxy().ship && !window.__galaxy().jump, null, { timeout: 180000 });
  await settle(page, 1200);
  if (touch) await asTouch(page);
  return { ctx, page, errors };
};

// the page's own `(pointer: coarse)` rules on, its `(pointer: fine)` ones off, in place (a media rule's list is writable)
const asTouch = (page) =>
  page.evaluate(() => {
    let n = 0;
    const walk = (rules) => {
      for (const r of rules) {
        if (r.media) {
          const was = r.media.mediaText;
          const next = was.replaceAll('(pointer: coarse)', '(min-width: 0px)').replaceAll('(pointer: fine)', '(max-width: 0px)').replaceAll('(hover: hover)', '(max-width: 0px)').replaceAll('(hover: none)', '(min-width: 0px)');
          if (next !== was) {
            r.media.mediaText = next;
            n++;
          }
        }
        if (r.cssRules) walk(r.cssRules);
      }
    };
    for (const sheet of document.styleSheets) {
      try {
        walk(sheet.cssRules);
      } catch {
        /* a sheet from another origin */
      }
    }
    return n;
  });

// what's shown over the flight, by measured box: [{ name, r }]
const PARTS = [
  ['radar', '.fc-radar'],
  ['ship', '.fc-ship'],
  ['target', '.fc-target'],
  ['power G', '.ship-power[data-slot="primary"]'],
  ['power X', '.ship-power[data-slot="ultimate"]'],
  ['jump', '.galaxy-jumpbtn'],
  ['galaxy map', '.galaxy-mapbtn'],
  ['keys chip', '.galaxy-keysbtn'],
  ['keys card', '.galaxy-keys'],
  ['settings', '.universe-settings-btn'],
  ['multiplayer', '.universe-online-pill'],
  ['fire', '.universe-fire'],
  ['boost', '.universe-boost'],
  ['view', '.universe-view'],
  ['climb up', '.universe-climbs > .universe-climb:nth-child(1)'],
  ['climb down', '.universe-climbs > .universe-climb:nth-child(2)'],
];
const boxes = (page) =>
  page.evaluate((parts) => {
    const out = [];
    for (const [name, sel] of parts) {
      const el = document.querySelector(sel);
      if (!el || !el.checkVisibility({ visibilityProperty: true })) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) out.push({ name, l: r.left, t: r.top, r: r.right, b: r.bottom });
    }
    return out;
  }, PARTS);
const meets = (bs) => {
  const out = [];
  for (let i = 0; i < bs.length; i++)
    for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i];
      const b = bs[j];
      if (a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5) out.push(`${a.name}/${b.name}`);
    }
  return out;
};

// text a player reads under 0.7 rem (11.2 px) inside `root`
const smallText = (page, root) =>
  page.evaluate((sel) => {
    const bad = [];
    for (const el of document.querySelectorAll(`${sel}, ${sel} *`)) {
      const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim());
      if (!own.length || !el.checkVisibility()) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 11.19) bad.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} "${own[0].slice(0, 16)}" ${fs}px`);
    }
    return bad;
  }, root);

// the radar's canvas: how many pixels are drawn, and the centre of those within `hue`'s colours (a predicate on r, g, b)
const radarPixels = (page) =>
  page.evaluate(() => {
    const cv = document.querySelector('.fc-radar');
    const g = cv.getContext('2d');
    const { data, width, height } = g.getImageData(0, 0, cv.width, cv.height);
    const hues = {
      ally: (r, gr, b) => gr > 200 && r < 160 && b < 190,
      hostile: (r, gr, b) => r > 220 && gr < 120 && b < 110,
      goal: (r, gr, b) => r > 220 && gr > 170 && gr < 235 && b < 150,
    };
    const res = { drawn: 0, width, height };
    for (const k of Object.keys(hues)) res[k] = { n: 0, x: 0, y: 0 };
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (data[i + 3] < 8) continue;
        res.drawn++;
        if (data[i + 3] < 90) continue;
        for (const [k, f] of Object.entries(hues))
          if (f(data[i], data[i + 1], data[i + 2])) {
            res[k].n++;
            res[k].x += x;
            res[k].y += y;
          }
      }
    for (const k of Object.keys(hues)) if (res[k].n) (res[k].x /= res[k].n * width), (res[k].y /= res[k].n * height); // (as a share of the canvas)
    return res;
  });

const hold = async (page, key, ms) => {
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
};

async function run(viewport, touch) {
  const size = `${viewport.width}x${viewport.height}${touch ? ' touch' : ''}`;
  const file = `${viewport.width}x${viewport.height}`;
  const say = (ok, what) => check(ok, `${size}: ${what}`);
  const { ctx, page, errors } = await open(viewport, touch);
  const G = (fn, arg) => page.evaluate(fn, arg);

  // keys: before the first flight a desktop has the card
  if (!touch) {
    const k = await boxes(page);
    const card = k.find((b) => b.name === 'keys card');
    say(Boolean(card) && k.some((b) => b.name === 'keys chip'), 'the keys card is up before the first flight, and the Keys chip is there');
    say(meets(k).length === 0, `and meets nothing${meets(k).length ? ` (${meets(k).join(', ')})` : ''}`);
    say((await smallText(page, '.galaxy-keys')).length === 0, 'and nothing in it is under 0.7 rem');
    await page.screenshot({ path: `${out}/hud-${file}-keys.png` });
  }

  // fly, and a battle
  await hold(page, 'w', 2000);
  say(!(await page.locator('.galaxy-keys').count()), touch ? 'no keys card on a touch screen' : 'the keys card is gone once flown');
  const home = await G(() => {
    const s = window.__galaxy().ship;
    return { x: s.x, y: s.y, z: s.z, heading: s.heading };
  });
  await G(() => window.__galaxyOath?.swear('rebel'));
  await G(() => window.__galaxyDebug.war.force('empire', 'skirmish'));
  await page.waitForFunction(() => Boolean(window.__galaxyDebug.war.battle), null, { timeout: 30000 });
  await G(() => window.__galaxyDebug.war.skip(6));
  // (the ship among the other side's fighters, facing their middle, safe from them)
  await G(() => {
    const d = window.__galaxyDebug;
    const b = d.war.battle;
    const them = b.fighters.filter((f) => f.alive && f.team !== b.you.team);
    const c = them.reduce((a, f) => ({ x: a.x + f.pos.x / them.length, y: a.y + f.pos.y / them.length, z: a.z + f.pos.z / them.length }), { x: 0, y: 0, z: 0 });
    d.pin({ x: c.x + 12, y: c.y + 2, z: c.z, heading: Math.PI / 2, pitch: -0.1, bank: 0 });
    d.state.safeUntil = 1e12;
    d.state.shield = 100;
  });
  await settle(page, 3000);

  // the cluster, shown, nothing meeting
  await page.keyboard.down('w');
  await settle(page, 900);
  const on = await G(() => document.querySelector('.fc')?.hasAttribute('data-on') ?? false);
  say(on, 'the flight cluster is shown');
  const bs = await boxes(page);
  const names = bs.map((b) => b.name);
  for (const want of ['radar', 'ship', 'power G', 'power X', 'galaxy map', 'keys chip', 'settings']) if (!(touch && want === 'keys chip')) say(names.includes(want), `${want} is shown`);
  if (touch) for (const want of ['fire', 'boost', 'view', 'climb up', 'climb down']) say(names.includes(want), `${want} (a touch button) is shown`);
  else say(names.includes('target'), 'the target block is shown');
  const m = meets(bs);
  say(m.length === 0, `no two of the ${bs.length} parts shown meet${m.length ? ` (${m.join(', ')})` : ''}`);
  const out_ = bs.filter((b) => b.l < -0.5 || b.t < -0.5 || b.r > viewport.width + 0.5 || b.b > viewport.height + 0.5).map((b) => b.name);
  say(out_.length === 0, `and all are inside the window${out_.length ? ` (${out_.join(', ')})` : ''}`);
  const small = await smallText(page, '.fc');
  say(small.length === 0, `nothing in the cluster is under 0.7 rem${small.length ? ` (${small.slice(0, 4).join('; ')})` : ''}`);
  const clicks = await G(() =>
    [...document.querySelectorAll('.ship-power')].map((t) => {
      const a = t.getBoundingClientRect();
      const hit = document.elementFromPoint(a.x + a.width / 2, a.y + a.height / 2);
      return Boolean(hit && t.contains(hit));
    }),
  );
  say(clicks.length === 2 && clicks.every(Boolean), 'a click at each power tile\'s middle lands on it');
  if (!touch) {
    const words = await G(() => [...document.querySelectorAll('.ship-power-state')].map((e) => e.textContent));
    say(words.length === 2 && words.every(Boolean), `each power says where it stands (${words.join(' / ')})`);
    const x = await G(() => {
      const a = document.querySelector('.ship-power[data-slot="ultimate"]').getBoundingClientRect();
      return { x: a.x + a.width / 2, y: a.y + a.height / 2 };
    });
    await page.mouse.click(x.x, x.y);
    await settle(page, 300);
    const no = await G(() => {
      const t = document.querySelector('.ship-power[data-slot="ultimate"]');
      return { denied: t.hasAttribute('data-denied'), word: t.querySelector('.ship-power-state').textContent };
    });
    say(no.denied && /charg/i.test(no.word), `a press on the big one before it's charged is refused and says why (${no.word})`);
  }
  const n = await G(() => ({ shield: document.querySelector('.fc-shield-n')?.textContent, kills: document.querySelector('.fc-kills-n')?.textContent, speed: document.querySelector('.fc-speed-n')?.textContent }));
  say(/^\d+%$/.test(n.shield ?? ''), `the deflectors read a percentage (${n.shield})`);
  say(/^\d+$/.test(n.kills ?? ''), `and the kills a number (${n.kills})`);
  await page.screenshot({ path: `${out}/hud-${file}${touch ? '-touch' : ''}.png` });
  await page.keyboard.up('w');

  // the radar: drawn, with the battle's allies on it
  const px = await radarPixels(page);
  say(px.drawn > 300, `the radar is drawn (${px.drawn} px)`);
  say(px.ally.n > 5 || px.hostile.n > 5, `with the battle's ships on it (${px.ally.n} green px, ${px.hostile.n} red)`);

  // the target
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('t');
  await settle(page, 500);
  if (!touch) {
    const name = await G(() => document.querySelector('.fc-target-name')?.textContent ?? '');
    say(name.length > 0, `T locks a target and the cluster names it (${name})`);
  }

  // (back where the flight began, clear of the battle's hulls: a crash into one would end the HUD there, and the jump)
  await page.waitForFunction(() => !window.__galaxyDebug.state.crash, null, { timeout: 20000 });
  await G((h) => window.__galaxyDebug.pin({ ...h, pitch: 0, bank: 0 }), home);

  // the course: plotted on the map, kept on the HUD
  await page.keyboard.press('m');
  await page.waitForSelector('.holomap', { timeout: 10000 });
  await settle(page, 700);
  await page.keyboard.press('/');
  await page.keyboard.type('endo');
  await page.keyboard.press('Enter');
  await settle(page, 600);
  await page.keyboard.press('m'); // (the pick has the focus on its jump button now, not on the find)
  await page.waitForFunction(() => !document.querySelector('.holomap'), null, { timeout: 10000 });
  await settle(page, 800);
  const nav = await G(() => {
    const e = document.querySelector('.universe-nav');
    return { on: e?.hasAttribute('data-on') ?? false, name: e?.querySelector('.universe-nav-name')?.textContent ?? '' };
  });
  say(nav.on && /^Course: Endor/.test(nav.name), `the plotted course is on the HUD (${nav.name || 'nothing'})`);

  // the radar's way to go: right is right, ahead is the top
  const pose = await G(() => {
    const d = window.__galaxyDebug;
    const s = d.state.ship;
    const g = d.state.navGoal;
    const dx = g[0] - s.x;
    const dz = g[2] - s.z;
    return { x: s.x, y: s.y, z: s.z, toward: Math.atan2(-dx, -dz) };
  });
  const sides = [];
  for (const turn of [0.7, -0.7, 0]) {
    await G(({ p, turn }) => window.__galaxyDebug.pin({ x: p.x, y: p.y, z: p.z, heading: p.toward + turn, pitch: 0, bank: 0 }), { p: pose, turn });
    await settle(page, 700);
    const r = await G(() => {
      const d = window.__galaxyDebug;
      const g = d.state.navGoal;
      const v = new d.THREE.Vector3(g[0], g[1], g[2]);
      d.camera.updateMatrixWorld();
      v.project(d.camera);
      return { ndcX: v.x, ndcZ: v.z };
    });
    const px = await radarPixels(page);
    sides.push({ turn, ndcX: r.ndcX, goal: px.goal });
  }
  const [right, left, ahead] = sides;
  // (turned left of the star by 0.7, the star is to the right: on the screen and on the radar, both)
  const side = (s) => (s.goal.n ? (s.goal.x > 0.5 ? 'right' : 'left') : 'none');
  say(right.ndcX > 0.05 && side(right) === 'right', `a star to the right on the screen (${right.ndcX.toFixed(2)}) is on the radar's right (x ${right.goal.x.toFixed(2)})`);
  say(left.ndcX < -0.05 && side(left) === 'left', `and one to the left (${left.ndcX.toFixed(2)}) on its left (x ${left.goal.x.toFixed(2)})`);
  say(ahead.goal.n > 0 && Math.abs(ahead.goal.x - 0.5) < 0.06 && ahead.goal.y < 0.2, `and one dead ahead at the top (x ${ahead.goal.x.toFixed(2)}, y ${ahead.goal.y.toFixed(2)})`);

  // J with the nose on no star: to the course
  let free = false;
  for (let turn = 1.4; turn < 3.2 && !free; turn += 0.35) {
    await G(({ p, turn }) => window.__galaxyDebug.pin({ x: p.x, y: p.y, z: p.z, heading: p.toward + turn, pitch: 0, bank: 0 }), { p: pose, turn });
    await settle(page, 400);
    free = (await G(() => window.__galaxy().aim)) === null;
  }
  say(free, 'the nose is on no star');
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('j');
  await settle(page, 800);
  const jumping = await G(() => window.__galaxy().jump);
  say(jumping?.to === 'endor', `J jumps to the course (${JSON.stringify(jumping)})`);

  say(errors.length === 0, `no page errors${errors.length ? ` (${errors.slice(0, 3).join('; ')})` : ''}`);
  await ctx.close();
}

const stopped = (size, e) => check(false, `${size}: the check stopped: ${String(e.message).split('\n')[0]}`);
for (const [viewport, touch] of [[{ width: 1440, height: 900 }, false], [{ width: 1280, height: 720 }, false], [{ width: 1366, height: 657 }, false], [{ width: 390, height: 844 }, true]]) {
  await run(viewport, touch).catch((e) => stopped(`${viewport.width}x${viewport.height}`, e));
}
await browser.close();
console.log(problems.length ? `\n${problems.length} problem(s)` : '\nall ok');
process.exit(problems.length ? 1 : 0);
