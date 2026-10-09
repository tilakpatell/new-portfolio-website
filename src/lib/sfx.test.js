import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hit, play, thud } from './sfx';

// what play() and hit() find when they ask for the site’s context
const site = vi.hoisted(() => ({ ctx: null, out: null }));
vi.mock('./audio', () => ({ audioContext: () => site.ctx, output: () => site.out }));

// A Web Audio context that only remembers (the shape of the Death Star
// inside’s sounds.test.js): every node it makes, what each is joined to, and
// every value scheduled on each param.
function fakeAudio() {
  const made = [];
  const param = (value = 0) => {
    const p = {
      value,
      events: [],
      setValueAtTime: (v, t) => p.events.push([t, v]),
      linearRampToValueAtTime: (v, t) => p.events.push([t, v]),
      exponentialRampToValueAtTime: (v, t) => p.events.push([t, v]),
      setTargetAtTime: (v, t) => p.events.push([t, v]),
      cancelScheduledValues: () => {},
    };
    return p;
  };
  const node = (kind) => {
    const n = {
      kind,
      outs: [],
      connect(to) {
        n.outs.push(to);
        return to;
      },
      disconnect() {
        n.outs = [];
      },
      start(at = 0) {
        n.started = at;
      },
      stop(at = 0) {
        n.stopped = at;
      },
    };
    for (const p of ['gain', 'frequency', 'Q', 'detune', 'playbackRate', 'positionX', 'positionY', 'positionZ']) n[p] = param(p === 'gain' || p === 'playbackRate' ? 1 : 0);
    made.push(n);
    return n;
  };
  const base = {
    currentTime: 0,
    sampleRate: 4000,
    destination: node('destination'),
    createBuffer: (channels, length) => {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { length, numberOfChannels: channels, getChannelData: (c) => data[c] };
    },
  };
  const ctx = new Proxy(base, {
    get(t, k) {
      if (k in t) return t[k];
      if (typeof k === 'string' && k.startsWith('create')) return () => node(k.slice(6));
      return undefined;
    },
  });
  const out = node('out');
  const of = (kind) => made.filter((n) => n.kind === kind);
  const peak = (p) => Math.max(...p.events.map(([, v]) => v));
  return { ctx, out, made, of, peak, play: (opts) => thud({ context: () => ctx, destination: () => out, ...opts }) };
}

describe('thud', () => {
  it('is a burst of band-passed noise and a low sine, the burst peaking at 0.3', () => {
    const a = fakeAudio();
    expect(a.play({ gain: 1 })).toBe(true);
    expect(a.of('BufferSource')).toHaveLength(1);
    expect(a.of('Oscillator')).toHaveLength(1);
    const [band] = a.of('BiquadFilter');
    expect(band.type).toBe('bandpass');
    expect(band.frequency.value).toBe(1800);
    expect(a.peak(band.outs[0].gain)).toBeCloseTo(0.3, 9);
    const [osc] = a.of('Oscillator');
    expect(osc.frequency.events[0][1]).toBe(90);
    expect(a.peak(osc.outs[0].gain)).toBeCloseTo(0.18, 9);
    for (const s of [...a.of('BufferSource'), ...a.of('Oscillator')]) expect(s.stopped).toBeGreaterThan(s.started);
  });

  it('takes the gain as given, and the pitch on both', () => {
    const a = fakeAudio();
    a.play({ gain: 0.5, pitch: 1.1 });
    const [band] = a.of('BiquadFilter');
    expect(a.peak(band.outs[0].gain)).toBeCloseTo(0.15, 9);
    expect(band.frequency.value).toBeCloseTo(1980, 9);
    expect(a.of('Oscillator')[0].frequency.events[0][1]).toBeCloseTo(99, 9);
  });

  it('does nothing, and says so, without a context', () => {
    expect(thud({ gain: 1, context: () => null })).toBe(false);
    expect(thud({ gain: 1, context: () => fakeAudio().ctx, destination: () => null })).toBe(false);
  });

  it('places itself in the room round the listener when told where', () => {
    const a = fakeAudio();
    a.play({ gain: 1, at: [10, 0, 0], listener: { position: [0, 0, 0], forward: [0, 0, -1] } });
    const [panner] = a.of('Panner');
    expect(panner).toBeDefined();
    expect(panner.panningModel).toBe('equalpower');
    expect(panner.distanceModel).toBe('linear');
    expect(panner.maxDistance).toBe(60);
    expect(panner.positionX.value).toBeCloseTo(10, 9);
    expect(panner.outs).toEqual([a.out]);
    for (const g of a.of('Gain')) expect(g.outs).toEqual([panner]);
  });

  it('turns the place into the listener’s own frame', () => {
    // facing +x, a thing at +z is on the right
    const a = fakeAudio();
    a.play({ gain: 1, at: [5, 0, 3], listener: { position: [5, 0, 0], forward: [1, 0, 0] } });
    const [panner] = a.of('Panner');
    expect(panner.positionX.value).toBeCloseTo(3, 9);
    expect(panner.positionZ.value).toBeCloseTo(0, 9);
  });

  it('goes straight out when it isn’t told where', () => {
    const a = fakeAudio();
    a.play({ gain: 1, at: [10, 0, 0] });
    expect(a.of('Panner')).toHaveLength(0);
    for (const g of a.of('Gain')) expect(g.outs).toEqual([a.out]);
  });
});

