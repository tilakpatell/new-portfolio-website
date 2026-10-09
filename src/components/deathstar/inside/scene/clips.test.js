// Every clip the people, you and the scenes ask for is one the library has
// (lib/three/clipLibrary.js's CLIPS, or an ALIAS of figures.js's): a name
// it hasn't got plays nothing, and the figure stands frozen in its last pose.
import { describe, expect, it } from 'vitest';
import { CLIPS } from '../../../../lib/three/clipLibrary';
import { SCENES } from './cinematics';
import { ALIAS } from './figures';
import { playerAct } from './index';
import { actOf, fallClip, hitClip } from './people';

const known = (name) => name in CLIPS || name in ALIAS;
// every pose the rules give a person (brains.js's anims, duel.js's, the stories' scripted ones)
const ANIMS = ['idle', 'walk', 'run', 'aim', 'shoot', 'hit', 'die', 'kneel', 'talk', 'work', 'attention', 'sit', 'ground', 'lie', 'limp', 'strike', 'heavy', 'guard', 'cast', 'lightning'];
const MODES = ['routine', 'wary', 'fight', 'search', 'flee', 'down', 'scripted'];

describe('the clips asked for', () => {
  it('are all the library’s for every pose a person is given, in every mode, with a gun, a blade or neither', () => {
    const asked = new Set();
    for (const anim of ANIMS) {
      for (const mode of MODES) {
        for (const strokes of [0, 1, 2, 3, 4]) {
          for (const how of [{}, { blade: true }, { armed: false }]) {
            const a = actOf({ kind: 'stormtrooper', anim, mode, strokes, hp: 10 }, how);
            for (const n of [a.base, a.full, a.upper]) if (n) asked.add(n);
          }
        }
      }
    }
    for (let k = 0; k < 16; k++) {
      const yaw = (k / 16) * Math.PI * 2;
      const dir = { x: Math.sin(yaw), y: 0, z: -Math.cos(yaw) };
      asked.add(hitClip(dir, 0, false));
      asked.add(hitClip(dir, 0, true));
      asked.add(fallClip(dir, 0, `p${k}`));
      asked.add(fallClip(null, 0, `p${k}`));
    }
    expect([...asked].filter((n) => !known(n))).toEqual([]);
  });

  it('are all the library’s for everything you do, standing, crouched, armed or with a blade', () => {
    const asked = new Set();
    for (const crouch of [false, true]) {
      for (const moving of [false, true]) {
        for (const aim of [false, true]) {
          for (const [gun, blade] of [['e11', null], [null, 'green'], [null, null]]) {
            for (const shotAgo of [0, 9]) {
              const a = playerAct({ crouch, moving, aim, gun, blade, shotAgo, swungAgo: shotAgo });
              for (const n of [a.base, a.upper]) if (n && n !== 'stroke') asked.add(n);
            }
          }
        }
      }
    }
    expect([...asked].filter((n) => !known(n))).toEqual([]);
  });

  it('are all the library’s for every scene’s actors', () => {
    const asked = Object.values(SCENES).flatMap((s) => (s.acts ?? []).flatMap((a) => [a.play, a.base].filter(Boolean)));
    expect(asked.filter((n) => !known(n))).toEqual([]);
  });
});
