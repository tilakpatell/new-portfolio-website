// The sitar, as a physical model that runs on the audio thread.
//
// Every string is a digital waveguide: a delay line one period long, read at a
// fractional position so its length can change smoothly (that is meend: the
// string pulled sideways across the fret), with a little loss on each pass.
//
// The jawari is the sitar's wide, curved bridge. While the string swings down
// onto it, the point where the string leaves the bridge moves along the curve,
// so the vibrating length shortens for part of every cycle. Here the length
// shrinks with the string's own displacement, which throws energy up into the
// overtones and keeps it there: the buzz that blooms after the pluck instead of
// dying away. (Clipping the wave instead only drains energy, and sounds harsh.)
//
// Under the main string run eleven sympathetic strings (tarab), tuned to the
// raga's notes and never plucked: the main string drives them through the
// bridge, so a note the tarab share rings on after it is played. Two chikari
// strings, the high drones, are struck for rhythm.
//
// Messages carry an AudioContext time, so a phrase plays sample-accurately:
//   { type: 'pluck', time, freq, vel }      play the main string at freq
//   { type: 'glide', time, freq, tau }      meend: move the pitch, time constant tau seconds
//   { type: 'damp', time }                  stop the main string
//   { type: 'chikari', time, vel }          strike the drone strings
//   { type: 'tune', tarab: [Hz…], chikari: [Hz, Hz] }
// It posts { type: 'meter', tarab: [0…1…], main } about fifteen times a second.

class Str {
  constructor(size) {
    this.buf = new Float32Array(size);
    this.size = size;
    this.w = 0;
    this.len = 200; // delay in samples, now
    this.target = 200; // and where meend is taking it
    this.glide = 1; // per-sample step toward the target (1 = at once)
    this.g = 0.9995; // loss per pass
    this.bright = 0.06; // loop filter: more is darker
    this.jaw = 0; // how far the bridge shortens the string at full press
    this.ref = 0.32; // displacement at which the string lies fully on the bridge
    this.th = 0.025; // below this the string swings clear of the bridge's curve
    this.grit = 0; // how unevenly the string scrapes the bridge: the fuzz between partials
    this.rnd = 22222;
    this.dc = 0;
    this.prev = 0;
    this.exc = null;
    this.excAt = 0;
    this.energy = 0;
    this.asleep = true;
    this.quiet = 0;
  }

  // The loss and filter delay make the loop a little long; take it off the length.
  setFreq(freq, t60, instant) {
    const len = Math.min(this.size - 4, Math.max(4, sampleRate / freq - this.bright));
    this.target = len;
    if (instant) this.len = len;
    this.g = Math.pow(10, -3 / (t60 * freq));
  }

  tick(input) {
    if (this.asleep) {
      if (input < 1e-7 && input > -1e-7) return 0;
      this.asleep = false;
    }
    if (this.len !== this.target) {
      this.len += (this.target - this.len) * this.glide;
      if (Math.abs(this.target - this.len) < 1e-4) this.len = this.target;
    }
    let d = this.len;
    if (this.jaw) {
      const press = (this.prev - this.dc) / this.ref - this.th;
      if (press > 0) {
        this.rnd = (this.rnd * 1664525 + 1013904223) >>> 0;
        const jitter = 1 + this.grit * ((this.rnd / 4294967296) * 2 - 1);
        d *= 1 - this.jaw * (press < 2 ? press : 2) * jitter;
      }
    }
    // read the delay line at w - d, and one sample earlier for the loss filter
    const buf = this.buf;
    const size = this.size;
    let p = this.w - d;
    if (p < 0) p += size;
    const k = p | 0;
    const f = p - k;
    const y0 = buf[k === 0 ? size - 1 : k - 1];
    const y1 = buf[k];
    const y2 = buf[k + 1 === size ? 0 : k + 1];
    const a = y1 + (y2 - y1) * f;
    const b = y0 + (y1 - y0) * f;
    let v = this.g * (a + this.bright * (b - a)) + input;
    if (this.exc) {
      v += this.exc[this.excAt++];
      if (this.excAt >= this.exc.length) this.exc = null;
    }
    this.dc += (v - this.dc) * 0.0005;
    buf[this.w] = v;
    this.w = this.w + 1 === size ? 0 : this.w + 1;
    this.prev = v;
    this.energy += v * v;
    // a string that has rung down goes to sleep until something moves it
    if (v < 1e-6 && v > -1e-6 && !this.exc) {
      if (++this.quiet > size) {
        this.asleep = true;
        this.quiet = 0;
        buf.fill(0);
      }
    } else this.quiet = 0;
    return v;
  }

