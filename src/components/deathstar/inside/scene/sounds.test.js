import { describe, expect, it } from 'vitest';
import { ALARM } from '../rules/alarm';
import { WEAPONS } from '../rules/combat';
import { ROOM_KINDS } from '../rules/layout';
import { DS1 } from '../rules/stations/ds1';
import { DS2 } from '../rules/stations/ds2';
import { BPM, FIGURE, HUMS, chatterOf, createSounds, doorFor, gunFor, heard, humFor, klaxonFor, musicFor, notes, stepFor, surfaceOf, ticks } from './sounds';

// A Web Audio context that only remembers: every node it makes, what each
// is joined to, and when each source starts and stops. Enough to tell
// whether a sound was made and whether everything made was stopped.
function fakeAudio() {
  const made = [];
  // what is scheduled on a param, as [time, value, tau]: a tau glides towards
  // the value from that time; a ramp is taken as a step at its end
  const param = (value = 0) => {
    const p = {
      value,
      events: [],
      setValueAtTime: (v, t) => p.events.push([t, v, 0]),
      linearRampToValueAtTime: (v, t) => p.events.push([t, v, 0]),
      exponentialRampToValueAtTime: (v, t) => p.events.push([t, v, 0]),
      setTargetAtTime: (v, t, tau) => p.events.push([t, v, tau]),
      cancelScheduledValues: (t) => (p.events = p.events.filter(([at]) => at < t)),
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
    for (const p of ['gain', 'frequency', 'Q', 'pan', 'detune', 'playbackRate', 'offset']) n[p] = param(p === 'gain' || p === 'playbackRate' ? 1 : 0);
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
    set(t, k, v) {
      t[k] = v;
      return true;
    },
  });
  const sources = () => made.filter((n) => n.started !== undefined);
  const running = (at = Infinity) => sources().filter((n) => n.stopped === undefined || n.stopped > at);
  return { ctx, made, sources, running, bus: node('bus') };
}

// a param’s value at time `t`, from what was scheduled on it
function valueAt(p, t) {
  const due = p.events.filter(([at]) => at <= t).sort((x, y) => x[0] - y[0]);
  let v = p.value;
  due.forEach(([at, to, tau], i) => {
    const until = i + 1 < due.length ? due[i + 1][0] : t;
    v = tau ? to + (v - to) * Math.exp(-(until - at) / tau) : to;
  });
  return v;
}

// how loud what reaches node `n` is at time `t`: the gains on the way to the bus, by the loudest way
const heardAt = (a, n, t) => (n === a.bus ? 1 : Math.max(0, ...n.outs.map((o) => valueAt(n.gain, t) * heardAt(a, o, t))));

// every node `n` feeds, on the way to the bus
const downstream = (n, seen = new Set()) => {
  for (const o of n.outs) if (!seen.has(o)) downstream(o, seen.add(o));
  return seen;
};

// the nodes that were there before `play` and that what it made feeds straight into
const into = (a, play) => {
  const from = a.made.length;
  play();
  const fresh = new Set(a.made.slice(from));
  return new Set([...fresh].flatMap((n) => n.outs).filter((n) => !fresh.has(n)));
};

// lib/sfx’s one hall for the context: the convolver that isn’t the station’s own (that feeds the bus)
const hallOf = (a) => a.made.find((n) => n.kind === 'Convolver' && !n.outs.includes(a.bus));

const near = { x: 0, y: 1.6, z: 0, yaw: 0 };

