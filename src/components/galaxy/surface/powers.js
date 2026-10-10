// The 2017 heroes' Force powers on the galaxy's worlds, played: Vader's and
// Maul's choke, the Emperor's lightning (held) and chain lightning, Dooku's
// lightning stun and his exposed weakness, Luke's repulse and Anakin's and
// Chewie's slam, the rushes, and Vader's focused rage. The numbers and the
// rules are abilityRules.js's (the game's, from bf2017Abilities.json); this
// file draws them (a jagged arc for lightning, a ring for a repulse, a
// glow round a rage) and steps what lasts (a choke's grip, a rush's run, a
// held stream). scene.js hands it what it needs and calls cast() from G or V.
//
//   createPowers({ scene, fx, sounds, state, me, targets, on, isHero, dealt, emit, ground, reach })
//     → { cast(id, card, dir) → whether it played (false: not one of these kinds),
//         held(card, hold, dt, dir)   the held lightning, a frame (whether it streams),
//         play(kind)                  the hero's own clip for a kind, where its pack has one,
//         step(dt)                    what lasts, a frame,
//         soaked(n) → n               a hit on you through a rage,
//         busy()                      a rush or a choke under way (no stroke, no other power),
//         debug()                     what lasts, for the QA scripts,
//         dispose() }
//
//   targets()   the ones a power may land on ({ holder, hp, down, spec, fig, ground? })
//   on(t)       the system that owns t (activity.js or the ground war): hit, knock, stagger
//   isHero(t)   whether t takes the game's damage to a hero (a duellist, a named one)
//   dealt(n)    your perks on a hit

import * as THREE from 'three';
import { CHOKE, LIGHTNING, RUSH, accrue, chainFrom, clipFor, forceOf, hitOf, holdVy, jetStep, kindOf, knockSpeed, pickOne, rushHits, soak } from './abilityRules';
import { pushVelocity } from './combatRules';

const V = THREE.Vector3;
const UP = new V(0, 1, 0);
const ARC_POINTS = 12;
const ARC_LIFE = 0.12; // (an arc is redrawn this often while it lasts: lightning flickers)

