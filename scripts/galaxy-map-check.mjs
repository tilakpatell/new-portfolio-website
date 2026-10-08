/* global window, document, getComputedStyle, innerWidth, innerHeight, createImageBitmap, OffscreenCanvas, SVGElement, MutationObserver */
// A browser check of the galaxy map (galaxy/HoloMap.jsx, labelPlace.js,
// mapView.js, useMapView.js, mapKeys.js). With the dev server up (npx vite
// --port 5188 --host 127.0.0.1, or BASE= for another):
//   BASE=http://127.0.0.1:5188 OUT=/tmp/map node scripts/galaxy-map-check.mjs
// It starts nothing itself. Opens #/galaxy, flies the X-wing, presses M, and at
// 1440x900, 1280x720 and 390x844 (and, for the phone's side panel, 375x667):
//   names: no two system names meet, none is out of the map (whole, zoomed in
//     twice over Hoth, framed on Endor); nothing a player reads is under 0.7
//     rem (11.2 px; the SVG's text by its rendered size); the strip, layers,
//     key and zoom buttons clear of one another; the whole, Hoth and Endor shots
//   find: "endo" + Enter picks Endor and has it on view; J then jumps; a
//     YOU tag on the system you're at
//   zoom: the wheel zooms about the pointer, + - 0, a drag pans and never picks
//     the system it starts on (or ends over); Tab through the systems zoomed
//     in keeps the box from scrolling and frames each one focused
//   panels: the layers (and the chip on a phone), the era chips dim what isn't
//     of the era, the films' panel (Escape shuts it, not the map), the key (a
//     wheel over it scrolls it and not the page behind; on a phone it keeps off
//     the zoom buttons), the hover card staying inside the map, the side panel
//     on a short phone still showing the jump
//   keys: M (held, too) and Escape close it, / finds
//   sharp: zoomed in, the stage is as sharp as without will-change
// Prints a line per check, ok or FAIL, and exits 1 on any FAIL. Shots are in
// OUT (map-<size>-<what>.png).
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';

const out = process.env.OUT ?? '.';
const base = process.env.BASE ?? 'http://127.0.0.1:5188';
const mac = `${homedir()}/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const chrome = process.env.CHROME ?? (existsSync(mac) ? mac : '/opt/pw-browsers/chromium-1194/chrome-linux/chrome');
const args = process.platform === 'darwin' ? ['--use-angle=metal', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
mkdirSync(out, { recursive: true });
const problems = [];
const check = (ok, what) => {
  console.log(ok ? 'ok  ' : 'FAIL', what);
  if (!ok) problems.push(what);
};
const browser = await chromium.launch({ executablePath: chrome, args });

// the page's side of the check: where things are on the map
const pageHelpers = () => {
  window.__mc = {
    map: () => document.querySelector('.holomap-map')?.getBoundingClientRect(),
    sys: (id) => document.querySelector(`.holomap-name[data-id="${id}"]`)?.closest('li')?.querySelector('.holomap-system') ?? null,
    dot(id) {
      const b = this.sys(id)?.getBoundingClientRect();
      return b ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null;
    },
    // (the stage's zoom and where it's moved to)
    view() {
      const cs = getComputedStyle(document.querySelector('.holomap-stage'));
      return { k: parseFloat(cs.getPropertyValue('--k')), x: parseFloat(cs.getPropertyValue('--vx')), y: parseFloat(cs.getPropertyValue('--vy')) };
    },
    onView(p, pad = 0.04) {
      const m = this.map();
      return Boolean(p && m && p.x >= m.left + pad * m.width && p.x <= m.right - pad * m.width && p.y >= m.top + pad * m.height && p.y <= m.bottom - pad * m.height);
    },
    picked: () => [...document.querySelectorAll('.holomap-system[aria-pressed="true"]')].map((b) => b.closest('li').querySelector('.holomap-name').dataset.id),
    // (the ones whose dot has nothing over it: a press there lands on the system)
    free() {
      return this.onViewIds().filter((id) => document.elementFromPoint(this.dot(id).x, this.dot(id).y)?.closest('.holomap-system') === this.sys(id));
    },
    // (the map's ids with their dots, on the view only)
    onViewIds() {
      return [...document.querySelectorAll('.holomap-name[data-id]')].map((n) => n.dataset.id).filter((id) => this.onView(this.dot(id), 0.02));
    },
    shown: (el) => Boolean(el) && el.checkVisibility({ visibilityProperty: true }) && el.getBoundingClientRect().width > 0,
  };
};

// a galaxy at Tatooine, flown in an X-wing, the map open
const open = async (viewport) => {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(() => {
    window.localStorage.setItem('tp-3d', 'on');
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-sound', 'off');
    window.sessionStorage.setItem('tp-galaxy-intro', '1');
  });
  await ctx.addInitScript(pageHelpers);
  const page = await ctx.newPage();
  const errors = [];
  let watching = false;
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => watching && m.type() === 'error' && !/GPU stall|swiftshader|WebGL|403/i.test(m.text()) && errors.push(m.text().slice(0, 200)));
  await page.goto(`${base}/#/galaxy`, { waitUntil: 'domcontentloaded' });
  await page.locator('text=An X-wing').first().click({ timeout: 180000 });
  await page.waitForFunction(() => typeof window.__galaxy === 'function' && window.__galaxy().system && window.__galaxy().ship && !window.__galaxy().jump, null, { timeout: 180000 });
  const reopen = async () => {
    await page.keyboard.press('m');
    await page.waitForSelector('.holomap', { timeout: 10000 });
    await page.waitForTimeout(700);
  };
  await reopen();
  watching = true;
  return { ctx, page, errors, reopen };
};