describe('where a sound is heard from', () => {
  it('is at full strength within 3 m, and falls off as it goes further', () => {
    expect(heard({ x: 0, y: 1.6, z: -2 }, near).gain).toBe(1);
    const at = [6, 12, 24, 48].map((d) => heard({ x: 0, y: 1.6, z: -d }, near).gain);
    for (let i = 1; i < at.length; i++) expect(at[i]).toBeLessThan(at[i - 1]);
    expect(at[0]).toBeCloseTo(0.5);
  });

  it('is not heard at all beyond 60 m, the furthest a rifle reaches', () => {
    expect(heard({ x: 0, y: 1.6, z: -61 }, near).gain).toBe(0);
  });

  it('counts the floors between, so a shot a level down is further off than one on yours', () => {
    expect(heard({ x: 6, y: 1.6 - 12, z: 0 }, near).gain).toBeLessThan(heard({ x: 6, y: 1.6, z: 0 }, near).gain);
  });

  it('pans to the right ear what is east of someone facing north, and to the left what is west', () => {
    expect(heard({ x: 5, y: 1.6, z: 0 }, near).pan).toBeGreaterThan(0.8);
    expect(heard({ x: -5, y: 1.6, z: 0 }, near).pan).toBeLessThan(-0.8);
    expect(heard({ x: 0, y: 1.6, z: -5 }, near).pan).toBeCloseTo(0);
  });

  it('turns with the listener: facing east, what is south is on the right', () => {
    expect(heard({ x: 0, y: 1.6, z: 5 }, { ...near, yaw: Math.PI / 2 }).pan).toBeGreaterThan(0.8);
  });

  it('dulls what is far off, as air and walls take the top end', () => {
    expect(heard({ x: 0, y: 1.6, z: -40 }, near).cut).toBeLessThan(heard({ x: 0, y: 1.6, z: -4 }, near).cut);
  });

  it('plays at full strength, centred, while there is nobody to hear it from yet', () => {
    expect(heard({ x: 30, y: 0, z: 30 }, null)).toMatchObject({ gain: 1, pan: 0 });
  });
});

describe('the station’s hum', () => {
  it('has a hum for every kind of room a station may have', () => {
    for (const kind of ROOM_KINDS) expect(humFor(kind), kind).toEqual(expect.objectContaining({ drone: expect.any(Number), air: expect.any(Number), size: expect.any(Number) }));
  });

  it('gives every kind of room a hum of its own, not just the corridor’s', () => {
    for (const kind of ROOM_KINDS.filter((k) => k !== 'field')) expect(Object.hasOwn(HUMS, kind), kind).toBe(true);
  });

  it('makes a hangar vast and airy beside a corridor’s close hum', () => {
    expect(humFor('hangar').size).toBeGreaterThan(humFor('corridor').size * 3);
    expect(humFor('hangar').air).toBeGreaterThan(humFor('corridor').air);
  });

  it('makes detention harsh with the buzz of its lights', () => {
    expect(humFor('detention').harsh).toBeGreaterThan(0);
    expect(humFor('corridor').harsh).toBe(0);
  });

  it('makes the compactor wet and dripping', () => {
    expect(humFor('compactor').drip).toBeGreaterThan(0);
    expect(humFor('compactor').wet).toBeGreaterThan(0);
    expect(humFor('corridor').drip).toBe(0);
  });

  it('makes a shaft deep and windy', () => {
    expect(humFor('shaft').drone).toBeLessThan(humFor('corridor').drone);
    expect(humFor('shaft').wind).toBeGreaterThan(humFor('corridor').wind);
  });

  it('makes the throne room cold, with the reactor’s thrum far below', () => {
    expect(humFor('throne').cold).toBeGreaterThan(0);
    expect(humFor('throne').thrum).toBeGreaterThan(0);
    expect(humFor('corridor').thrum).toBe(0);
  });

  it('hums a bay’s open side as the bay, and anything it doesn’t know as a corridor', () => {
    expect(humFor('field')).toEqual(humFor('hangar'));
    expect(humFor('nowhere')).toEqual(humFor('corridor'));
  });
});

