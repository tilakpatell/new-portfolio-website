import { describe, expect, it } from 'vitest';
import { thud } from './sfx';

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
    for (const p of ['gain', 'frequency', 'Q', 'detune', 'positionX', 'positionY', 'positionZ']) n[p] = param(p === 'gain' ? 1 : 0);
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
