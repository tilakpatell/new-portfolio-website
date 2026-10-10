/* global window, document */
// The galaxy's pickups, in a browser (galaxy/pickups.js, pickupFx.js, scene.js; scripts/galaxy-hud-check.mjs runs it as
// `pickups`): at 1440x900 an X-wing at Tatooine, a pickup put ahead of it (the scene's DEV hook, __galaxyDebug.drop(kind, gap)), and
//   drawn: it's listed, on the radar (a cyan dot) and in the picture (a shot of it before it's taken)
//   taken: flown through, a rapid-fire pickup gives its chip (name, seconds left, nothing under 0.7 rem), a repair kit the
//     deflectors back, a bubble the points (and a hit it takes comes off them, not off the deflectors), a power cell the big one's
//     charge; the pickup's gone from the list
//   guns: rapid fire on the X-wing, whose guns are at the quickest they may fire, is no quicker in shots and hits ×1.5 as hard
//   motion: it turns while motion's on, and sits still (and is there) with reduced motion
//   jump: with the jump under way, a pickup on top of the ship isn't taken (nothing applies), and once it's committed, none is left
// Shots are in OUT/pickups-*.png.
import { check, out } from '../galaxy-map-check/lib.mjs';
import { hold, open, settle, smallText } from './lib.mjs';

const VIEW = { width: 1440, height: 900 };

// the radar's cyan: how many of its pixels are a pickup's dot
const cyanDots = (page) =>
  page.evaluate(() => {
    const cv = document.querySelector('.fc-radar');
    const { data } = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height);
    let n = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 200 && data[i] < 150 && data[i + 1] > 200 && data[i + 2] > 230) n++;
    return n;
  });

// how far the first model of a kind in the scene is turned (the drawing names each copy for its kind, in a holder with its glow)
const turn = (page, kind) =>
  page.evaluate((k) => {
    let r = null;
    window.__galaxyDebug.scene.traverse((o) => {
      if (r === null && o.name === k && o.parent?.children.some((c) => c.isSprite)) r = o.rotation.y;
    });
    return r;
  }, kind);

// the ship still, put somewhere clear, the nose along +x: what's dropped is that far ahead of it
const place = (page) =>
  page.evaluate(() => {
    const d = window.__galaxyDebug;
    d.pin({ x: 400, y: 30, z: 400, heading: -Math.PI / 2, pitch: 0, bank: 0 });
    d.state.safeUntil = 1e12;
    d.state.shield = 100;
    d.pickups.clear();
  });
// (till nobody's speaking on the comms: a line is up for a few seconds)
const quiet = (page) => page.waitForFunction(() => !document.querySelector('.universe-comms .universe-line'), null, { timeout: 20000 }).catch(() => {});
// the trigger held a second: the shots made (the guns' last-shot time moving on) and the hardest bolt in the air (its punch)
const firing = async (page) => {
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.down('f');
  const r = await page.evaluate(
    () =>
      new Promise((done) => {
        const d = window.__galaxyDebug;
        let last = d.state.lastShot;
        let shots = 0;
        const t0 = performance.now();
        const tick = setInterval(() => {
          if (d.state.lastShot !== last) {
            last = d.state.lastShot;
            shots++;
          }
          if (performance.now() - t0 < 1000) return;
          clearInterval(tick);
          let punch = 0;
          d.scene.traverse((o) => o.visible && o.userData?.v && o.userData.punch && (punch = Math.max(punch, o.userData.punch)));
          done({ shots, punch });
        }, 4);
      }),
  );
  await page.keyboard.up('f');
  return r;
};
const got = (page) => page.evaluate(() => ({ pickups: window.__galaxy().pickups, buffs: window.__galaxy().buffs, shield: window.__galaxy().shield }));

