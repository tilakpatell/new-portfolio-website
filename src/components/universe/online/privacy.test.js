import { describe, expect, it } from 'vitest';
import { isRawHost, privatePeer, relayOnly, stripHostCandidates } from './privacy';

const LAN = 'candidate:842163049 1 udp 2122260223 192.168.1.23 54400 typ host generation 0';
const MDNS = 'candidate:1 1 udp 2122260223 4f2b7a1c-8d1e-4b7a-9c1a-3e5f6a7b8c9d.local 54400 typ host generation 0';
const V6 = 'candidate:2 1 udp 2122262783 2001:db8::1 54401 typ host generation 0';
const PUBLIC = 'candidate:3 1 udp 1686052607 203.0.113.9 54400 typ srflx raddr 0.0.0.0 rport 0 generation 0';
const RELAY = 'candidate:4 1 udp 41885439 198.51.100.7 3478 typ relay raddr 203.0.113.9 rport 54400';

describe('isRawHost', () => {
  it('picks out a host candidate with a bare address, v4 or v6', () => {
    expect(isRawHost(LAN)).toBe(true);
    expect(isRawHost(`a=${LAN}`)).toBe(true);
    expect(isRawHost(V6)).toBe(true);
  });
  it('leaves .local names, and the other kinds', () => {
    expect(isRawHost(MDNS)).toBe(false);
    expect(isRawHost(PUBLIC)).toBe(false);
    expect(isRawHost(RELAY)).toBe(false);
    expect(isRawHost('a=mid:0')).toBe(false);
  });
});

describe('stripHostCandidates', () => {
  it('takes the bare host candidates out of a description and keeps the rest', () => {
    const sdp = ['v=0', `a=${LAN}`, `a=${MDNS}`, `a=${PUBLIC}`, 'a=end-of-candidates', ''].join('\r\n');
    const out = stripHostCandidates(sdp);
    expect(out).not.toContain('192.168.1.23');
    expect(out).toContain('.local');
    expect(out).toContain('203.0.113.9');
    expect(out.split('\r\n')).toHaveLength(5);
  });
});

describe('privatePeer', () => {
  // a stand-in for the browser's RTCPeerConnection
  class Fake {
    constructor() {
      this._d = { type: 'offer', sdp: `v=0\r\na=${LAN}\r\na=${MDNS}` };
      this._h = null;
    }
    get localDescription() {
      return this._d;
    }
    get onicecandidate() {
      return this._h;
    }
    set onicecandidate(fn) {
      this._h = fn;
    }
    emit(line) {
      this._h?.({ candidate: { candidate: line } });
    }
  }
  it('never hands on a bare host candidate', () => {
    const Peer = privatePeer(Fake);
    const pc = new Peer();
    const got = [];
    pc.onicecandidate = (e) => got.push(e.candidate.candidate);
    pc.emit(LAN);
    pc.emit(MDNS);
    pc.emit(PUBLIC);
    expect(got).toEqual([MDNS, PUBLIC]);
    expect(pc.localDescription.sdp).not.toContain('192.168.1.23');
    expect(pc.localDescription.type).toBe('offer');
  });
  it('is nothing where there is no WebRTC', () => {
    expect(privatePeer(undefined)).toBeUndefined();
  });
});

describe('relayOnly', () => {
  it('is null with no relay set up, or half of one', () => {
    expect(relayOnly({})).toBeNull();
    expect(relayOnly({ VITE_TURN_URLS: 'turn:x.example:3478' })).toBeNull();
    expect(relayOnly({ VITE_TURN_URLS: 'https://nope', VITE_TURN_USERNAME: 'u', VITE_TURN_CREDENTIAL: 'c' })).toBeNull();
  });
  it('sends everything through the relay when there is one', () => {
    const r = relayOnly({ VITE_TURN_URLS: 'turn:a.example:3478, turns:a.example:443', VITE_TURN_USERNAME: 'u', VITE_TURN_CREDENTIAL: 'c' });
    expect(r.rtcConfig.iceTransportPolicy).toBe('relay');
    expect(r.turnConfig[0].urls).toEqual(['turn:a.example:3478', 'turns:a.example:443']);
  });
});
