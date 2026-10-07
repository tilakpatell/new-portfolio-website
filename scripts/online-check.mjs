/* global window, document */
// A browser check of multiplayer across the worlds, on the real relays: two
// visitors (Alpha and Bravo, two browser profiles) go online, open the same
// world, and each should see the other there (the world's "N here" chip goes
// to 1, and the roster says they're "here"); then Bravo moves on to another
// world and Alpha's roster should say where, by name, with Bravo's level
// chip. With the dev server up (npx vite --port 5173; PORT=5174 for another):
//   node scripts/online-check.mjs [/middle-earth/bree /avengers ...] [--then /middle-earth/moria]
//   node scripts/online-check.mjs --universe
// --universe: both fly the universe map instead (Alpha the X-wing, Bravo the
// Falcon); Bravo is put 300 units off Alpha's nose and Alpha's tag for them
// should be the far one (callsign and distance, 12px at least on screen, in
// the tags box, on a phone's width too), then close by, the full one with
// its level chip.
// (behind a proxy: HTTPS_PROXY, and BRIDGE=1 NODE_USE_ENV_PROXY=1 if the
// browser's WebSockets can't get through it)
// The relays are public, so anyone else online at the time is counted too:
// it checks for at least one. Headless Chromium draws in software, slowly.
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : dflt;
};
const universe = args.includes('--universe');
if (universe) args.splice(args.indexOf('--universe'), 1);
const then = universe ? null : flag('--then', '/middle-earth/moria');
const out = process.env.OUT ?? null;
const worlds = args.length ? args : ['/middle-earth/bree'];
const BASE = `http://localhost:${process.env.PORT ?? 5173}/?quality=low#`;
// (behind a proxy, the relays go through it and the dev server doesn't)
// (behind a proxy that re-signs TLS, PROXY_CA_SPKI is its CA's key hash, for
// a browser profile that doesn't trust it yet)
const proxy = process.env.HTTPS_PROXY ? [`--proxy-server=${process.env.HTTPS_PROXY}`, '--proxy-bypass-list=localhost;127.0.0.1'] : [];
if (process.env.PROXY_CA_SPKI) proxy.push(`--ignore-certificate-errors-spki-list=${process.env.PROXY_CA_SPKI}`, '--disable-http2');
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium', args: [...proxy, '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });

const errors = [];
async function visitor(name, ship = null) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(([n, ship]) => {
    window.localStorage.setItem('tp-intro', '1');
    if (ship) window.localStorage.setItem('tp-universe-ship', JSON.stringify(ship));
    window.localStorage.setItem('tp-universe-online', JSON.stringify('on'));
    window.localStorage.setItem('tp-universe-callsign', JSON.stringify(n));
    // (headless Chromium draws in software: load the worlds and play anyway,
    // as someone on a slow machine would choose to)
    window.localStorage.setItem('tp-worlds', JSON.stringify('load'));
    window.sessionStorage.setItem('tp-gl-anyway', 'true');
  }, [name, ship]);
  // BRIDGE=1: the relays reached from here (Node, which goes through a proxy
  // with NODE_USE_ENV_PROXY=1) rather than from the browser, for a proxy
  // that won't pass a browser's WebSocket upgrade
  if (process.env.BRIDGE)
    await ctx.routeWebSocket(/^wss:\/\//, (ws) => {
      const up = new WebSocket(ws.url());
      const waiting = [];
      up.onopen = () => waiting.splice(0).forEach((m) => up.send(m));
      up.onmessage = (e) => typeof e.data === 'string' && ws.send(e.data);
      up.onclose = () => ws.close();
      up.onerror = () => ws.close();
      ws.onMessage((m) => (up.readyState === 1 ? up.send(m) : waiting.push(m)));
      ws.onClose(() => up.close());
    });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name}: ${m.text()}`));
  return page;
}

// the number on the world's chip ("1 traveller here", "2 other Mortys here",
// "3 listeners here"), or null: any element reading "<n> … here" outside the
// site's online corner (whose "· 1 here" is the page's, not the world's)
const chip = (page) =>
  page.evaluate(() => {
    for (const el of document.querySelectorAll('span, p, b, div, button')) {
      if (el.closest('.universe-online')) continue;
      const m = /^(\d+)\s*(?:other\s+)?[a-z’']+\s+here$/i.exec(el.textContent.trim());
      if (m) return Number(m[1]);
    }
    return null;
  });
// a world whose 3D waits to be asked for (the office's, the music room's),
// or that puts you in it only once you start (the Caribbean's voyage, and
// on a slow graphics chip, its "play anyway"): ask,
// whenever the button's there
// (a click in the page itself: the game's buttons sit below the fold of a
// canvas Playwright never counts as settled)
const start = (page) =>
  page
    .evaluate(() => [...document.querySelectorAll('button')].find((b) => /^(Load the |Weigh anchor|Play anyway)/.test(b.textContent.trim()))?.click())
    .catch(() => {});
// the roster's line for a callsign, opened from the corner
async function rosterLine(page, who) {
  const pill = page.locator('.universe-online-pill').first();
  if ((await pill.getAttribute('aria-expanded')) !== 'true') await pill.click();
  const line = page.locator('.universe-online-pilot', { hasText: who }).first();
  await line.waitFor({ timeout: 60000 });
  return (await line.textContent()).replace(/\s+/g, ' ').trim();
}
const waitFor = async (fn, ms, what) => {
  const t = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t > ms) throw new Error(`timed out: ${what}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
};