describe('doors, guns, klaxons and feet', () => {
  it('has a sound for every kind of door both stations use, and none for an open arch', () => {
    const kinds = new Set([...DS1.doors, ...DS2.doors].map((d) => d.kind));
    for (const kind of kinds) expect(doorFor(kind), kind).not.toBe(undefined);
    expect(doorFor('arch')).toBe(null);
  });

  it('makes a blast door clang and run longer than a sliding door’s hiss', () => {
    expect(doorFor('blast').clang).toBeGreaterThan(0);
    expect(doorFor('slide').clang).toBe(0);
    expect(doorFor('blast').length).toBeGreaterThan(doorFor('slide').length);
    expect(doorFor('hatch').clunk).toBeGreaterThan(0);
  });

  it('has a sound for every gun in the armoury, the DL-44 with more body than the E-11', () => {
    for (const w of Object.keys(WEAPONS)) expect(gunFor(w), w).toEqual(expect.objectContaining({ gain: expect.any(Number), body: expect.any(Number) }));
    expect(gunFor('dl44').body).toBeGreaterThan(gunFor('e11').body);
    expect(gunFor('nothing')).toEqual(gunFor('e11'));
  });

  it('sounds no klaxon while calm or wary, and a faster, louder one in a lockdown than at the alert', () => {
    for (const level of ALARM) expect(klaxonFor(level), level).not.toBe(undefined);
    expect(klaxonFor('calm')).toBe(null);
    expect(klaxonFor('wary')).toBe(null);
    expect(klaxonFor('lockdown').period).toBeLessThan(klaxonFor('alert').period);
    expect(klaxonFor('lockdown').gain).toBeGreaterThan(klaxonFor('alert').gain);
  });

  it('keeps the klaxon going through a hunt, quieter than the lockdown', () => {
    expect(klaxonFor('hunt').gain).toBeGreaterThan(0);
    expect(klaxonFor('hunt').gain).toBeLessThan(klaxonFor('lockdown').gain);
    expect(klaxonFor('stand-down')).toBe(null);
  });

  it('walks the compactor wet, the shafts and walkways on grating, and everywhere else on deck plating', () => {
    expect(surfaceOf('compactor')).toBe('wet');
    for (const kind of ['shaft', 'chasm', 'reactor', 'superstructure']) expect(surfaceOf(kind), kind).toBe('grate');
    for (const kind of ['corridor', 'hangar', 'throne', 'detention']) expect(surfaceOf(kind), kind).toBe('deck');
  });

  it('has a step for each surface, ringing only on grating and splashing only when wet', () => {
    for (const s of ['deck', 'grate', 'wet']) expect(stepFor(s), s).toEqual(expect.objectContaining({ thud: expect.any(Number) }));
    expect(stepFor('grate').ring).toBeGreaterThan(0);
    expect(stepFor('deck').ring).toBe(0);
    expect(stepFor('wet').splash).toBeGreaterThan(0);
    expect(stepFor('deck').splash).toBe(0);
    expect(stepFor('carpet')).toEqual(stepFor('deck'));
  });
});

describe('who sounds like what before they speak', () => {
  it('lets the droids beep, the troops click their helmet comms, and the intercom chime', () => {
    expect(chatterOf('artoo')).toBe('beeps');
    expect(chatterOf('mouse')).toBe('beeps');
    expect(chatterOf('trooper')).toBe('comm');
    expect(chatterOf('stormtrooper')).toBe('comm');
    expect(chatterOf('intercom')).toBe('chime');
    expect(chatterOf('vader')).toBe(null);
  });
});

