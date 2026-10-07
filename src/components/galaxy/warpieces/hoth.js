// The Battle of Hoth's set pieces (The Empire Strikes Back):
// - Echo Base's ion cannon fires on Death Squadron: two great blue bolts
//   every twenty seconds or so, and the Star Destroyer they hit is disabled a
//   while (battle.js's disable: its guns quiet, its hull and objectives
//   open to it).
// - When it's the Empire attacking (the war's defence of Hoth), the GR-75
//   transports run from the base for the jump, one after another (Hoth's an
//   evacuation: battles.js's BATTLE_KINDS, the battle's own runners), and
//   the Empire's fighters go after them: this calls each one out, and the
//   evacuation done when enough are.
//
// createHoth(ctx) → { update(dt, t, live, events), hit, targets, markers(live), dispose() }

import * as THREE from 'three';
import { GCW, seeded } from '../gcw';

const REBELS = 0;
const EMPIRE = 1;
export const HOTH = {
  ionEvery: [16, 26], // seconds between the cannon's shots
  ionFor: 18, // seconds a Star Destroyer's disabled
  ionSpeed: 110,
};
const v = (x, y, z) => ({ x, y, z });

export function createHoth(ctx) {
  const { battle, sys } = ctx;
  const rand = seeded(`${ctx.on.id}-hoth`);
  const R = sys.body.r;
  const cannonPiece = sys.pieces.find((p) => p.type === 'cannon');
  const base = cannonPiece ? cannonPiece.from : [0, R, 0];
  const bl = Math.hypot(...base) || 1;
  const baseDir = v(base[0] / bl, base[1] / bl, base[2] / bl);
  const cannon = v(baseDir.x * (R + 0.6), baseDir.y * (R + 0.6), baseDir.z * (R + 0.6));

  // ── the ion cannon's bolts: two glowing slugs in flight ──
  const geo = new THREE.SphereGeometry(1, 12, 8);
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 2.4, 5), toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const slugs = [0, 1].map(() => {
    const m = new THREE.Mesh(geo, mat);
    m.visible = false;
    m.scale.set(0.9, 0.9, 4);
    ctx.scene?.add(m);
    return { m, on: false, from: v(0, 0, 0), target: null, t: 0, dur: 1 };
  });
  let nextIon = 6 + rand() * 6;
  let ions = 0;

  // ── the transports (the battle's runners) ──
  let out = 0;
  let done = false;

  const shootIon = () => {
    const foes = battle.capitals.filter((c) => c.team === EMPIRE && c.alive && c.dying <= 0 && c.disabled <= 0 && !c.gone);
    if (!foes.length) return;
    const flag = foes.find((c) => c.role === 'flagship');
    const target = flag && rand() < 0.4 ? flag : foes[Math.floor(rand() * foes.length)];
    slugs.forEach((s, k) => {
      s.on = true;
      s.from = v(cannon.x, cannon.y, cannon.z);
      s.target = target;
      s.t = -k * 0.3; // (the second a moment behind the first)
      const d = Math.hypot(target.pos.x - cannon.x, target.pos.y - cannon.y, target.pos.z - cannon.z);
      s.dur = d / HOTH.ionSpeed;
    });
    ctx.draw?.flash(cannon, { size: 6, life: 0.6, color: [1, 1.8, 3.4] });
    if (ions++ % 3 === 0) ctx.event('ion');
  };

  return {
    update(dt, t, live, events) {
      for (const e of events) {
        if (e.type === 'escaped' && e.kind === 'transport' && !done) {
          out += 1;
          ctx.event('escaped');
          if (ctx.tookPart()) ctx.points(1);
        } else if (e.type === 'over' && e.why === 'runners' && e.winner === REBELS && !done) {
          done = true;
          ctx.event('gcw-evacuated');
          if (ctx.tookPart()) ctx.points(GCW.points.objective);
        }
      }
      if (battle.over) return {};
      // the cannon
      nextIon -= dt;
      if (nextIon <= 0) {
        nextIon = HOTH.ionEvery[0] + rand() * (HOTH.ionEvery[1] - HOTH.ionEvery[0]);
        shootIon();
      }
      for (const s of slugs) {
        if (!s.on) continue;
        s.t += dt;
        if (s.t < 0) continue;
        const k = Math.min(1, s.t / s.dur);
        const tp = s.target.pos;
        s.m.visible = true;
        s.m.position.set(s.from.x + (tp.x - s.from.x) * k, s.from.y + (tp.y - s.from.y) * k, s.from.z + (tp.z - s.from.z) * k);
        s.m.lookAt(tp.x, tp.y, tp.z);
        if (k >= 1) {
          s.on = false;
          s.m.visible = false;
          battle.disable(s.target.id, HOTH.ionFor);
          ctx.draw?.flash(tp, { size: 10, life: 1.1, color: [1, 1.8, 3.4] });
        }
      }
      return {};
    },
    hit: () => null,
    targets: [],
    markers(live) {
      if (!live) return [];
      return battle.runners.filter((r) => r.alive && r.kind === 'transport' && Math.hypot(r.pos.x - live.x, r.pos.y - live.y, r.pos.z - live.z) < 260).map((r) => ({ key: `gr75-${r.id}`, pos: r.pos, title: `${r.team === battle.you.team ? 'Protect' : 'Stop'}: transport ${battle.runners.indexOf(r) + 1}`, hp: r.hp / r.hpMax, colour: '#7cc8ff' }));
    },
    get out() {
      return out;
    },
    dispose() {
      for (const s of slugs) s.m.removeFromParent();
      geo.dispose();
      mat.dispose();
    },
  };
}
