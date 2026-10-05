// What other pilots' browsers can learn about your connection.
//
// Browser to browser, each side has to tell the other where to reach it:
// its ICE candidates. Two of the kinds give an address away:
// - a "host" candidate is your device's own address on your network (your
//   LAN, or with IPv6 your device). Browsers mostly hide it behind a random
//   name.local already; one that's still a bare address is dropped here
//   (PrivatePeer), so your local network's address is never sent. Peers on
//   the same network still find each other through the .local names.
// - a "server reflexive" one is your public IP address, as a STUN server
//   sees it: needed for a direct connection, so a peer can see it, as in
//   most online games.
// With a TURN relay set up (VITE_TURN_URLS, VITE_TURN_USERNAME and
// VITE_TURN_CREDENTIAL when the site is built), every connection goes
// through the relay instead (relayOnly), and other pilots see only the
// relay's address, never yours. The relay's credentials end up in the
// page, so use a relay meant for that (one with a free tier and limits).

const HOST = /^(?:a=)?candidate:\S+ \d+ \S+ \d+ (\S+) \d+ typ host\b/i;

// a candidate line that's a host candidate with a bare address
export function isRawHost(line) {
  const m = HOST.exec(String(line).trim());
  return Boolean(m) && !m[1].toLowerCase().endsWith('.local');
}

// a session description without those
export const stripHostCandidates = (sdp) =>
  String(sdp)
    .split(/\r?\n/)
    .filter((l) => !isRawHost(l))
    .join('\r\n');

// RTCPeerConnection, minus the bare host candidates: as each candidate is
// found (Trystero trickles them out through onicecandidate), and in the
// description it reads back (localDescription)
export function privatePeer(Base = globalThis.RTCPeerConnection) {
  if (!Base) return undefined;
  return class PrivatePeer extends Base {
    get localDescription() {
      const d = super.localDescription;
      return d && { type: d.type, sdp: stripHostCandidates(d.sdp) };
    }
    get onicecandidate() {
      return this._onCandidate ?? null;
    }
    set onicecandidate(fn) {
      this._onCandidate = fn;
      super.onicecandidate = fn ? (e) => (e.candidate && isRawHost(e.candidate.candidate) ? undefined : fn(e)) : null;
    }
  };
}

// The relay, if the site was built with one: what Trystero takes to send
// everything through it. null without one.
export function relayOnly(env = import.meta.env ?? {}) {
  const urls = String(env.VITE_TURN_URLS ?? '')
    .split(',')
    .map((u) => u.trim())
    .filter((u) => /^turns?:/.test(u));
  if (!urls.length || !env.VITE_TURN_USERNAME || !env.VITE_TURN_CREDENTIAL) return null;
  return {
    turnConfig: [{ urls, username: String(env.VITE_TURN_USERNAME), credential: String(env.VITE_TURN_CREDENTIAL) }],
    rtcConfig: { iceTransportPolicy: 'relay' },
  };
}