const settle = (page, ms = 550) => page.waitForTimeout(ms); // (the stage's 0.18 s, and the names' placing)
// (till the stage has stopped moving: its box the same twice, 120 ms apart)
const still = async (page) => {
  let was = '';
  for (let i = 0; i < 30; i++) {
    const now = await page.evaluate(() => JSON.stringify(document.querySelector('.holomap-stage').getBoundingClientRect()));
    if (now === was) return;
    was = now;
    await page.waitForTimeout(120);
  }
};
const J = (page, fn, arg) => page.evaluate(fn, arg);
const hasMap = (page) => page.locator('.holomap').count().then((n) => n > 0);

// the names on view: any two meeting, any outside the map
const namesProblems = (page) =>
  J(page, () => {
    const map = window.__mc.map();
    const tol = 0.5;
    const rows = [...document.querySelectorAll('.holomap-name[data-id]')]
      .map((el) => ({ id: el.dataset.id, r: el.getBoundingClientRect(), d: window.__mc.dot(el.dataset.id) }))
      .filter((n) => n.d.x >= map.left && n.d.x <= map.right && n.d.y >= map.top && n.d.y <= map.bottom);
    const meets = [];
    for (let i = 0; i < rows.length; i++)
      for (let j = i + 1; j < rows.length; j++) {
        const a = rows[i].r;
        const b = rows[j].r;
        if (a.left < b.right - tol && b.left < a.right - tol && a.top < b.bottom - tol && b.top < a.bottom - tol) meets.push(`${rows[i].id}/${rows[j].id}`);
      }
    // (the controls over the map, by what's drawn: the strip's title by its words)
    const textBox = (el) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      return r.getBoundingClientRect();
    };
    const controls = [];
    for (const el of document.querySelectorAll('.holomap-strip-war')) if (window.__mc.shown(el)) controls.push({ what: 'strip', r: textBox(el) });
    for (const el of document.querySelectorAll('.holomap-strip-board, .holomap-layers-toggle, .holomap-layers-set button, .holomap-legend-toggle, .holomap-zoom button')) if (window.__mc.shown(el)) controls.push({ what: el.className.split(' ')[0].replace('holomap-', '') || el.tagName.toLowerCase(), r: el.getBoundingClientRect() });
    const under = [];
    for (const n of rows)
      for (const c of controls) if (n.r.left < c.r.right - 1 && c.r.left < n.r.right - 1 && n.r.top < c.r.bottom - 1 && c.r.top < n.r.bottom - 1) under.push(`${n.id}/${c.what}`);
    const outside = rows.filter(({ r }) => r.left < map.left - tol || r.right > map.right + tol || r.top < map.top - tol || r.bottom > map.bottom + tol).map((n) => n.id);
    return { n: rows.length, meets, outside, under };
  });

