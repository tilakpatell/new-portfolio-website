import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { figuresLoader, flush } from './figures.fixture';
import { createTownsfolk } from './townsfolk';
import { HIDES } from './mortytown';

const made = async () => {
  const parent = new THREE.Group();
  const folk = await createTownsfolk({ parent, tier: 'low', loader: figuresLoader() });
  return { folk, parent };
};
const clock = (folk) => {
  let t = 0;
  let n = 0;
  const cam = new THREE.Vector3(0, 6, 10);
  return async (state, s) => {
    const end = t + s - 1e-9;
    while (t < end) {
      t += 1 / 30;
      folk.update(typeof state === 'function' ? state(t) : state, t, cam);
      // (a library clip asked for is fetched by the next few frames)
      if (++n % 5 === 0) await flush();
    }
    return t;
  };
};
const hide = HIDES[0];
const loco = (o = {}) => ({ id: 'loco-a', hide: hide.id, x: hide.x, z: hide.z, face: hide.face, speed: 0, state: 'hiding', order: -1, ...o });
const street = (o = {}) => ({ rick: { x: -52, z: 0, face: 0, speed: 0 }, locos: [loco()], ...o });
const figureOf = (folk, id) => folk.movers.find((f) => f.kind === id);

describe('Mortytown’s people on their animators', () => {
  it('crouches a Loco in his alley, and stands him up with a fright when he’s found', async () => {
    const { folk } = await made();
    const run = clock(folk);
    await run(street(), 0.6);
    const f = figureOf(folk, 'loco-a');
    expect(f.group.visible).toBe(true);
    expect(f.anim.playing('upper')).toBe(null);
    expect(f.atBase).toBe('crouch');
    await run(street({ rick: { x: hide.x, z: hide.z + 2, face: 0, speed: 0 }, locos: [loco({ state: 'following' })] }), 0.3);
    expect(f.atBase).toBe(null);
    expect(f.anim.playing('upper')).toBe('scared');
    folk.dispose();
  });

  it('walks a lost Loco home, never puts him there', async () => {
    const { folk } = await made();
    const run = clock(folk);
    // following, out on the street…
    const out = { x: hide.x, z: -8 };
    await run(street({ locos: [loco({ ...out, state: 'following' })] }), 0.2);
    const f = figureOf(folk, 'loco-a');
    expect(f.group.position.distanceTo(new THREE.Vector3(out.x, 0, out.z))).toBeLessThan(0.05);
    // …then lost: his rules put him home at once; he walks it
    let worst = 0;
    let last = f.group.position.clone();
    await run(() => {
      worst = Math.max(worst, f.group.position.distanceTo(last));
      last = f.group.position.clone();
      return street();
    }, 4);
    expect(worst).toBeLessThan(0.1);
    expect(f.group.position.distanceTo(new THREE.Vector3(out.x, 0, out.z))).toBeGreaterThan(3);
    await run(street(), 20);
    expect(f.group.position.distanceTo(new THREE.Vector3(hide.x, 0, hide.z))).toBeLessThan(0.05);
    expect(f.atBase).toBe('crouch');
    folk.dispose();
  }, 30000);

  it('turns the cast’s heads to Rick as he comes by, and a speaker talks with his hands', async () => {
    const { folk } = await made();
    const run = clock(folk);
    const big = figureOf(folk, 'bigmorty');
    await run(street(), 0.2);
    expect(big.lookAt).toBe(null);
    const near = street({ rick: { x: -19.2, z: -6.4, face: 0, speed: 0 }, saying: { id: 'town:bigmorty', line: 'You lost, Rick? Mortytown’s for Mortys.' } });
    await run(near, 0.5);
    expect(big.lookAt).not.toBe(null);
    expect(big.anim.playing('upper')).toBe('talk');
    // (sat on his stool all the while)
    expect(big.act.sit.getEffectiveWeight()).toBe(1);
    folk.dispose();
  });
});