describe('the music', () => {
  it('is quiet, a slow drone, or the drone with the alert’s figure', () => {
    expect(musicFor('quiet')).toBe(null);
    expect(musicFor('calm')).toMatchObject({ figure: false });
    expect(musicFor('alert')).toMatchObject({ figure: true });
    expect(musicFor('anything')).toBe(null);
  });

  it('writes the alert’s figure in a minor mode, with its minor third', () => {
    const aeolian = new Set([0, 2, 3, 5, 7, 8, 10]);
    for (const [semis] of FIGURE) expect(aeolian.has(((semis % 12) + 12) % 12), `${semis}`).toBe(true);
    expect(FIGURE.some(([semis]) => semis === 3)).toBe(true);
  });

  it('never opens on three repeated notes, so it can’t be taken for the film’s march', () => {
    const [a, b, c] = FIGURE.map(([semis]) => semis);
    expect(a === b && b === c).toBe(false);
  });

  it('fills whole bars of four, so the loop comes round on the downbeat', () => {
    const beats = FIGURE.reduce((sum, [, len]) => sum + len, 0);
    expect(beats % 4).toBe(0);
  });

  it('plays the figure from its start on the root, and comes round again after its last bar', () => {
    const beat = 60 / BPM;
    const loop = FIGURE.reduce((sum, [, len]) => sum + len, 0) * beat;
    const first = notes(10, 10, 10.01);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ at: 10, semis: FIGURE[0][0], beats: FIGURE[0][1] });
    const again = notes(10, 10 + loop - 0.001, 10 + loop + 0.001);
    expect(again).toHaveLength(1);
    expect(again[0].at).toBeCloseTo(10 + loop);
    expect(again[0].semis).toBe(FIGURE[0][0]);
  });

  it('plays nothing before the figure starts', () => {
    expect(notes(10, 5, 9.9)).toEqual([]);
  });

  it('plays each note once, however the time is cut into windows', () => {
    const loop = (FIGURE.reduce((sum, [, len]) => sum + len, 0) * 60) / BPM;
    const whole = notes(0, 0, 3 * loop);
    expect(whole).toHaveLength(3 * FIGURE.length);
    const cut = [];
    for (let t = 0; t < 3 * loop; t += 0.37) cut.push(...notes(0, t, Math.min(t + 0.37, 3 * loop)));
    expect(cut.map((n) => n.at)).toEqual(whole.map((n) => n.at));
  });
});

describe('ticks', () => {
  it('gives the times a beat falls in a window, from its start', () => {
    expect(ticks(1, 0.5, 0, 2.6)).toEqual([1, 1.5, 2, 2.5]);
    expect(ticks(1, 0.5, 1.2, 2.2)).toEqual([1.5, 2]);
    expect(ticks(1, 0.5, 2.6, 2.9)).toEqual([]);
  });
});