// text in the map under 0.7 rem (11.2 px); the SVG's by what it renders at
const smallText = (page) =>
  J(page, () => {
    const bad = [];
    for (const el of document.querySelectorAll('.holomap *')) {
      if (el instanceof SVGElement) continue;
      const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim());
      if (!own.length || !el.checkVisibility()) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 11.19) bad.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} "${own[0].slice(0, 20)}" ${fs}px`);
    }
    for (const t of document.querySelectorAll('.holomap svg text')) {
      if (!t.checkVisibility()) continue;
      const h = t.getBoundingClientRect().height;
      const m = t.getScreenCTM(); // (its own rotation's in it: the scale is the length of a column)
      const px = parseFloat(getComputedStyle(t).fontSize) * (m ? Math.hypot(m.a, m.b) : 0);
      if (h < 10 || px < 11.19) bad.push(`svg text "${t.textContent.slice(0, 20)}" ${px.toFixed(1)}px, ${h.toFixed(1)} tall`);
    }
    return bad;
  });

// the strip, layers, key and zoom buttons shown, any two meeting
const overlayProblems = (page) =>
  J(page, () => {
    // (each by what's drawn: the strip's title is as wide as its column, the layers' box wider than its chips)
    const textBox = (el) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      return r.getBoundingClientRect();
    };
    const boxes = [];
    for (const el of document.querySelectorAll('.holomap-strip-war')) if (window.__mc.shown(el)) boxes.push({ name: 'strip', r: textBox(el) });
    const parts = { strip: '.holomap-strip-board', layers: '.holomap-layers-toggle, .holomap-layers-set button', key: '.holomap-legend-toggle, .holomap-legend-panel', zoom: '.holomap-zoom button' };
    for (const [name, sel] of Object.entries(parts)) for (const el of document.querySelectorAll(sel)) if (window.__mc.shown(el)) boxes.push({ name, r: el.getBoundingClientRect() });
    const meets = [];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (a.name !== b.name && a.r.left < b.r.right - 1 && b.r.left < a.r.right - 1 && a.r.top < b.r.bottom - 1 && b.r.top < a.r.bottom - 1) meets.push(`${a.name}/${b.name}`);
      }
    return meets;
  });

// the mean step between neighbouring pixels of a PNG: how sharp its lines are
const edgeEnergy = (page, png) =>
  J(
    page,
    async (b64) => {
      const bmp = await createImageBitmap(new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))]));
      const g = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d');
      g.drawImage(bmp, 0, 0);
      const { data, width, height } = g.getImageData(0, 0, bmp.width, bmp.height);
      let sum = 0;
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width - 1; x++) {
          const i = (y * width + x) * 4;
          sum += Math.abs(data[i + 4] + data[i + 5] + data[i + 6] - data[i] - data[i + 1] - data[i + 2]);
        }
      return sum / (width - 1) / height / 3;
    },
    png.toString('base64'),
  );

const suite = async (viewport, { full = true } = {}) => {
  const size = `${viewport.width}x${viewport.height}`;
  const say = (ok, what) => check(ok, `${size}: ${what}`);
  const { ctx, page, errors, reopen } = await open(viewport);
  const snap = async (what) => {
    await page.mouse.move(2, 2); // (off the dots: no hover card in the shot)
    await settle(page, 250);
    await page.locator('.holomap-frame').screenshot({ path: `${out}/map-${size}-${what}.png` });
  };
  const names = async (when, all = false) => {
    const r = await namesProblems(page);
    const total = await J(page, () => document.querySelectorAll('.holomap-name[data-id]').length);
    say(all ? r.n === total : r.n >= 3, `${when}: ${r.n} of ${total} names on view`);
    say(r.meets.length === 0, `${when}: no two names meet${r.meets.length ? ` (${r.meets.slice(0, 6).join(', ')})` : ''}`);
    say(r.outside.length === 0, `${when}: every name inside the map${r.outside.length ? ` (${r.outside.slice(0, 6).join(', ')})` : ''}`);
    // (not on a phone: the lower right's too crowded to clear the zoom buttons there; Kamino and Geonosis run under them at 390 wide)
    if (all && !phone) say(r.under.length === 0, `${when}: no name under the strip, layers, key or zoom buttons${r.under.length ? ` (${r.under.slice(0, 6).join(', ')})` : ''}`);
  };
  const phone = viewport.width <= 560;

  // ── the whole map: names apart, nothing under 0.7 rem, the overlays clear ──
  await names('whole', true);
  const meets = await overlayProblems(page);
  say(meets.length === 0, `the strip, layers, key and zoom buttons clear of one another${meets.length ? ` (${meets.join(', ')})` : ''}`);
  await snap('whole');
  // (with the films' panel open, and on a phone the layers' chip, then the key, so all their text is looked at)
  const layersChip = page.locator('.holomap-layers-toggle');
  if (await layersChip.isVisible()) await layersChip.click(); // (a press outside the films' panel shuts it: the chip first)
  await page.locator('.holomap-filmpick summary').click();
  await settle(page, 300);
  const small = await smallText(page);
  await snap('panels');
  await page.keyboard.press('Escape'); // (the films' panel first)
  say(await hasMap(page), 'Escape shuts the films panel and the map stays');
  say(!(await J(page, () => document.querySelector('details.holomap-filmpick').open)), 'the films panel is shut by Escape');
  if (await layersChip.isVisible()) await layersChip.click();
  await page.locator('.holomap-legend-toggle').click();
  await settle(page, 300);
  small.push(...(await smallText(page)));
  say(small.length === 0, `nothing under 0.7 rem (11.2 px)${small.length ? `: ${[...new Set(small)].slice(0, 5).join('; ')}` : ''}`);
  await page.locator('.holomap-legend-toggle').click();
  await settle(page, 300);

  // ── zoom: the wheel about the pointer, twice over Hoth ──
  const hoth = await J(page, () => window.__mc.dot('hoth'));
  await page.mouse.move(hoth.x, hoth.y);
  await page.mouse.wheel(0, -120);
  await settle(page);
  await page.mouse.wheel(0, -120);
  await settle(page);
  const v2 = await J(page, () => window.__mc.view());
  const hoth2 = await J(page, () => window.__mc.dot('hoth'));
  say(Math.abs(v2.k - 2.25) < 0.05, `two wheel notches zoom to 2.25 (${v2.k.toFixed(2)})`);
  say(Math.hypot(hoth2.x - hoth.x, hoth2.y - hoth.y) < 3, `the wheel zooms about the pointer (Hoth moved ${Math.hypot(hoth2.x - hoth.x, hoth2.y - hoth.y).toFixed(1)} px)`);
  await names('zoomed over Hoth');
  await snap('hoth');

  // ── a drag pans and never picks the system it starts on or ends over ──
  await page.mouse.move(2, 2);
  await page.keyboard.press('0');
  await settle(page);
  await page.keyboard.press('+');
  await settle(page);
  for (let i = 0; i < 2 && (await J(page, () => window.__mc.free().length)) < 4; i++) {
    await page.keyboard.press('+'); // (till a few systems can be pressed: the strip covers some on a phone)
    await settle(page);
  }
  const pickBefore = await J(page, () => window.__mc.picked());
  const vBefore = await J(page, () => window.__mc.view());
  const ids = await J(page, () => window.__mc.free());
  say(ids.length >= 3, `${ids.length} systems to press when zoomed in (k=${(await J(page, () => window.__mc.view().k)).toFixed(2)})`);
  const a = await J(page, (id) => window.__mc.dot(id), ids[0]);
  // the nearest other system that can be pressed, to end the second drag over
  const near = await J(
    page,
    ([from, list]) => {
      const p = window.__mc.dot(from);
      return list
        .filter((id) => id !== from)
        .map((id) => ({ id, d: Math.hypot(window.__mc.dot(id).x - p.x, window.__mc.dot(id).y - p.y) }))
        .sort((s, t) => s.d - t.d)[0];
    },
    [ids[0], ids],
  );
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(a.x + i * 10, a.y + i * 6);
  await page.mouse.up();
  await settle(page, 300);
  const vAfter = await J(page, () => window.__mc.view());
  say(vAfter.x !== vBefore.x || vAfter.y !== vBefore.y, `a drag from a system's dot pans the map (${ids[0]})`);
  say(JSON.stringify(await J(page, () => window.__mc.picked())) === JSON.stringify(pickBefore), `a 60 px drag starting on ${ids[0]}'s dot doesn't pick it`);
  const b = await J(page, (id) => window.__mc.dot(id), near.id);
  await page.mouse.move(b.x, b.y);
  await page.mouse.down();
  await page.mouse.move(b.x - 12, b.y - 12, { steps: 3 }); // (the map pans with it: the other's dot ends up under the pointer, or near)
  const c = await J(page, (id) => window.__mc.dot(id), ids[0]);
  await page.mouse.move(c.x, c.y, { steps: 6 });
  await page.mouse.up();
  await settle(page, 300);
  say(JSON.stringify(await J(page, () => window.__mc.picked())) === JSON.stringify(pickBefore), `a drag from ${near.id} to ${ids[0]} doesn't pick either`);
  // (a click does: the drag check isn't passing for want of a pick)
  const [again] = await J(page, () => window.__mc.free());
  const d = await J(page, (id) => window.__mc.dot(id), again);
  await page.mouse.click(d.x, d.y);
  say((await J(page, () => window.__mc.picked())).includes(again), `a click on ${again} picks it`);

  // ── keys: + − 0 zoom ──
  await page.keyboard.press('0');
  await settle(page);
  say((await J(page, () => window.__mc.view())).k === 1, '0 shows the whole galaxy');
  await page.keyboard.press('+');
  await settle(page);
  say(Math.abs((await J(page, () => window.__mc.view())).k - 1.5) < 0.01, '+ zooms in a step');
  await page.keyboard.press('-');
  await settle(page);
  say((await J(page, () => window.__mc.view())).k === 1, '- zooms out a step');

  // ── find: "endo" + Enter picks Endor and has it on view; the YOU tag; J jumps (last) ──
  const find = page.locator('input[type=search][aria-label="Find a system"]');
  await page.keyboard.press('/');
  say(await J(page, () => document.activeElement?.matches('input[type=search]')), '/ goes to the find field');
  await page.keyboard.type('endo');
  await page.keyboard.press('Enter');
  await settle(page, 900);
  say((await J(page, () => window.__mc.sys('endor')?.getAttribute('aria-pressed'))) === 'true', 'find "endo" + Enter picks Endor');
  say(await J(page, () => window.__mc.onView(window.__mc.dot('endor'))), 'and Endor is on view');
  say((await find.inputValue()) === '', 'the find field is emptied');
  await names('framed on Endor');
  await snap('endor');
  const here = await J(page, () => window.__galaxy().system);
  const you = await J(page, () => {
    const t = document.querySelector('.holomap-youtag');
    return { shown: window.__mc.shown(t), on: t?.closest('li')?.querySelector('.holomap-system')?.getAttribute('aria-current'), inside: window.__mc.onView({ x: t?.getBoundingClientRect().left + 1, y: t?.getBoundingClientRect().top + 1 }, 0) };
  });
  say(you.shown && you.on === 'location' && you.inside, `a YOU tag is visible on ${here}, the system you're at`);
  const tags = await J(page, () => document.querySelectorAll('.holomap-youtag').length);
  say(tags === 1, 'and only the one');

  // ── layers ──
  const toggle = page.locator('.holomap-layers-toggle');
  const chip = await toggle.isVisible();
  if (chip) await toggle.click();
  const layer = (label) => page.locator('.holomap-layers-set button', { hasText: new RegExp(`^${label}$`) });
  await layer('Regions').click();
  say((await J(page, () => document.querySelectorAll('.holomap-region, .holomap-region-name, .holomap-unknown').length)) === 0, 'Regions off: its rings and names go');
  await layer('Regions').click();
  say((await J(page, () => document.querySelectorAll('.holomap-region').length)) > 0, 'Regions on: they come back');
  await layer('Fronts').click();
  say(!(await J(page, () => document.querySelector('.holomap-map').hasAttribute('data-fronts'))), 'Fronts off: the war marks go off the systems');
  await layer('Fronts').click();
  await layer('Grid').click();
  say((await J(page, () => document.querySelectorAll('.holomap-axis span').length)) > 0, 'Grid on: its letters and numbers show');
  await layer('Grid').click();
  if (chip) await toggle.click();

  // ── eras and films ──
  const total = await J(page, () => document.querySelectorAll('.holomap-systems > li').length);
  const dimmed = () => J(page, () => document.querySelectorAll('.holomap-systems > li[data-dim]').length);
  say((await dimmed()) === 0, 'with every era lit nothing is dimmed');
  await page.locator('.holomap-eras > button').nth(1).click();
  const eraDim = await dimmed();
  say(eraDim > 0 && eraDim < total, `an era chip dims what isn't of it (${eraDim} of ${total})`);
  await page.locator('.holomap-eras > button').nth(0).click();
  say((await dimmed()) === 0, 'Every era lights them all again');
  await page.locator('.holomap-filmpick summary').click();
  const panel = await J(page, () => {
    const r = document.querySelector('.holomap-films').getBoundingClientRect();
    return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: innerWidth, h: innerHeight, open: document.querySelector('details.holomap-filmpick').open };
  });
  say(panel.open && panel.l >= 0 && panel.r <= panel.w && panel.b <= panel.h, `the films panel opens inside the window (${Math.round(panel.l)}-${Math.round(panel.r)} of ${panel.w})`);
  await page.locator('.holomap-films button').first().click();
  const filmState = await J(page, () => ({ open: document.querySelector('details.holomap-filmpick').open, label: document.querySelector('.holomap-filmpick summary').textContent, active: document.querySelector('.holomap-filmpick').hasAttribute('data-active') }));
  const filmDim = await dimmed();
  say(!filmState.open && filmState.active && /^Films: /.test(filmState.label), `a film's pick shuts the panel and names it ("${filmState.label}")`);
  say(filmDim > 0 && filmDim < total, `and dims what isn't of the film (${filmDim} of ${total})`);
  await page.locator('.holomap-eras > button').nth(0).click();
  say((await J(page, () => document.querySelector('.holomap-filmpick').hasAttribute('data-active'))) === false, 'Every era clears the film');

  // ── Tab through the systems zoomed in: the box never scrolls, each one's framed ──
  await page.keyboard.press('0');
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('+');
    await settle(page, 300);
  }
  const k3 = (await J(page, () => window.__mc.view())).k;
  await page.locator('.holomap-system').first().focus();
  await settle(page, 400);
  const tabs = [];
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab');
    await still(page);
    await page.waitForTimeout(100);
    tabs.push(
      await J(page, () => {
        const el = document.activeElement;
        const id = el?.closest?.('li')?.querySelector('.holomap-name')?.dataset.id;
        const sc = ['.holomap-map', '.holomap-body', '.holomap-frame', '.holomap'].map((s) => document.querySelector(s)).map((e) => e.scrollLeft + e.scrollTop);
        const d = window.__mc.dot(id);
        const m = window.__mc.map();
        return { id, onView: window.__mc.onView(d), at: d ? `${((d.x - m.left) / m.width).toFixed(2)},${((d.y - m.top) / m.height).toFixed(2)}` : '?', scrolled: sc.some((n) => n !== 0) };
      }),
    );
  }
  const tabbed = tabs.filter((t) => t.id);
  say(k3 > 3 && tabbed.length === 14, `Tab through 14 systems at k=${k3.toFixed(2)} stays on the systems`);
  say(tabs.every((t) => !t.scrolled), 'Tab through the systems zoomed in never scrolls the map, its body or its frame');
  say(tabs.every((t) => t.onView), `and frames each system focused${tabs.filter((t) => t.id && !t.onView).length ? ` (off view: ${tabs.filter((t) => t.id && !t.onView).map((t) => `${t.id} at ${t.at}`).join(', ')})` : ''}`);
  await page.keyboard.press('0');
  await settle(page);

  // ── the key: a wheel over its panel scrolls it and not the page behind ──
  await page.locator('.holomap-legend-toggle').click();
  await settle(page, 300);
  // (the page behind is made tall, so a wheel that chains on would move it)
  const natural = await J(page, () => document.scrollingElement.scrollHeight - document.scrollingElement.clientHeight);
  await J(page, () => {
    document.documentElement.style.overflowY = 'scroll';
    document.body.style.minHeight = '5000px';
  });
  const key = await J(page, () => {
    const p = document.querySelector('.holomap-legend-panel');
    const r = p.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, scrolls: p.scrollHeight > p.clientHeight + 2, k: window.__mc.view().k, tall: document.scrollingElement.scrollHeight > document.scrollingElement.clientHeight };
  });
  await page.mouse.move(key.x, key.y);
  await page.mouse.wheel(0, 120);
  await settle(page, 300);
  const first = await J(page, () => ({ top: document.querySelector('.holomap-legend-panel').scrollTop, page: document.scrollingElement.scrollTop, k: window.__mc.view().k }));
  for (let i = 0; i < 4; i++) {
    await page.mouse.wheel(0, 600); // (each its own gesture: one that's latched to the panel would never show a chain)
    await page.waitForTimeout(800);
  }
  const end = await J(page, () => ({ top: document.querySelector('.holomap-legend-panel').scrollTop, page: document.scrollingElement.scrollTop, k: window.__mc.view().k }));
  say(!key.scrolls || first.top > 0, `a wheel over the open key scrolls the key (scrollTop ${first.top})`);
  say(end.page === 0 && first.page === 0, `a wheel over the key, to its end and past it, doesn't scroll the page behind (${end.page} px; the page itself scrolls ${natural} px)`);
  say(end.k === key.k, "and doesn't zoom the map");
  // (and the side panel's: a wheel over it scrolls it, at its end too, and the page stays)
  const side = await J(page, () => {
    const p = document.querySelector('.holomap-side');
    const r = p.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 40), scrolls: p.scrollHeight > p.clientHeight + 2 };
  });
  await page.mouse.move(side.x, side.y);
  for (let i = 0; i < 4; i++) {
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(800);
  }
  const sideEnd = await J(page, () => ({ top: document.querySelector('.holomap-side').scrollTop, page: document.scrollingElement.scrollTop }));
  say(!side.scrolls || sideEnd.top > 0, `a wheel over the side panel scrolls it (scrollTop ${sideEnd.top})`);
  say(sideEnd.page === 0, `and, to its end and past it, not the page behind (${sideEnd.page} px)`);
  await J(page, () => {
    document.documentElement.style.overflowY = '';
    document.body.style.minHeight = '';
  });
  if (phone) {
    const rects = await J(page, () => {
      const p = document.querySelector('.holomap-legend-panel').getBoundingClientRect();
      const z = document.querySelector('.holomap-zoom').getBoundingClientRect();
      const m = window.__mc.map();
      return { meets: p.left < z.right && z.left < p.right && p.top < z.bottom && z.top < p.bottom, inside: p.left >= m.left && p.right <= m.right && p.top >= m.top && p.bottom <= m.bottom };
    });
    say(!rects.meets, 'the open key keeps off the zoom buttons');
    say(rects.inside, 'and inside the map');
    await snap('key');
  } else await snap('key');
  const overKey = await overlayProblems(page);
  say(overKey.length === 0, `the open key and the other overlays clear of one another${overKey.length ? ` (${overKey.join(', ')})` : ''}`);
  await page.locator('.holomap-legend-toggle').click();

  // ── the hover card: right of the dot, left of it when it'd run past the map's edge ──
  if (full && !phone) {
    const edge = await J(page, () => {
      const ids = window.__mc.onViewIds().filter((id) => document.elementFromPoint(window.__mc.dot(id).x, window.__mc.dot(id).y)?.closest('.holomap-system'));
      return ids.map((id) => ({ id, ...window.__mc.dot(id) })).sort((s, t) => t.x - s.x)[0];
    });
    await page.mouse.move(edge.x, edge.y);
    await settle(page, 300);
    const card = await J(page, () => {
      const r = document.querySelector('.holomap-hover')?.getBoundingClientRect();
      const m = window.__mc.map();
      return r ? { l: r.left, r: r.right, mr: m.right, ml: m.left } : null;
    });
    say(Boolean(card) && card.r <= card.mr + 0.5 && card.l >= card.ml - 0.5, `the hover card over ${edge.id}, the system nearest the right edge, stays inside the map`);
    await page.locator('.holomap-frame').screenshot({ path: `${out}/map-${size}-hover-edge.png` });
    const mid = await J(page, () => {
      const m = window.__mc.map();
      const ids = window.__mc.onViewIds().filter((id) => document.elementFromPoint(window.__mc.dot(id).x, window.__mc.dot(id).y)?.closest('.holomap-system'));
      return ids.map((id) => ({ id, ...window.__mc.dot(id) })).filter((s) => s.x < m.left + m.width * 0.4).sort((s, t) => s.x - t.x)[0];
    });
    await page.mouse.move(mid.x, mid.y);
    await settle(page, 300);
    const card2 = await J(page, () => document.querySelector('.holomap-hover')?.getBoundingClientRect().left);
    say(card2 > mid.x, `and stays to the right of ${mid.id}, with room`);
    await page.mouse.move(2, 2);
  }

  // ── zoomed in, the stage is as sharp as without will-change ──
  if (full && !phone) {
    for (let i = 0; i < 2; i++) {
      await page.keyboard.press('+');
      await settle(page, 300);
    }
    await page.mouse.move(2, 2);
    await settle(page, 800);
    const m = await J(page, () => {
      const r = window.__mc.map();
      return { x: r.left + r.width * 0.25, y: r.top + r.height * 0.25, width: Math.min(360, r.width * 0.5), height: Math.min(260, r.height * 0.5) };
    });
    const png = await page.screenshot({ clip: m, path: `${out}/map-${size}-k3.png` });
    const style = await page.addStyleTag({ content: '.holomap-stage { will-change: auto !important; }' });
    await settle(page, 800);
    const plain = await page.screenshot({ clip: m });
    await style.evaluate((el) => el.remove());
    const [sharp, sharpPlain] = [await edgeEnergy(page, png), await edgeEnergy(page, plain)];
    say(sharp >= sharpPlain * 0.93, `at k=${(await J(page, () => window.__mc.view().k)).toFixed(2)} the stage is as sharp as without will-change (${sharp.toFixed(2)} vs ${sharpPlain.toFixed(2)})`);
    await page.keyboard.press('0');
    await settle(page);
  }

  // ── M and Escape close it: held or not (the map's comings and goings counted, as an even number of flickers would look the same) ──
  if (full && !phone) {
    await J(page, () => {
      window.__flips = [];
      window.__was = Boolean(document.querySelector('.holomap'));
      new MutationObserver(() => {
        const now = Boolean(document.querySelector('.holomap'));
        if (now !== window.__was) window.__flips.push(now ? 'open' : 'close');
        window.__was = now;
      }).observe(document.body, { childList: true });
    });
    const hold = async () => {
      await page.keyboard.down('m');
      await page.waitForTimeout(250);
      for (let i = 0; i < 5; i++) {
        await page.keyboard.down('m'); // (the repeats of a held key)
        await page.waitForTimeout(80);
      }
      await page.keyboard.up('m');
      await page.waitForTimeout(250);
      return J(page, () => window.__flips.splice(0));
    };
    const closed = await hold();
    say(closed.join() === 'close' && !(await hasMap(page)), `holding M closes the map once, its repeats don't open it again (${closed.join(', ') || 'no change'})`);
    const opened = await hold();
    say(opened.join() === 'open' && (await hasMap(page)), `holding M opens the map once, its repeats don't shut it (${opened.join(', ') || 'no change'})`);
  } else if (!(await hasMap(page))) await reopen();
  await page.keyboard.press('m');
  await page.waitForTimeout(400);
  say(!(await hasMap(page)), 'M closes the map');
  await reopen();
  await page.keyboard.press('/');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  say(!(await hasMap(page)), 'Escape closes the map, even from the find field');

  // ── find, then J jumps to it (the last: it leaves the system) ──
  await reopen();
  await page.keyboard.press('/');
  await page.keyboard.type('endo');
  await page.keyboard.press('Enter');
  await settle(page, 700);
  say((await J(page, () => window.__mc.sys('endor')?.getAttribute('aria-pressed'))) === 'true', 'find "endo" again: Endor is the course');
  await page.keyboard.press('j');
  const jumped = await page.waitForFunction(() => Boolean(window.__galaxy().jump), null, { timeout: 15000 }).then(() => true, () => false);
  say(jumped, 'J jumps to the course (the scene has a jump on)');

  say(errors.length === 0, `no errors${errors.length ? ` (${[...new Set(errors)].slice(0, 3).join('; ')})` : ''}`);
  await ctx.close();
};