describe('play and hit', () => {
  let a;
  let clock = 0;
  beforeEach(() => {
    a = fakeAudio();
    site.ctx = a.ctx;
    site.out = a.out;
    // every call a second apart, past every throttle
    vi.spyOn(performance, 'now').mockImplementation(() => (clock += 1000));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    site.ctx = site.out = null;
  });

  // the loudest any gain node reaches, through any trim in front of the output
  const loudest = (made) => {
    const level = (n) => (n.kind === 'Gain' ? n.gain.value : 1);
    const reach = (n) => (n === a.out ? 1 : n.outs.length ? level(n) * Math.max(...n.outs.map(reach)) : 0);
    return Math.max(...made.filter((n) => n.kind === 'Gain' && n.gain.events.length).map((n) => a.peak(n.gain) * reach(n.outs[0] ?? a.out)));
  };
  const fresh = () => {
    a = fakeAudio();
    site.ctx = a.ctx;
    site.out = a.out;
    return a;
  };

  it('plays a sound by name, as it always has', () => {
    expect(play('thunk')).toBeGreaterThan(0);
    expect(a.of('Oscillator')).toHaveLength(1);
    expect(play('nothing such')).toBe(0);
  });

  it('plays at half the gain when asked', () => {
    play('thunk');
    const whole = loudest(a.made);
    fresh();
    play('thunk', { gain: 0.5 });
    expect(loudest(a.made)).toBeCloseTo(whole / 2, 9);
  });

  it('makes nothing at all at gain 0, and clamps a gain over 1', () => {
    expect(play('thunk', { gain: 0 })).toBe(0);
    expect(a.made.filter((n) => n.kind !== 'destination' && n.kind !== 'out')).toHaveLength(0);
    play('thunk');
    const whole = loudest(a.made);
    fresh();
    play('thunk', { gain: 3 });
    expect(loudest(a.made)).toBeCloseTo(whole, 9);
  });

  it('doubles every oscillator’s frequency at pitch 2, and a buffer’s rate', () => {
    play('thunk');
    const low = a.of('Oscillator')[0].frequency.events.map(([, v]) => v);
    expect(a.of('BufferSource')[0].playbackRate.value).toBe(1);
    fresh();
    play('thunk', { pitch: 2 });
    expect(a.of('Oscillator')[0].frequency.events.map(([, v]) => v)).toEqual(low.map((v) => v * 2));
    expect(a.of('BufferSource')[0].playbackRate.value).toBe(2);
  });

  it('plays the blocks’ sounds by name: a crunch, a splash, an oof, each short and quieter at a lower gain', () => {
    for (const name of ['crunch', 'splash', 'oof']) {
      fresh();
      const long = play(name);
      expect(long, name).toBeGreaterThan(0);
      expect(long, name).toBeLessThan(1);
      const whole = loudest(a.made);
      fresh();
      play(name, { gain: 0.5 });
      expect(loudest(a.made), name).toBeCloseTo(whole / 2, 9);
    }
  });

  it('plays nothing for a tap under the law’s threshold, and says so', () => {
    expect(hit('thunk', 10)).toBe(false);
    expect(a.of('Oscillator')).toHaveLength(0);
  });

  it('plays a full hit at gain 1', () => {
    play('thunk');
    const whole = loudest(a.made);
    fresh();
    expect(hit('thunk', 120)).toBe(true);
    expect(loudest(a.made)).toBeCloseTo(whole, 9);
  });

  it('keeps the old hit sound under the same name', () => {
    expect(hit()).toBeGreaterThan(0);
    expect(a.of('Oscillator').length + a.of('BufferSource').length).toBeGreaterThan(0);
  });
});