export function createPowers({ scene, fx, sounds, state, me, targets, on, isHero, dealt, emit, ground, reach }) {
  const own = [];
  const keep = (x) => (own.push(x), x);
  // ── the arcs: a few jagged lines, additive, laid fresh as they flicker ──
  const arcMat = keep(new THREE.LineBasicMaterial({ color: '#c9d6ff', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  const arcCore = keep(new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  const arcs = Array.from({ length: 12 }, (_, i) => {
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ARC_POINTS * 3), 3));
    const line = new THREE.Line(g, i % 3 === 0 ? arcCore : arcMat);
    line.frustumCulled = false;
    line.visible = false;
    scene.add(line);
    return { line, from: new V(), to: new V(), until: 0, redraw: 0 };
  });
  let arcAt = 0;
  function lay(a) {
    const pos = a.line.geometry.attributes.position;
    const span = a.from.distanceTo(a.to);
    const jag = Math.min(0.6, 0.08 + span * 0.05);
    for (let i = 0; i < ARC_POINTS; i++) {
      const k = i / (ARC_POINTS - 1);
      const end = i === 0 || i === ARC_POINTS - 1;
      pos.setXYZ(
        i,
        a.from.x + (a.to.x - a.from.x) * k + (end ? 0 : (Math.random() - 0.5) * jag),
        a.from.y + (a.to.y - a.from.y) * k + (end ? 0 : (Math.random() - 0.5) * jag),
        a.from.z + (a.to.z - a.from.z) * k + (end ? 0 : (Math.random() - 0.5) * jag),
      );
    }
    pos.needsUpdate = true;
  }
  // an arc from → to for `life` seconds (three strands, one of them white)
  function arc(from, to, life) {
    for (let s = 0; s < 3; s++) {
      const a = arcs[arcAt++ % arcs.length];
      a.from.copy(from);
      a.to.copy(to);
      a.until = state.t + life;
      a.redraw = 0;
      a.line.visible = true;
      lay(a);
    }
  }
  // ── the ring: a repulse's wave out over the ground ──
  const ringMat = keep(new THREE.MeshBasicMaterial({ color: '#c8d8ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  const ring = new THREE.Mesh(keep(new THREE.RingGeometry(0.85, 1, 48, 1).rotateX(-Math.PI / 2)), ringMat);
  ring.visible = false;
  scene.add(ring);
  let wave = null; // { t0, at, range, color }
  // ── the glow: a rage's red about you ──
  const glowMat = keep(new THREE.MeshBasicMaterial({ color: '#ff2a1a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  const glow = new THREE.Mesh(keep(new THREE.SphereGeometry(1, 16, 12)), glowMat);
  glow.scale.set(0.7, 1.15, 0.7);
  glow.visible = false;
  scene.add(glow);

  const hand = (p) => new V(p.st.x + Math.sin(p.st.yaw) * 0.45, p.st.y + 1.35, p.st.z + Math.cos(p.st.yaw) * 0.45);
  const chest = (t) => {
    const q = t.holder.position;
    return new V(q.x, q.y + (t.fig?.tall ?? 1.7) * (t.spec?.scale ?? 1) * 0.62, q.z);
  };
  const flat = (t) => ({ x: t.holder.position.x, z: t.holder.position.z, t });
  const live = () => targets().filter((t) => !t.down && t.holder);
  const hitOne = (t, card, n = hitOf(card, isHero(t)), opts = {}) => {
    if (!n) return;
    const was = t.hp;
    on(t).hit(t, dealt(n), opts);
    emit({ type: 'hit', kill: was > 0 && t.hp <= 0 });
  };
  // the hero's own clip for a kind, where its pack has one
  function play(kind, opts = {}) {
    const fig = me().fig;
    if (!fig?.play) return null;
    const name = clipFor(kind, (n) => Boolean(fig.clips?.[n]));
    if (!name) return null;
    fig.play(name, { layer: 'full', ...opts }).catch(() => {});
    return name;
  }
  const faceTo = (dir) => {
    me().st.yaw = Math.atan2(dir.x, dir.z);
  };

  let choke = null; // { t, card, until, acc, lifted }
  let rush = null; // { t0, from, to, dur, card, hits }
  let stream = null; // { acc: Map, next, clip }

  function cast(id, card, dir) {
    const kind = kindOf(id);
    const p = me();
    faceTo(dir);
    const from = hand(p);
    if (kind === 'repulse') {
      // all round: everyone near thrown back from you, hurt by the game's numbers
      const f = { ...forceOf(card), cone: Math.PI, force: knockSpeed(card.knock ?? 3) };
      let any = 0;
      for (const t of live()) {
        const q = t.holder.position;
        const d = Math.hypot(q.x - p.st.x, q.z - p.st.z);
        if (d > f.range) continue;
        any++;
        const k = 1 - (d / f.range) * 0.5;
        on(t).knock(t, pushVelocity(p.st, { x: q.x, z: q.z }, k, 'push', f));
        hitOne(t, card);
      }
      wave = { t0: state.t, at: new V(p.st.x, p.st.y + 0.08, p.st.z), range: f.range };
      for (let i = 0; i < 16; i++) {
        const an = (i / 16) * Math.PI * 2;
        fx.sparks(new V(p.st.x + Math.sin(an) * 1.2, p.st.y + 0.4, p.st.z + Math.cos(an) * 1.2), new V(Math.sin(an), 0.25, Math.cos(an)), '#c8d8ff', 3);
      }
      play('repulse');
      sounds.combat?.('force');
      state.shake = Math.min(1, state.shake + 0.4);
      if (any) state.hitstop = Math.max(state.hitstop, 0.06);
      return true;
    }
    if (kind === 'choke') {
      const t = pickOne(p.st, live().map(flat), card)?.t;
      if (!t) return whiff(from, dir, card);
      choke = { t, card, until: state.t + (card.grip ?? card.dur ?? 1), acc: 0, lifted: !t.ground };
      on(t).stagger(t, card.grip ?? 1);
      play('choke', { hold: true });
      sounds.combat?.('force');
      return true;
    }
    if (kind === 'electrocute') {
      // a burst into everyone in the cone: hurt, and shaking where they stand
      let any = 0;
      for (const { t } of live().map(flat).filter((x) => pickOne(p.st, [x], card))) {
        any++;
        hitOne(t, card);
        on(t).stagger(t, card.stun ?? 1);
        arc(from, chest(t), 0.45);
      }
      if (!any) whiff(from, dir, card);
      play('electrocute');
      sounds.combat?.('force');
      state.shake = Math.min(1, state.shake + 0.2);
      return true;
    }
    if (kind === 'chainLightning') {
      const chain = chainFrom(p.st, live().map(flat), card).map((x) => x.t);
      if (!chain.length) whiff(from, dir, card);
      let prev = from;
      for (const t of chain) {
        const c = chest(t);
        arc(prev, c, 0.4);
        hitOne(t, card);
        on(t).stagger(t, 0.6);
        fx.sparks(c, UP, '#c9d6ff', 6);
        prev = c;
      }
      play('chainLightning');
      sounds.combat?.('force');
      state.shake = Math.min(1, state.shake + 0.25);
      return true;
    }
    if (kind === 'weaken') {
      // those in front take the game's more from every stroke, for its while
      const f = { range: card.range ?? card.reach ?? 10, cone: card.cone ?? 0.75 };
      for (const { t } of live().map(flat).filter((x) => pickOne(p.st, [x], f))) {
        t.weakUntil = state.t + (card.dur ?? 5);
        t.weak = card.taken ?? 1.2;
        fx.sparks(chest(t), UP, '#b36aff', 8);
      }
      play('weaken');
      sounds.combat?.('perfect');
      return true;
    }
    if (kind === 'rage') {
      state.rage = { until: state.t + (card.dur ?? 10), taken: card.taken ?? 1, shield: card.shield ?? 0 };
      fx.flash(new V(p.st.x, p.st.y + 1, p.st.z), UP, { color: '#ff3b2a', size: 1.6 });
      play('rage');
      sounds.combat?.('perfect');
      state.shake = Math.min(1, state.shake + 0.3);
      return true;
    }
    if (kind === 'rush') {
      const flatDir = new V(dir.x, 0, dir.z).normalize();
      const to = new V(p.st.x, 0, p.st.z).addScaledVector(flatDir, RUSH.dist);
      // (never past the world's edge)
      const r = Math.hypot(to.x, to.z);
      if (r > reach - 1) to.multiplyScalar((reach - 1) / r);
      rush = { t0: state.t, from: new V(p.st.x, 0, p.st.z), to, dur: RUSH.dur, card, hits: new Set() };
      play('rush', { speed: 1.2 });
      sounds.combat?.('dodge');
      return true;
    }
    return false;
  }

  // a power with nobody in reach: a flicker into the air, the wait spent all the same
  function whiff(from, dir, card) {
    if (card.kind !== 'choke') arc(from, from.clone().addScaledVector(dir, (card.range ?? 8) * 0.6), 0.2);
    return true;
  }

  // the held lightning, one frame: off its tank, a hit every LIGHTNING.every
  // into the nearest in the cone, an arc to them (or into the air)
  function held(card, hold, dt, dir) {
    jetStep(state.jet, { hold, grounded: true, dt }, LIGHTNING);
    if (!state.jet.on) {
      if (stream?.clip) me().fig?.stop?.('full', 0.2);
      stream = null;
      return false;
    }
    const p = me();
    faceTo(dir);
    stream ??= { acc: new Map(), next: state.t, clip: play('lightning', { loop: true }) };
    const t = pickOne(p.st, live().map(flat), card)?.t ?? null;
    const from = hand(p);
    const to = t ? chest(t) : from.clone().addScaledVector(dir, (card.range ?? 10) * 0.7).add(new V((Math.random() - 0.5) * 2, (Math.random() - 0.5), (Math.random() - 0.5) * 2));
    if (state.t >= stream.next) {
      stream.next = state.t + LIGHTNING.every;
      arc(from, to, LIGHTNING.every * 1.2);
      if (t) {
        const r = accrue(stream.acc.get(t) ?? 0, card.tick ?? 0.2);
        stream.acc.set(t, r.acc);
        if (r.deal) hitOne(t, card, r.deal);
        on(t).stagger(t, 0.35);
        fx.sparks(to, UP, '#c9d6ff', 3);
      }
    }
    state.aim = 1;
    state.saberAt = state.t;
    if (Math.random() < dt * 8) sounds.combat?.('force');
    return true;
  }

  function step(dt) {
    // the arcs flicker, then go
    for (const a of arcs) {
      if (!a.line.visible) continue;
      if (state.t >= a.until) {
        a.line.visible = false;
        continue;
      }
      a.redraw -= dt;
      if (a.redraw <= 0) {
        a.redraw = ARC_LIFE * (0.5 + Math.random());
        lay(a);
      }
    }
    // the repulse's ring, out to its range and fading
    if (wave) {
      const k = (state.t - wave.t0) / 0.45;
      if (k >= 1) {
        wave = null;
        ring.visible = false;
      } else {
        ring.visible = true;
        ring.position.copy(wave.at);
        ring.scale.setScalar(0.5 + wave.range * k);
        ringMat.opacity = 0.7 * (1 - k);
      }
    }
    // the rage's glow while it lasts
    const raging = state.rage && state.t < state.rage.until;
    glow.visible = Boolean(raging);
    if (raging) {
      const p = me().st;
      glow.position.set(p.x, p.y + 1, p.z);
      glowMat.opacity = 0.08 + 0.05 * Math.sin(state.t * 9) + (state.rage.shield > 0 ? 0.05 : 0);
    } else if (state.rage) state.rage = null;
    // the choke: held up, hurt by the second, till the grip's time is out
    if (choke) {
      const { t, card } = choke;
      if (t.down || state.t >= choke.until) {
        if (t.knock && choke.lifted) t.knock.vy = Math.min(t.knock.vy, 0);
        choke = null;
        me().fig?.stop?.('full', 0.25);
      } else {
        on(t).stagger(t, 0.3);
        if (choke.lifted) {
          if (!t.knock) on(t).knock(t, { vx: 0, vz: 0, vy: 0.1 });
          if (t.knock) {
            t.knock.vx = 0;
            t.knock.vz = 0;
            t.knock.vy = holdVy(t.knock.y, CHOKE.lift, dt);
          }
        }
        const r = accrue(choke.acc, (card.perSecond ?? 0) * dt);
        choke.acc = r.acc;
        if (r.deal) hitOne(t, card, r.deal);
        if (Math.random() < dt * 10) fx.sparks(chest(t).add(new V(0, 0.25, 0)), UP, '#9aa8c8', 1);
        state.aim = 1;
        state.saberAt = state.t;
      }
    }
    // the rush: along its line, through whoever's on it, eased at the end
    if (rush) {
      const p = me().st;
      const k = Math.min(1, (state.t - rush.t0) / rush.dur);
      const e = 1 - (1 - k) * (1 - k);
      const was = { x: p.x, z: p.z };
      p.x = rush.from.x + (rush.to.x - rush.from.x) * e;
      p.z = rush.from.z + (rush.to.z - rush.from.z) * e;
      p.y = ground(p.x, p.z, p.y + 1.5);
      p.vy = 0;
      const reachOf = Math.max(1.2, rush.card.reach ?? 1.5);
      for (const x of rushHits(was, p, live().map(flat), reachOf)) {
        if (rush.hits.has(x.t)) continue;
        rush.hits.add(x.t);
        hitOne(x.t, rush.card);
        on(x.t).knock(x.t, pushVelocity(p, { x: x.x, z: x.z }, 0.6, 'push', { force: 6, lift: 2 }));
        fx.sparks(chest(x.t), UP, me().spec.bolt ?? '#ffffff', 10);
        sounds.saber?.('clash');
      }
      if (Math.random() < dt * 30) fx.sparks(new V(p.x, p.y + 0.2, p.z), UP, '#d8d0c0', 2);
      if (k >= 1) rush = null;
    }
  }

  return {
    cast,
    held,
    play,
    step,
    soaked(n) {
      const r = soak(state.rage, n, state.t);
      if (state.rage) state.rage.shield = r.shield;
      return r.n;
    },
    busy: () => Boolean(rush || choke),
    // (for the QA scripts: what lasts, as it stands)
    debug: () => ({ choke: choke ? { kind: choke.t.spec?.kind ?? null, hp: choke.t.hp, y: +(choke.t.knock?.y ?? 0).toFixed(2), left: +(choke.until - state.t).toFixed(2) } : null, rush: Boolean(rush), rage: state.rage ? { left: +(state.rage.until - state.t).toFixed(1), shield: +state.rage.shield.toFixed(1) } : null, streaming: Boolean(stream) }),
    dispose() {
      for (const a of arcs) scene.remove(a.line);
      scene.remove(ring, glow);
      for (const x of own) x.dispose?.();
    },
  };
}