export async function pickups() {
  const say = (ok, what) => check(ok, `pickups: ${what}`);
  const { ctx, page, errors } = await open(VIEW);
  try {
    const G = (fn, arg) => page.evaluate(fn, arg);
    await hold(page, 'w', 800);
    say(await G(() => typeof window.__galaxyDebug.drop === 'function'), 'the scene has its DEV hook');

    // drawn: ahead, out of reach of being pulled in (14 units), on the radar and in the picture
    await place(page);
    await quiet(page);
    // (a little below the nose, clear of the comms line over the top)
    await G(() => {
      const d = window.__galaxyDebug;
      const s = d.state.ship;
      d.pickups.drop({ x: s.x + 24, y: s.y - 2.5, z: s.z }, { ace: true, kind: 'rapid' });
    });
    await settle(page, 1200);
    const seen = await got(page);
    say(seen.pickups === 1, `a dropped pickup is listed (${seen.pickups})`);
    say((await cyanDots(page)) > 6, `and a dot on the radar (${await cyanDots(page)} cyan px)`);
    const a = await turn(page, 'rapid');
    await settle(page, 400);
    const b = await turn(page, 'rapid');
    say(a !== null && b !== null && Math.abs(b - a) > 0.1, `its model is in the scene and turns (${a?.toFixed(2)} → ${b?.toFixed(2)})`);
    await page.screenshot({ path: `${out}/pickups-drop.png` });
    // all five kinds, side by side ahead and a little below the nose (clear of the comms line over the top), for a look at each
    await G(() => window.__galaxyDebug.pickups.clear());
    await quiet(page);
    await G(() => {
      const d = window.__galaxyDebug;
      const s = d.state.ship;
      const fx = Math.sin(-s.heading);
      const fz = -Math.cos(s.heading);
      const kinds = ['repair', 'overcharge', 'rapid', 'bubble', 'charge'];
      kinds.forEach((kind, i) => {
        const side = (i - 2) * 3.2;
        d.pickups.drop({ x: s.x + fx * 20 - fz * side, y: s.y - 2.5, z: s.z + fz * 20 + fx * side }, { ace: true, kind });
      });
    });
    await settle(page, 700);
    say((await G(() => window.__galaxy().pickups)) === 4, 'four are out at most (the fifth of five is refused)');
    await page.screenshot({ path: `${out}/pickups-four.png` });
    await G(() => {
      const d = window.__galaxyDebug;
      d.pickups.clear();
      const s = d.state.ship;
      const fx = Math.sin(-s.heading);
      const fz = -Math.cos(s.heading);
      d.pickups.drop({ x: s.x + fx * 20 - fz * 1.6, y: s.y - 2.5, z: s.z + fz * 20 + fx * 1.6 }, { ace: true, kind: 'bubble' });
      d.pickups.drop({ x: s.x + fx * 20 + fz * 1.6, y: s.y - 2.5, z: s.z + fz * 20 - fx * 1.6 }, { ace: true, kind: 'charge' });
    });
    await settle(page, 700);
    await page.screenshot({ path: `${out}/pickups-pair.png` });

    // taken: flown through
    await G(() => window.__galaxyDebug.pickups.clear());
    await place(page);
    const before = await G(() => window.__galaxyDebug.powers.info?.ultimate?.charge ?? null);
    await G(() => {
      window.__galaxyDebug.drop('rapid', 14);
      window.__galaxyDebug.drop('charge', 22);
    });
    await hold(page, 'w', 4200);
    const after = await got(page);
    say(after.buffs.includes('rapid'), `flown through, a rapid-fire pickup is on (${JSON.stringify(after.buffs)})`);
    const chip = await G(() => {
      const el = document.querySelector('.fc-buff[data-kind="rapid"]');
      return el && el.checkVisibility() ? { name: el.querySelector('b')?.textContent, time: el.querySelector('i')?.textContent } : null;
    });
    say(chip?.name === 'Rapid fire' && /^\d+s$/.test(chip.time ?? ''), `and its chip says so (${JSON.stringify(chip)})`);
    say((await smallText(page, '.fc-buffs')).length === 0, 'with nothing in it under 0.7 rem');
    say(after.pickups === 0, `and nothing's left to take (${after.pickups})`);
    const note = await G(() => document.querySelector('.galaxy-pickup-note')?.textContent ?? '');
    say(/·/.test(note) || note === '', `the page's note names what was taken (${note || 'gone already'})`);
    const charged = await G(() => window.__galaxyDebug.powers.info?.ultimate?.charge ?? null);
    say(before !== null && charged !== null && charged - before > 0.2, `a power cell charged the big one (${before} → ${charged})`);
    await page.screenshot({ path: `${out}/pickups-taken.png` });

    // rapid fire on the X-wing: its guns are at the quickest they may fire already, so the shots come no quicker and each hits harder
    // (the cut the limit ate, made up in punch: pickups.js's gunsUnder, to ×1.5)
    await place(page);
    await G(() => window.__galaxyDebug.pickups.clear());
    const off = await firing(page);
    await G(() => window.__galaxyDebug.pickups.give('rapid'));
    await settle(page, 300);
    const on = await firing(page);
    say(off.shots >= 4 && on.shots >= 4, `the guns fire (${off.shots} shots a second off, ${on.shots} on)`);
    say(on.shots <= off.shots * 1.2, 'rapid fire on the X-wing is no quicker in shots (the guns are at the limit)');
    say(off.punch === 1 && Math.abs(on.punch - 1.5) < 0.01, `and the bolts hit ×${on.punch.toFixed(2)} as hard, against ×${off.punch.toFixed(2)}`);
    await G(() => window.__galaxyDebug.pickups.clear());

    // a repair kit, the deflectors down
    await place(page);
    await G(() => {
      window.__galaxyDebug.state.shield = 30;
      window.__galaxyDebug.state.hitAt = window.__galaxyDebug.state.clock; // (no regeneration for a few seconds: it's the kit's)
      window.__galaxyDebug.drop('repair', 14);
    });
    await hold(page, 'w', 1500);
    const mended = await got(page);
    say(mended.shield >= 69, `a repair kit gives the deflectors back 40 (${mended.shield})`);

    // a bubble: its points on the chip, a hit comes off them
    await place(page);
    await G(() => window.__galaxyDebug.drop('bubble', 14));
    await hold(page, 'w', 1500);
    const hit = await G(() => {
      const d = window.__galaxyDebug;
      const was = d.state.shield;
      d.pickups.absorb(0);
      d.ram?.(); // (a hunter put in the way: the ship's shields would take the ram)
      return { was, kinds: window.__galaxy().buffs };
    });
    say(hit.kinds.includes('bubble'), `a bubble shield is on (${JSON.stringify(hit.kinds)})`);
    const points = await G(() => {
      const d = window.__galaxyDebug;
      d.pickups.absorb(25);
      return d.pickups.buffs().find((x) => x.kind === 'bubble')?.points;
    });
    await settle(page, 500);
    const bubbleChip = await G(() => document.querySelector('.fc-buff[data-kind="bubble"] i')?.textContent ?? null);
    say(points === 35 && bubbleChip === '35', `and 25 damage comes off its points, on the chip (${points}, "${bubbleChip}")`);
    await page.screenshot({ path: `${out}/pickups-bubble.png` });

    // a jump: under way (aligning), nothing's taken; committed, none are left
    await place(page);
    await G(() => {
      window.__galaxyDebug.state.hitAt = -1e9;
      window.__galaxyDebug.drop('rapid', 0.5);
      window.__galaxyDebug.startJump('endor');
    });
    await settle(page, 400);
    const align = await G(() => ({ jump: window.__galaxy().jump, pickups: window.__galaxy().pickups, buffs: window.__galaxy().buffs }));
    say(align.jump?.phase === 'align' && align.pickups === 1 && !align.buffs.includes('rapid'), `a pickup on top of the ship isn't taken while the jump aligns (${JSON.stringify(align)})`);
    await page.waitForFunction(() => ['spool', 'tunnel'].includes(window.__galaxy().jump?.phase), null, { timeout: 30000 });
    const spooling = await got(page);
    say(spooling.pickups === 0 && spooling.buffs.length === 0, `once the jump's committed none is left, nor any effect (${JSON.stringify(spooling)})`);
    await page.waitForFunction(() => !window.__galaxy().jump && window.__galaxy().system === 'endor', null, { timeout: 120000 }).catch(() => {});
    const arrived = await got(page);
    say(arrived.pickups === 0 && arrived.buffs.length === 0, `and none in the next system (${JSON.stringify(arrived)})`);
    say(errors.length === 0, `no page errors${errors.length ? ` (${errors.slice(0, 3).join('; ')})` : ''}`);
  } finally {
    await ctx.close().catch(() => {});
  }

  // reduced motion: there, and still
  const still = await open(VIEW, { reduced: true });
  try {
    await place(still.page);
    await still.page.evaluate(() => window.__galaxyDebug.drop('repair', 24));
    await settle(still.page, 900);
    const r = await still.page.evaluate(() => window.__galaxy().pickups);
    const t0 = await turn(still.page, 'repair');
    await settle(still.page, 500);
    const t1 = await turn(still.page, 'repair');
    say(r === 1 && t0 === 0 && t1 === 0, `with reduced motion it's there (${r}) and doesn't turn (${t0} → ${t1})`);
    await still.page.screenshot({ path: `${out}/pickups-reduced.png` });
  } finally {
    await still.ctx.close().catch(() => {});
  }
}
