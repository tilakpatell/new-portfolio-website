/* global window, document, KeyboardEvent */
// anim-check's --held and --talk (scripts/anim-check.mjs re-exports these):
// whether each held thing is in its hand and carried as its kind says, and
// whether each person E can talk to is promised by the prompt and answers
// with the body. (docs/superpowers/specs/2026-10-09-things-in-hand-design.md)
//
// --held: every object with userData.held (set by lib/three/held.js's
// holdItem: { kind, palm, line, grip, up, carry } in its hand's and its own
// spaces) is sampled once a frame: how far its grip is from the palm's
// middle (under 0.03 m), the angle between its axis and the line its kind
// lies along (the thumb's, the fingers' or the palm's: under 15°), for a
// still carry how far the arm swings while the figure walks (under 0.25
// rad), and for an upright one the angle of its top from the world's up
// (under 25°).
// --talk: the route's dev hooks name its talkers (window.__talkers() → [{
// id, name, x, z, y?, upper?(), looking?(), anim? }]: upper the clip on
// its upper layer, else its animator's, looking whether its head's on
// you) and move you
// (window.__teleport(x, z, { face: { x, z } })); for each, you're put 1.5 m
// off facing them, the prompt is read (the [data-prompt] that names them,
// "E Talk · Name", else the first), the key it names is pressed (E, or
// the world's own: Dot Matrix's X), and for half a second of world time
// the upper layer's clip and the head's look are watched. A route without
// the hooks says so and is skipped.
//
//   heldVerdict(samples, { scale = 1 }) → { ok, worst, items }   (pure)
//     samples: [{ id, kind, carry, grip, axis, up, arm, moving }] a frame
//     an item (grip in the world's units, axis and up in radians, arm the
//     upper arm's local quaternion); scale: the world's units to the metre
//   swingOf(quats) → half the widest turn between any two (rad)  (pure)
//   talkVerdict(sample) → { ok, at, why }                        (pure)
//     sample: { prompt, frames: [{ t, upper, look }] }, t seconds of world
//     time since the key; the prompt "<key> Talk", its key its first word
//   keyOf(prompt) → { key, code } | null: the key a prompt names, as a
//     KeyboardEvent has it                                        (pure)
//   promptFor(prompts, name) → { prompt, theirs, of }: the prompt whose
//     words after the dot are `name`, else the first (theirs false); of:
//     how many there were                                         (pure)
//   emptyFails(opts, held, talk) → [why]: --held that sampled nothing and
//     --talk that visited no one, unless opts.allowEmpty           (pure)
//   sampleHeld(roots, up) → [{ id, kind, carry, grip, axis, up, arm, hips }]
//     the held things under the roots now (in the page, and in the tests)
//   heldPageScript() → the page's half as one script: window.__animHeld {
//     start(), stop() → samples }
//   talkCheck(page, { off }) → { skipped } | { talkers: [{ id, name, ok,
//     at, why, prompt, theirs, prompts, key }] } (prompt: the one read;
//     theirs: whether it named them; prompts: how many were up; key: the
//     code pressed)

export const HELD_LIMITS = { grip: 0.03, axis: (15 * Math.PI) / 180, swing: 0.25, up: (25 * Math.PI) / 180 };
export const TALK_WITHIN = 0.5; // seconds of world time for the body to answer E
const MOVING = 0.3; // the hips going faster than this (m/s) is walking

const qAngle = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3])));

export function swingOf(quats) {
  let most = 0;
  for (let i = 0; i < quats.length; i++) for (let j = i + 1; j < quats.length; j++) most = Math.max(most, qAngle(quats[i], quats[j]));
  return most / 2;
}

