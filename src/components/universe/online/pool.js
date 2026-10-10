// One socket to each relay, shared by every room on the page: the site's
// own (client.js), a walkable world's (travellers.js) and a Rush kitchen's
// each ask the pool for a subscription (nostr.js's joinRoom does the
// asking) instead of opening four sockets of their own, so three rooms are
// still four sockets, not twelve.
//
// A subscription is a listening of its own on every socket (a REQ under an
// id of its own, tp1, tp2 and on, asked for again whenever a socket
// opens), and what comes back is handed to the room whose id it carries.
// What a room sends goes out on every socket that's open. A relay that
// answers "slow down" (an OK that's false and says rate or limit) gets
// nothing from anyone for HOLD_MS: every room on that socket waits, as it
// should, since the relay counts the socket, not the room.
//
// A relay that drops is tried again (a second on, then two, and so on to
// thirty), and every room still listening is asked for again when it's
// back; a room joining tries every relay that's down at once, from a
// second's wait again (“Try again” mustn't wait out half a minute of
// back-off). When the last room leaves, the sockets stay for LINGER_MS before
// they close, so going from one page to another (the site's room left, a
// world's joined) doesn't reconnect.
//
// relayPool({ relays, WebSocket, lingerMs, now }) → { subscribe({ filter,
//   onEvent, onChange }) → { send(eventJson), up() → how many relays are
//   up, close(), refresh() }, sockets() → how many it holds }. `filter` is
//   the REQ's filter, or a function giving it afresh each time it's sent;
//   onEvent(ev) gets each event for this subscription; onChange() hears a
//   relay come or go; refresh() asks every open relay again under the
//   subscription's id (NIP-01: a REQ under an id already open replaces its
//   filter), for a room whose filter changed (nostr.js's cells), and a relay
//   that's down asks with the filter of the moment when it opens, as ever.
//   poolFor(WebSocket, relays) → the page's pool for that WebSocket class
//   and list of relays (one each, kept), so a test with a fake of its own
//   has a pool of its own.

export const LINGER_MS = 5000; // the last room gone: the sockets stay this long
const HOLD_MS = 10000; // a relay that says slow down: nothing goes to it for this long
const WAIT_MS = 1000; // a relay dropped: tried again this soon, then twice as long each time
const WAIT_MAX = 30000;

// One relay: kept connected while the pool wants it, each subscription's
// listening asked for each time it opens.
function relaySocket(url, { WebSocket, subs, onChange, now }) {
  let ws = null;
  let up = false;
  let opening = false; // a socket on its way, not yet open or closed
  let closed = false;
  let retry = 0;
  let wait = WAIT_MS;
  let quietUntil = 0; // rate-limited: hold off sending till then
  const ask = (sub) => ws.send(JSON.stringify(['REQ', sub.id, typeof sub.filter === 'function' ? sub.filter() : sub.filter]));
  const open = () => {
    try {
      ws = new WebSocket(url);
    } catch {
      return later();
    }
    opening = true;
    ws.onopen = () => {
      opening = false;
      wait = WAIT_MS;
      up = true;
      for (const sub of subs.values()) ask(sub);
      onChange();
    };
    ws.onmessage = (m) => {
      let msg;
      try {
        msg = JSON.parse(typeof m.data === 'string' ? m.data : '');
      } catch {
        return;
      }
      if (!Array.isArray(msg)) return;
      if (msg[0] === 'EVENT') subs.get(msg[1])?.onEvent?.(msg[2]);
      else if (msg[0] === 'OK' && msg[2] === false && /rate|limit|slow/i.test(String(msg[3]))) quietUntil = now() + HOLD_MS;
    };
    ws.onclose = () => {
      const was = up;
      up = false;
      opening = false;
      if (was) onChange();
      later();
    };
    ws.onerror = () => {};
  };
  const later = () => {
    if (closed) return;
    retry = setTimeout(open, wait);
    wait = Math.min(WAIT_MAX, wait * 2);
  };
  const live = () => up && ws.readyState === 1;
  open();
  return {
    get up() {
      return up;
    },
    // a room's listening, asked for (or let go of) on a socket that's open
    // (one that isn't asks for every room's as it opens)
    ask(sub) {
      if (live()) ask(sub);
    },
    stop(id) {
      if (live()) ws.send(JSON.stringify(['CLOSE', id]));
    },
    // down and waiting to try again: try now, from a second's wait again
    wake() {
      if (closed || up || opening) return;
      clearTimeout(retry);
      wait = WAIT_MS;
      open();
    },
    send(s) {
      if (live() && now() >= quietUntil) ws.send(s);
    },
    close() {
      closed = true;
      clearTimeout(retry);
      up = false;
      try {
        ws?.close();
      } catch {
        /* already gone */
      }
    },
  };
}

export function relayPool({ relays, WebSocket, lingerMs = LINGER_MS, now = () => Date.now() }) {
  const subs = new Map(); // REQ id → { id, filter, onEvent, onChange }
  let sockets = null; // one per relay, while anyone's listening (and through the linger)
  let made = 0; // REQ ids given out
  let linger = 0;
  const changed = () => {
    for (const sub of [...subs.values()]) sub.onChange?.();
  };
  const shut = () => {
    linger = 0;
    for (const s of sockets ?? []) s.close();
    sockets = null;
  };
  return {
    subscribe({ filter, onEvent, onChange }) {
      clearTimeout(linger);
      linger = 0;
      const sub = { id: `tp${++made}`, filter, onEvent, onChange };
      subs.set(sub.id, sub);
      if (sockets)
        for (const s of sockets) {
          s.ask(sub);
          s.wake();
        }
      else sockets = relays.map((url) => relaySocket(url, { WebSocket, subs, onChange: changed, now }));
      let open = true;
      return {
        send(json) {
          if (open) for (const s of sockets ?? []) s.send(json);
        },
        up: () => (open ? (sockets ?? []).filter((s) => s.up).length : 0),
        refresh() {
          if (open) for (const s of sockets ?? []) s.ask(sub);
        },
        close() {
          if (!open) return;
          open = false;
          subs.delete(sub.id);
          for (const s of sockets ?? []) s.stop(sub.id);
          if (!subs.size && sockets) linger = setTimeout(shut, lingerMs);
        },
      };
    },
    sockets: () => sockets?.length ?? 0,
  };
}

// the page's pools: WebSocket class → relay list → pool
const pools = new Map();
export function poolFor(WebSocket, relays) {
  if (!pools.has(WebSocket)) pools.set(WebSocket, new Map());
  const byList = pools.get(WebSocket);
  const key = relays.join(' ');
  if (!byList.has(key)) byList.set(key, relayPool({ relays, WebSocket }));
  return byList.get(key);
}