describe('createSounds', () => {
  it('is quiet without Web Audio, and every call is safe', async () => {
    const s = createSounds(null, null);
    expect(() => {
      s.hum('hangar');
      s.door('blast');
      s.lift(true);
      s.alarm('lockdown');
      s.blaster('e11', { x: 0, y: 0, z: 0 }, near);
      s.hit({ x: 0, y: 0, z: 0 });
      s.saber(true);
      s.clash({ x: 0, y: 0, z: 0 });
      s.step('grate');
      s.music('alert');
      s.update(near);
      s.dispose();
    }).not.toThrow();
    expect(await s.say('artoo', 'Beeps.')).toBe(null);
  });

  it('hums the room it is told of, and fades the last one out when the room changes', () => {
    const a = fakeAudio();
    const s = createSounds(a.bus, a.ctx);
    s.hum('corridor');
    const corridor = a.running();
    expect(corridor.length).toBeGreaterThan(0);
    a.ctx.currentTime = 5;
    s.hum('hangar');
    for (const src of corridor) expect(src.stopped, src.kind).toBeGreaterThan(5);
    expect(a.running(10).length).toBeGreaterThan(0);
  });

  it('starts nothing new when told of the room it is already humming', () => {
    const a = fakeAudio();
    const s = createSounds(a.bus, a.ctx);
    s.hum('corridor');
    const before = a.sources().length;
    s.hum('corridor');
    expect(a.sources().length).toBe(before);
  });

  it('drips in the compactor as time goes on', () => {
    const a = fakeAudio();
    const s = createSounds(a.bus, a.ctx, { rand: () => 0.5 });
    s.hum('compactor');
    s.update(near);
    const before = a.sources().length;
    for (let t = 0.1; t < 6; t += 0.1) {
      a.ctx.currentTime = t;
      s.update(near);
    }
    expect(a.sources().length).toBeGreaterThan(before);
  });

  it('fires a shot heard close by, and makes nothing at all of one too far off to hear', () => {
    const a = fakeAudio();
    const s = createSounds(a.bus, a.ctx);
    s.update(near);
    const quiet = a.sources().length;
    s.blaster('e11', { x: 0, y: 1.6, z: -200 }, near);
    expect(a.sources().length).toBe(quiet);
    s.blaster('dl44', { x: 0, y: 1.6, z: -8 }, near);
    expect(a.sources().length).toBeGreaterThan(quiet);
  });

  it('places a hit from the listener it was last given', () => {
    const a = fakeAudio();
    const s = createSounds(a.bus, a.ctx);
    s.update({ x: 0, y: 1.6, z: 500, yaw: 0 });
    const quiet = a.sources().length;
    s.hit({ x: 0, y: 1, z: 0 });
    expect(a.sources().length).toBe(quiet);
    s.update(near);
    s.hit({ x: 0, y: 1, z: -3 });
    expect(a.sources().length).toBeGreaterThan(quiet);
  });

  it('thumps a hurt at your ear, and nothing for a hurt of no weight', () => {
    const a = fakeAudio();
    const s = createSounds(a.bus, a.ctx);
    s.update(near);
    const quiet = a.sources().length;
    s.hurt(0);
    expect(a.sources().length).toBe(quiet);
    s.hurt(0.6);
    expect(a.sources().length).toBeGreaterThan(quiet);
  });

  it('opens a sliding door with a hiss, and an arch with nothing', () => {
    const a = fakeAudio();
    const s = createSounds(a.bus, a.ctx);
    const quiet = a.sources().length;
    s.door('arch');
    expect(a.sources().length).toBe(quiet);
    s.door('slide');
    expect(a.sources().length).toBeGreaterThan(quiet);
  });

  it('sounds the klaxon round and round in a lockdown, and stops it at the stand-down', () => {
    const a = fakeAudio();
    const s = createSounds(a.bus, a.ctx);
    s.alarm('lockdown');
    let made = 0;
    for (let t = 0; t < 4; t += 0.05) {
      a.ctx.currentTime = t;
      const before = a.sources().length;
      s.update(near);
      if (a.sources().length > before) made += 1;
    }
    expect(made).toBeGreaterThanOrEqual(3);
    s.alarm('calm');
    const after = a.sources().length;
    for (let t = 4; t < 8; t += 0.05) {
      a.ctx.currentTime = t;
      s.update(near);
    }
    expect(a.sources().length).toBe(after);
  });

  it('plays the alert’s figure as time goes on, and lets it go when the mood is quiet', () => {
    const a = fakeAudio();
    const s = createSounds(a.bus, a.ctx);
    s.music('alert');
    const drone = a.sources().length;
    for (let t = 0; t < 4; t += 0.05) {
      a.ctx.currentTime = t;
      s.update(near);
    }
    expect(a.sources().length).toBeGreaterThan(drone);
    s.music('quiet');
    expect(a.running(10)).toEqual([]);
  });

  it('whines while the lift moves and winds down when it stops', () => {
    const a = fakeAudio();
    const s = createSounds(a.bus, a.ctx);
    s.lift(true);
    expect(a.running().length).toBeGreaterThan(0);
    a.ctx.currentTime = 3;
    s.lift(false);
    expect(a.running(10)).toEqual([]);
  });

  it('hums a lit saber until it is put away', () => {
    const a = fakeAudio();
    const s = createSounds(a.bus, a.ctx);
    s.saber(true);
    expect(a.running(30).length).toBeGreaterThan(0);
    a.ctx.currentTime = 2;
    s.saber(false);
    expect(a.running(30)).toEqual([]);
  });

  it('clicks a trooper’s comm before his line, and beeps for a droid', () => {
    const a = fakeAudio();
    const s = createSounds(a.bus, a.ctx);
    const quiet = a.sources().length;
    s.say('trooper', 'Move along.');
    const click = a.sources().length;
    expect(click).toBeGreaterThan(quiet);
    s.say('artoo', '(Beeps.)');
    expect(a.sources().length).toBeGreaterThan(click);
  });

  it('stops everything it started when disposed, and makes nothing after', () => {
    const a = fakeAudio();
    const s = createSounds(a.bus, a.ctx);
    s.hum('throne');
    s.music('alert');
    s.alarm('lockdown');
    s.lift(true);
    s.saber(true);
    s.update(near);
    s.dispose();
    expect(a.running(30)).toEqual([]);
    const after = a.sources().length;
    s.hum('hangar');
    s.blaster('e11');
    s.step('deck');
    s.update(near);
    expect(a.sources().length).toBe(after);
  });
});

