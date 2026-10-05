// Signing and checking the room's events away from the page (nostr.js asks):
// each takes a few milliseconds of sums on big numbers, ten or more times a
// second while you're online, which the universe map's frames can't spare.
// { id, op: 'sign', key, pubkey, ev } → { id, out: the signed event };
// { id, op: 'check', ev } → { id, out: true or false }; { id, error } if it threw.

import { checkEvent, signEvent } from './events';

self.onmessage = async ({ data }) => {
  const { id, op } = data;
  try {
    const out = op === 'sign' ? await signEvent(data.key, data.pubkey, data.ev) : await checkEvent(data.ev);
    self.postMessage({ id, out });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