  // A pluck: the string's shape as the mizrab lets go, a sharp triangle with its
  // apex near the bridge, plus a little noise. A string already ringing is
  // mostly stopped by the plectrum first.
  pluck(vel, at, seed) {
    this.asleep = false;
    this.quiet = 0;
    for (let i = 0; i < this.size; i++) this.buf[i] *= 0.25;
    const n = Math.max(8, Math.round(this.len));
    const e = new Float32Array(n);
    let s = seed >>> 0 || 1;
    let prev = 0;
    for (let i = 0; i < n; i++) {
      const u = i / n;
      const tri = u < at ? u / at : (1 - u) / (1 - at);
      s = (s * 1664525 + 1013904223) >>> 0;
      const noise = (s / 4294967296) * 2 - 1;
      // a soft pluck is a rounder one: smooth the shape more when it's gentle
      const x = tri - 0.5 + 0.06 * noise;
      prev += (x - prev) * (0.35 + 0.65 * vel);
      e[i] = prev * vel;
    }
    this.exc = e;
    this.excAt = 0;
  }
}

// The body: the gourd and the soundboard colour everything the strings send
// them. Two filters per channel, set against a recording of a real sitar.
function biquad(type, f, q, gainDb) {
  const A = Math.pow(10, gainDb / 40);
  const w = (2 * Math.PI * f) / sampleRate;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'peak') {
    b0 = 1 + alpha * A;
    b1 = -2 * cos;
    b2 = 1 - alpha * A;
    a0 = 1 + alpha / A;
    a1 = -2 * cos;
    a2 = 1 - alpha / A;
  } else {
    // high shelf
    const sq = 2 * Math.sqrt(A) * alpha;
    b0 = A * (A + 1 + (A - 1) * cos + sq);
    b1 = -2 * A * (A - 1 + (A + 1) * cos);
    b2 = A * (A + 1 + (A - 1) * cos - sq);
    a0 = A + 1 - (A - 1) * cos + sq;
    a1 = 2 * (A - 1 - (A + 1) * cos);
    a2 = A + 1 - (A - 1) * cos - sq;
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0, x1: 0, x2: 0, y1: 0, y2: 0 };
}
function run(f, x) {
  const y = f.b0 * x + f.b1 * f.x1 + f.b2 * f.x2 - f.a1 * f.y1 - f.a2 * f.y2;
  f.x2 = f.x1;
  f.x1 = x;
  f.y2 = f.y1;
  f.y1 = y;
  return y;
}
const body = () => [biquad('peak', 2400, 1.2, -4), biquad('shelf', 4000, 0.7, 6)];

// The gourd and soundboard also ring at their own pitches when the mizrab
// strikes: a few resonant modes, struck by the attack, that fill the gaps
// between the string's harmonics for the first moments of each note.
// Each mode: its pitch, how long it rings (seconds to fall to 1/e) and how
// loud it starts. A band-pass whose bandwidth gives that ring time.
function mode(f, tau, amp) {
  const q = Math.PI * f * tau;
  const w = (2 * Math.PI * f) / sampleRate;
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  const k = amp / alpha; // an impulse through it starts at about `amp`
  return { b0: (k * alpha) / a0, b1: 0, b2: (-k * alpha) / a0, a1: (-2 * Math.cos(w)) / a0, a2: (1 - alpha) / a0, x1: 0, x2: 0, y1: 0, y2: 0 };
}
const MODES = [
  [196, 0.12, 0.05],
  [405, 0.09, 0.035],
  [1010, 0.05, 0.025],
  [2280, 0.03, 0.015],
];

class SitarProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    const size = 4096;
    this.main = new Str(size);
    this.main.jaw = 0.3;
    this.main.bright = 0.06;
    this.main.grit = 0.35;
    // the mizrab's scrape at the start of each pluck: a short burst of bright noise
    this.scrape = 0;
    this.scrapeLevel = 0;
    this.sLp = 0;
    this.sRnd = 99991;
    this.chikari = [new Str(size), new Str(size)];
    this.chikari.forEach((c) => {
      c.jaw = 0.18;
      c.bright = 0.1;
    });
    this.tarab = [];
    this.tarabFreqs = [];
    this.events = [];
    this.seed = 7;
    this.coupling = 0.012;
    this.meterEvery = Math.round(sampleRate / 15);
    this.meterCount = 0;
    // DC blockers (one-pole highpass, ~5 Hz). The bridge's one-sided push leaves
    // a slow offset in the playing strings; the tarab would pile it up.
    this.hpR = 1 - (2 * Math.PI * 5) / sampleRate;
    this.dX = 0;
    this.dY = 0;
    this.lX = 0;
    this.lY = 0;
    this.rX = 0;
    this.rY = 0;
    this.bodyL = body();
    this.bodyR = body();
    this.modes = MODES.map(([f, tau, amp]) => mode(f, tau, amp));
    this.knock = 0; // the strike that sets the body ringing
    this.modeTail = 0; // samples until the body modes have died away
    this.tune([], [293.66, 587.33]);
    this.port.onmessage = (e) => this.receive(e.data);
  }

  tune(tarab, chikari) {
    if (tarab) {
      this.tarabFreqs = tarab;
      this.tarab = tarab.map((f, i) => {
        const s = this.tarab[i] ?? new Str(2048);
        s.bright = 0.07;
        s.setFreq(f, 4.5, true);
        return s;
      });
    }
    if (chikari) chikari.forEach((f, i) => this.chikari[i]?.setFreq(f, 3.5, true));
  }

  receive(msg) {
    if (msg.type === 'tune') {
      this.tune(msg.tarab, msg.chikari);
      return;
    }
    this.events.push(msg);
    this.events.sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
  }

  run(ev) {
    const m = this.main;
    if (ev.type === 'pluck') {
      m.glide = 1;
      m.setFreq(ev.freq, ev.t60 ?? 4.5, true);
      const vel = Math.max(0.05, Math.min(1, ev.vel ?? 0.9));
      m.pluck(vel, ev.at ?? 0.08, (this.seed += 7919));
      this.scrape = Math.round(sampleRate * 0.012);
      this.scrapeLevel = 0.06 * vel;
      this.knock = vel;
      this.modeTail = Math.round(sampleRate * 0.8);
    } else if (ev.type === 'glide') {
      m.glide = 1 - Math.exp(-1 / (Math.max(0.005, ev.tau ?? 0.08) * sampleRate));
      m.setFreq(ev.freq, 4.5, false);
    } else if (ev.type === 'damp') {
      for (let i = 0; i < m.size; i++) m.buf[i] *= 0.02;
    } else if (ev.type === 'chikari') {
      this.chikari.forEach((c, i) => c.pluck((ev.vel ?? 0.7) * (i ? 0.7 : 1), 0.1, (this.seed += 104729)));
    }
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    const L = out[0];
    const R = out[1] ?? out[0];
    const n = L.length;
    const t0 = currentTime;
    const tar = this.tarab;
    const nt = tar.length;
    // nothing ringing and nothing due: silence, almost for free
    if (!this.events.length && this.main.asleep && this.chikari[0].asleep && this.chikari[1].asleep && this.modeTail <= 0 && tar.every((t) => t.asleep)) {
      L.fill(0);
      if (R !== L) R.fill(0);
      return true;
    }
    this.modeTail -= n;
    for (let i = 0; i < n; i++) {
      while (this.events.length && (this.events[0].time ?? 0) <= t0 + i / sampleRate) this.run(this.events.shift());
      const v = this.main.tick(0);
      const c = this.chikari[0].tick(0) + this.chikari[1].tick(0);
      // the bridge carries the playing strings' motion into the tarab
      let raw = v + 0.5 * c;
      if (this.scrape > 0) {
        // noise, high-passed by subtracting a smoothed copy, fading over 12 ms
        this.sRnd = (this.sRnd * 1664525 + 1013904223) >>> 0;
        const w = (this.sRnd / 4294967296) * 2 - 1;
        this.sLp += (w - this.sLp) * 0.25;
        raw += (w - this.sLp) * this.scrapeLevel * (this.scrape / (sampleRate * 0.012));
        this.scrape--;
      }
      // the body modes, struck once per pluck
      let ring = 0;
      const k = this.knock;
      this.knock = 0;
      for (let j = 0; j < this.modes.length; j++) ring += run(this.modes[j], k);
      raw += ring;
      this.dY = raw - this.dX + this.hpR * this.dY;
      this.dX = raw;
      const drive = this.dY * this.coupling;
      let tl = 0;
      let tr = 0;
      for (let j = 0; j < nt; j++) {
        const y = tar[j].tick(drive);
        if (j & 1) tr += y;
        else tl += y;
      }
      const mid = this.dY + 0.05 * c;
      const l = mid + 0.42 * tl + 0.16 * tr;
      const r = mid + 0.16 * tl + 0.42 * tr;
      this.lY = l - this.lX + this.hpR * this.lY;
      this.lX = l;
      this.rY = r - this.rX + this.hpR * this.rY;
      this.rX = r;
      L[i] = run(this.bodyL[1], run(this.bodyL[0], this.lY));
      R[i] = run(this.bodyR[1], run(this.bodyR[0], this.rY));
    }
    this.meterCount += n;
    if (this.meterCount >= this.meterEvery) {
      const k = 1 / this.meterCount;
      this.port.postMessage({ type: 'meter', main: Math.sqrt(this.main.energy * k), tarab: tar.map((s) => Math.sqrt(s.energy * k)) });
      this.main.energy = 0;
      tar.forEach((s) => (s.energy = 0));
      this.chikari.forEach((s) => (s.energy = 0));
      this.meterCount = 0;
    }
    return true;
  }
}

registerProcessor('sitar', SitarProcessor);