// lib/sfx’s blast, clang, saber and beeps ring through one hall per context,
// and that hall joins every destination any of them is ever given.
describe('lib/sfx’s reverb', () => {
  const spot = (x, z) => ({ x, y: 1.6, z });

  it('rings into a few sinks of its own, never into a voice the station’s other sounds are placed through', () => {
    const a = fakeAudio();
    const s = createSounds(a.bus, a.ctx);
    s.update(near);
    for (let i = 0; i < 40; i++) {
      s.step('deck', spot(i % 7, -(i % 5)));
      if (i % 3 === 0) s.blaster('dl44', spot(4 - i, -6));
      if (i % 5 === 0) s.door('blast', spot(i % 9, 3));
      if (i % 4 === 0) s.hit(spot(-2, i % 6));
    }
    s.saber(true);
    s.say('artoo', '(Beeps.)');
    const rung = new Set(hallOf(a).outs);
    expect(rung.size).toBeGreaterThan(0);
    expect(rung.size).toBeLessThanOrEqual(3);
    const placed = new Set();
    for (let i = 0; i < 40; i++) for (const n of into(a, () => s.step('grate', spot(-i, i % 3)))) placed.add(n);
    for (const sink of rung) for (const n of [sink, ...downstream(sink)]) expect(placed.has(n)).toBe(false);
  });

  it('keeps a far door’s ring as quiet as a door that far off, however loud what rang before it', () => {
    const a = fakeAudio();
    const s = createSounds(a.bus, a.ctx);
    s.update(near);
    s.blaster('dl44', spot(1, -2));
    s.door('blast', spot(0, -3));
    s.saber(true);
    a.ctx.currentTime = 6;
    s.update(near);
    s.door('blast', spot(0, -30));
    const total = [...new Set(hallOf(a).outs)].reduce((sum, n) => sum + heardAt(a, n, 6.01), 0);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(heard(spot(0, -30), near).gain);
  });

  it('leaves nothing turned up once everything has rung', () => {
    const a = fakeAudio();
    const s = createSounds(a.bus, a.ctx);
    s.update(near);
    for (let i = 0; i < 20; i++) {
      s.blaster(i % 2 ? 'dl44' : 'a280', spot(i - 10, -4));
      s.door('blast', spot(10 - i, 2));
    }
    s.say('artoo', '(Beeps.)');
    const later = 10;
    const total = [...new Set(hallOf(a).outs)].reduce((sum, n) => sum + heardAt(a, n, later), 0);
    expect(total).toBeLessThan(0.01);
  });

  it('rings nothing through it for a blast door too far off to carry its clang, though the door is still heard', () => {
    const a = fakeAudio();
    const s = createSounds(a.bus, a.ctx);
    s.update(near);
    s.door('blast', spot(0, -3));
    const hall = hallOf(a);
    const before = a.made.length;
    const sources = a.sources().length;
    s.door('blast', spot(0, -45));
    expect(a.sources().length).toBeGreaterThan(sources);
    expect(a.made.slice(before).some((n) => n.outs.includes(hall))).toBe(false);
  });
});