export function heldVerdict(samples, { scale = 1 } = {}) {
  const by = new Map();
  for (const s of samples ?? []) {
    if (!by.has(s.id)) by.set(s.id, { id: s.id, kind: s.kind, carry: s.carry ?? {}, grip: 0, axis: 0, up: null, swing: null, walked: [] });
    const it = by.get(s.id);
    it.grip = Math.max(it.grip, s.grip / scale);
    it.axis = Math.max(it.axis, s.axis);
    if (it.carry.upright && Number.isFinite(s.up)) it.up = Math.max(it.up ?? 0, s.up);
    if (it.carry.still && s.moving && s.arm) it.walked.push(s.arm);
  }
  const items = [...by.values()].map(({ walked, ...it }) => {
    if (it.carry.still && walked.length > 1) it.swing = swingOf(walked);
    const why = [];
    if (it.grip > HELD_LIMITS.grip) why.push(`grip ${(it.grip * 100).toFixed(1)} cm from the palm`);
    if (it.axis > HELD_LIMITS.axis) why.push(`axis ${((it.axis * 180) / Math.PI).toFixed(0)}° off its line`);
    if (it.swing != null && it.swing > HELD_LIMITS.swing) why.push(`arm swings ${it.swing.toFixed(2)} rad`);
    if (it.up != null && it.up > HELD_LIMITS.up) why.push(`top ${((it.up * 180) / Math.PI).toFixed(0)}° off up`);
    return { ...it, ok: !why.length, why };
  });
  const most = (k) => items.reduce((m, it) => (it[k] == null ? m : Math.max(m ?? 0, it[k])), null);
  return { ok: items.every((it) => it.ok), worst: { grip: most('grip'), axis: most('axis'), swing: most('swing'), up: most('up') }, items };
}

export function keyOf(prompt) {
  const k = typeof prompt === 'string' ? prompt.trim().split(/\s+/)[0] : '';
  if (!k) return null;
  if (/^[a-z]$/i.test(k)) return { key: k.toLowerCase(), code: `Key${k.toUpperCase()}` };
  if (/^\d$/.test(k)) return { key: k, code: `Digit${k}` };
  return { key: k, code: k };
}

export function promptFor(prompts, name) {
  const list = (prompts ?? []).filter((p) => typeof p === 'string' && p);
  const named = list.find((p) => p.includes('·') && p.slice(p.indexOf('·') + 1).trim() === name);
  return { prompt: named ?? list[0] ?? null, theirs: Boolean(named), of: list.length };
}

export function emptyFails(opts, held, talk) {
  if (opts?.allowEmpty) return [];
  const out = [];
  if (opts?.held && !held?.items?.length) out.push('--held sampled nothing');
  if (opts?.talk && !talk?.talkers?.length) out.push('--talk visited no one');
  return out;
}

