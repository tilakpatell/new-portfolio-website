/* global window */
// One event, two browsers (online-check.mjs --fly, after ./fly-check.mjs):
// Alpha and Bravo a cell apart on /fly/hoth, Alpha starts a blizzard
// (the occurrences' dev hook, expanse/flight/occurrenceScene.js's
// __FLIGHT_OCC__), and Bravo has the same event within a few seconds,
// heard on the room. If either had one of its own on already, the earlier
// of the two wins in both (lib/land/flight/director.js): still one event.
//
// stormCheck({ a, b, check, waitFor }) → { seconds, kind }

const hold = (page, x, z) =>
  page.evaluate(
    ([x, z]) => {
      const w = window.__FLIGHT__;
      w.ship = { x, z, pitch: 0, roll: 0, yaw: 0, speed: 40 };
      const g = w.groundUnder();
      w.ship = { y: (Number.isFinite(g) ? g : 0) + 200 };
    },
    [x, z],
  );
const active = (page) => page.evaluate(() => window.__FLIGHT_OCC__?.active()?.id ?? null);

export async function stormCheck({ a, b, check, waitFor }) {
  await hold(a, 1024, 1024);
  await hold(b, 3072, 3072);
  await waitFor(() => a.evaluate(() => window.__FLIGHT__.shared.stats().online === 'online'), 60000, 'Alpha online');
  const t = Date.now();
  await a.evaluate(() => window.__FLIGHT_OCC__.force('blizzard'));
  let ids = [null, null];
  await waitFor(async () => {
    await hold(a, 1024, 1024);
    await hold(b, 3072, 3072);
    ids = [await active(a), await active(b)];
    return ids[0] && ids[0] === ids[1];
  }, 30000, 'Bravo has Alpha’s event');
  const seconds = (Date.now() - t) / 1000;
  const kind = ids[0].split(':')[1];
  check(seconds <= 5, `one ${kind} in both browsers, a cell apart, in ${seconds.toFixed(1)} s (${ids[0]})`);
  return { seconds, kind };
}