// the phone's side panel, on a short phone: the jump shows without scrolling the frame
const shortPhone = async () => {
  const viewport = { width: 375, height: 667 };
  const say = (ok, what) => check(ok, `375x667: ${what}`);
  const { ctx, page, errors } = await open(viewport);
  const names = await namesProblems(page);
  say(names.meets.length === 0 && names.outside.length === 0, `names apart and inside${names.meets.length ? ` (${names.meets.slice(0, 5).join(', ')})` : ''}${names.outside.length ? ` (outside: ${names.outside.slice(0, 5).join(', ')})` : ''}`);
  const small = await smallText(page);
  say(small.length === 0, `nothing under 0.7 rem${small.length ? `: ${[...new Set(small)].slice(0, 4).join('; ')}` : ''}`);
  await page.locator('.holomap-find input').fill('hoth');
  await page.keyboard.press('Enter');
  await settle(page, 800);
  const r = await J(page, () => {
    const j = document.querySelector('.holomap-jump').getBoundingClientRect();
    const s = document.querySelector('.holomap-side').getBoundingClientRect();
    const f = document.querySelector('.holomap-frame');
    const sd = document.querySelector('.holomap-side');
    return { jt: j.top, jb: j.bottom, st: s.top, sb: s.bottom, sh: s.height, scrollable: sd.scrollHeight > sd.clientHeight + 1, frameScroll: f.scrollTop + f.scrollLeft, vh: innerHeight, mapB: window.__mc.map().bottom, mapH: window.__mc.map().height };
  });
  say(r.jt >= r.st - 0.5 && r.jb <= r.sb + 0.5 && r.jb <= r.vh, `the side panel shows the jump button without scrolling (side ${Math.round(r.st)}-${Math.round(r.sb)}, jump ${Math.round(r.jt)}-${Math.round(r.jb)}, window ${r.vh})`);
  say(r.frameScroll === 0, 'the whole frame is not scrolled');
  await page.screenshot({ path: `${out}/map-375x667-side.png` });
  say(errors.length === 0, `no errors${errors.length ? ` (${[...new Set(errors)].slice(0, 3).join('; ')})` : ''}`);
  await ctx.close();
};

for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  await suite(viewport, { full: viewport.width === 1440 }).catch((e) => check(false, `${viewport.width}x${viewport.height}: the check stopped: ${String(e.message).split('\n')[0]}`));
}
await shortPhone().catch((e) => check(false, `375x667: the check stopped: ${String(e.message).split('\n')[0]}`));
await browser.close();
console.log(problems.length ? `\n${problems.length} problem(s)` : '\nall ok');
process.exit(problems.length ? 1 : 0);