export function talkVerdict(sample) {
  const prompt = sample?.prompt ?? null;
  const key = prompt?.trim().split(/\s+/)[0] ?? '';
  const talks = prompt && new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} Talk\\b`).test(prompt.trim());
  if (!talks) return { ok: false, at: null, why: prompt ? `the prompt says “${prompt}”` : 'no prompt' };
  const hit = (sample.frames ?? []).find((f) => f.t <= TALK_WITHIN && f.upper && f.look);
  if (!hit) return { ok: false, at: null, why: `no clip on the upper layer and look within ${TALK_WITHIN} s of E` };
  return { ok: true, at: hit.t, why: null };
}

// ── the page's half ──

// the held things under `roots` (Object3Ds), where they are now
export function sampleHeld(roots, upAxis = [0, 1, 0]) {
  const out = [];
  const shown = (o) => {
    for (; o; o = o.parent) if (!o.visible) return false;
    return true;
  };
  const xf = (m, p, w) => {
    const e = m.elements;
    return [e[0] * p[0] + e[4] * p[1] + e[8] * p[2] + w * e[12], e[1] * p[0] + e[5] * p[1] + e[9] * p[2] + w * e[13], e[2] * p[0] + e[6] * p[1] + e[10] * p[2] + w * e[14]];
  };
  const unit = (v) => {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  const line = (a, b) => Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
  for (const root of roots) {
    root.traverse((o) => {
      const h = o.userData?.held;
      const hand = o.parent;
      if (!h?.palm || !hand?.isObject3D || !shown(o)) return;
      const palm = xf(hand.matrixWorld, h.palm, 1);
      const grip = xf(o.matrixWorld, h.grip ?? [0, 0, 0], 1);
      const axis = unit(xf(o.matrixWorld, [0, 1, 0], 0));
      const want = unit(xf(hand.matrixWorld, h.line ?? [0, 1, 0], 0));
      let top = hand;
      while (top.parent?.isBone) top = top.parent;
      const arm = hand.parent?.parent?.isBone ? hand.parent.parent.quaternion : null;
      const hp = top.matrixWorld.elements;
      out.push({ id: o.uuid, kind: h.kind, carry: h.carry ?? {}, grip: Math.hypot(grip[0] - palm[0], grip[1] - palm[1], grip[2] - palm[2]), axis: line(axis, want), up: Math.acos(Math.max(-1, Math.min(1, axis[0] * upAxis[0] + axis[1] * upAxis[1] + axis[2] * upAxis[2]))), arm: arm ? [arm.x, arm.y, arm.z, arm.w] : null, hips: [hp[12], hp[14]] });
    });
  }
  return out;
}

// in the page: a frame's samples, once a frame, of the scenes anim-check's
// own half lists (window.__threeScenes); `moving` from the hips' speed
function heldPage(lib, moving) {
  const G = globalThis;
  let run = null;
  const tick = (t) => {
    if (run) {
      const dt = run.at == null ? 0 : Math.min(0.1, (t - run.at) / 1000);
      run.at = t;
      const roots = (G.__threeScenes ?? []).map((e) => e.scene.deref()).filter(Boolean);
      for (const s of lib.sampleHeld(roots)) {
        const last = run.hips.get(s.id);
        s.moving = Boolean(last && dt > 0 && Math.hypot(s.hips[0] - last[0], s.hips[1] - last[1]) / dt > moving);
        run.hips.set(s.id, s.hips);
        run.samples.push(s);
      }
    }
    G.requestAnimationFrame?.(tick);
  };
  G.requestAnimationFrame?.(tick);
  G.__animHeld = {
    start() {
      run = { at: null, hips: new Map(), samples: [] };
    },
    stop() {
      const out = run?.samples ?? [];
      run = null;
      return out;
    },
  };
}

export const heldPageScript = () => `(() => {\nconst sampleHeld = ${sampleHeld};\n(${heldPage})({ sampleHeld }, ${MOVING});\n})();`;

// ── the talkers, from Node ──

export async function talkCheck(page, { off = 1.5 } = {}) {
  const talkers = await page.evaluate(() => (typeof window.__talkers === 'function' && typeof window.__teleport === 'function' ? window.__talkers().map((t) => ({ id: t.id, name: t.name ?? t.id, x: t.x, z: t.z, y: t.y ?? null })) : null));
  if (!talkers) return { skipped: 'the route names no talkers (window.__talkers and window.__teleport)' };
  const out = [];
  for (const t of talkers) {
    const prompts = await page.evaluate(
      async ({ t, off }) => {
        const frame = () => new Promise((r) => window.requestAnimationFrame(r));
        // beside them, facing them (from the side the world's origin is on, so not in a wall)
        const d = Math.hypot(t.x, t.z) || 1;
        window.__teleport(t.x - (t.x / d) * off, t.z - (t.z / d) * off, { face: { x: t.x, z: t.z } });
        for (let i = 0; i < 20; i++) await frame();
        return [...document.querySelectorAll('[data-prompt]')].map((e) => e.getAttribute('data-prompt'));
      },
      { t, off },
    );
    const read = promptFor(prompts, t.name);
    const press = keyOf(read.prompt) ?? { key: 'e', code: 'KeyE' };
    const frames = await page.evaluate(
      async ({ t, within, press }) => {
        const frame = () => new Promise((r) => window.requestAnimationFrame(r));
        const key = (type) => window.dispatchEvent(new KeyboardEvent(type, { code: press.code, key: press.key, bubbles: true }));
        key('keydown');
        await frame();
        key('keyup');
        const me = () => window.__talkers().find((x) => x.id === t.id);
        const frames = [];
        let world = 0;
        let last = performance.now();
        const until = last + 30000;
        while (world <= within && performance.now() < until) {
          await frame();
          const now = performance.now();
          world += Math.min(0.1, (now - last) / 1000);
          last = now;
          const p = me();
          const upper = p?.upper?.() ?? p?.anim?.playing?.('upper') ?? null;
          const look = Boolean(p?.looking?.());
          frames.push({ t: world, upper, look });
        }
        return frames;
      },
      { t, within: TALK_WITHIN, press },
    );
    out.push({ id: t.id, name: t.name, ...talkVerdict({ prompt: read.prompt, frames }), prompt: read.prompt, theirs: read.theirs, prompts: read.of, key: press.code });
  }
  return { talkers: out };
}