const a = await visitor('Alpha', universe ? 'xwing' : null);
const b = await visitor('Bravo', universe ? 'falcon' : null);
let failed = 0;
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failed++;
};

// ── On the universe map: the tags ──
// Bravo put `dist` units off Alpha's nose, both held still
const placeBravo = async (dist) => {
  const at = await a.evaluate(() => ({ ...window.__universeDebug.state.ship }));
  await a.evaluate(() => Object.assign(window.__universeDebug.state.ship, { speed: 0, pitch: 0 }));
  await b.evaluate(
    ([at, dist]) => Object.assign(window.__universeDebug.state.ship, { x: at.x - Math.sin(at.heading) * dist, y: at.y, z: at.z - Math.cos(at.heading) * dist, heading: at.heading, pitch: 0, speed: 0 }),
    [at, dist],
  );
};
// Alpha's tag for Bravo, as drawn: its mode, text, level, the type's size on
// screen (the font times the tag's scale) and whether it's inside the tags box
const tagOf = (page, who) =>
  page.evaluate((who) => {
    const tag = [...document.querySelectorAll('.universe-tag[data-on]')].find((t) => t.querySelector('b')?.textContent === who);
    if (!tag) return null;
    const box = tag.parentElement.getBoundingClientRect();
    const r = tag.getBoundingClientRect();
    const scale = Number(/scale\(([\d.]+)\)/.exec(tag.style.transform)?.[1] ?? 1);
    const font = parseFloat(window.getComputedStyle(tag.querySelector('b')).fontSize);
    const shown = (sel) => window.getComputedStyle(tag.querySelector(sel)).display !== 'none';
    return {
      mode: tag.dataset.mode,
      relation: tag.dataset.relation,
      level: shown('em') ? tag.querySelector('em').textContent : null,
      dist: tag.querySelector('small').textContent,
      px: +(font * scale).toFixed(2),
      opacity: window.getComputedStyle(tag).opacity,
      inside: r.left >= box.left - 0.5 && r.right <= box.right + 0.5 && r.top >= box.top - 0.5 && r.bottom <= box.bottom + 0.5,
    };
  }, who);
if (universe) {
  await Promise.all([a.goto(BASE + '/universe'), b.goto(BASE + '/universe')]);
  try {
    for (const p of [a, b]) await p.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship, null, { timeout: 180000 });
    await waitFor(() => a.evaluate(() => [...(window.__universeDebug.net()?.peers.values() ?? [])].some((p) => p.name === 'Bravo' && p.snaps.length)), 120000, 'Alpha hears Bravo on the map');
    console.log('ok   Alpha hears Bravo on the map');
    await placeBravo(300);
    const far = await waitFor(async () => {
      await placeBravo(300);
      const t = await tagOf(a, 'Bravo');
      return t?.mode === 'far' ? t : null;
    }, 60000, 'the far tag');
    check(/^\d(\.\d)? ?k?m$|^\d+ m$/.test(far.dist) && far.px >= 12 && far.inside && far.level === null, `far tag at 300 units: ${JSON.stringify(far)}`);
    if (out) await a.screenshot({ path: `${out}/tags-far.png`, timeout: 120000 });
    await a.setViewportSize({ width: 360, height: 740 });
    const phone = await waitFor(async () => {
      await placeBravo(300);
      const t = await tagOf(a, 'Bravo');
      return t?.mode === 'far' ? t : null;
    }, 60000, 'the far tag on a phone');
    check(phone.px >= 12 && phone.inside, `far tag on a phone: ${JSON.stringify(phone)}`);
    if (out) await a.screenshot({ path: `${out}/tags-phone.png`, timeout: 120000 });
    await a.setViewportSize({ width: 1280, height: 800 });
  } catch (e) {
    failed++;
    console.log(`FAIL ${e.message}`);
    // what Alpha had: its ship, Bravo's last pose, the tags
    const seen = await a
      .evaluate(() => {
        const d = window.__universeDebug;
        const bravo = [...(d.net()?.peers.values() ?? [])].find((p) => p.name === 'Bravo');
        return { ship: d.state.ship, bravo: bravo?.pose ?? null, where: bravo?.where, tags: [...document.querySelectorAll('.universe-tag')].map((t) => ({ on: t.hasAttribute('data-on'), text: t.textContent, mode: t.dataset.mode })) };
      })
      .catch((err) => ({ error: String(err) }));
    console.log(`     Alpha: ${JSON.stringify(seen)}`);
    if (out) await a.screenshot({ path: `${out}/fail-universe.png` }).catch(() => {});
  }
}

for (const w of universe ? [] : worlds) {
  await Promise.all([a.goto(BASE + w), b.goto(BASE + w)]);
  try {
    const n = await waitFor(async () => {
      await Promise.all([start(a), start(b)]);
      const [x, y] = [await chip(a), await chip(b)];
      return x >= 1 && y >= 1 ? [x, y] : null;
    }, 150000, `${w}: each sees the other`);
    const pointers = await a.locator('.presence-pilot').count();
    console.log(`ok   ${w}: chips ${n.join(' / ')}, page pointers drawn: ${pointers}`);
    if (pointers) {
      failed++;
      console.log(`FAIL ${w}: page pointers over the world`);
    }
    if (out) await a.screenshot({ path: `${out}/online${w.replace(/\//g, '-')}.png` });
  } catch (e) {
    failed++;
    console.log(`FAIL ${e.message}`);
    // what each saw: the corner, any "here" chip, the world's buttons
    for (const [who, p] of [['Alpha', a], ['Bravo', b]]) {
      const seen = await p
        .evaluate(() => ({
          corner: document.querySelector('.universe-online-pill')?.textContent ?? null,
          here: [...document.querySelectorAll('[data-on], button')].map((el) => el.textContent.trim()).filter((t) => /here|other|online/i.test(t)).slice(0, 6),
          buttons: [...document.querySelectorAll('button')].map((el) => el.textContent.trim()).filter(Boolean).slice(0, 12),
        }))
        .catch((err) => ({ error: String(err) }));
      console.log(`     ${who}: ${JSON.stringify(seen)}`);
      if (out) await p.screenshot({ path: `${out}/fail${w.replace(/\//g, '-')}-${who}.png` }).catch(() => {});
    }
  }
}
if (then) {
  try {
    await b.goto(BASE + then);
    const line = await waitFor(async () => {
      const l = await rosterLine(a, 'Bravo').catch(() => '');
      return l.includes('here') ? null : l || null;
    }, 90000, `roster names where Bravo went (${then})`);
    console.log(`ok   roster: ${line}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${e.message}`);
  }
}
console.log(`errors: ${JSON.stringify(errors.slice(0, 10))}`);
console.log(failed ? `${failed} FAILED` : 'ALL OK');
await browser.close();
process.exit(failed ? 1 : 0);
