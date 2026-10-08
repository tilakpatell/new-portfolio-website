import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CLIPS, RICK_HIPS, borrowClips, faceAhead, faceForward, forFigure, heading, loadClip, preload, retarget } from './clipLibrary';
import { SHARED_CLIPS } from '../../components/rickmorty/portal/meshyCast';

const Y = new THREE.Vector3(0, 1, 0);
// a clip whose hips turn about y by `a` (radians), and a few other tracks a Meshy clip has
const clip = (a, name = 'idle') => {
  const q = new THREE.Quaternion().setFromAxisAngle(Y, a);
  return new THREE.AnimationClip(name, 1, [
    new THREE.QuaternionKeyframeTrack('Hips.quaternion', [0, 1], [...q.toArray(), ...q.toArray()]),
    new THREE.VectorKeyframeTrack('Hips.position', [0, 1], [0, 90, 1, 2, 88, 3]),
    new THREE.QuaternionKeyframeTrack('Spine.quaternion', [0], [0, 0, 0, 1]),
    new THREE.VectorKeyframeTrack('Spine.position', [0], [0, 10, 0]),
    new THREE.VectorKeyframeTrack('Hips.scale', [0], [1, 1, 1]),
  ]);
};
// a GLB's scene, with the hips standing `y` high
const sceneWithHips = (y) => {
  const hips = new THREE.Bone();
  hips.name = 'Hips';
  hips.position.y = y;
  const scene = new THREE.Group();
  scene.add(hips);
  return scene;
};
// a loader that hands out a clip per URL (turned `turns[url]` about y), counting its fetches
const fakeLoader = (turns = {}, hipsY = 93.3) => ({
  loadAsync: vi.fn(async (url) => ({ scene: sceneWithHips(hipsY), animations: [clip(turns[url] ?? 0, url)] })),
});

describe('borrowing Rick’s clips', () => {
  it('keeps the bones’ turns and scales only the hips’ height to the figure’s', () => {
    const c = clip(0.3);
    const r = retarget(c, RICK_HIPS * 2);
    expect(r.tracks.map((t) => t.name)).toEqual(['Hips.quaternion', 'Hips.position', 'Spine.quaternion']);
    expect([...r.tracks[1].values]).toEqual([0, 180, 2, 4, 176, 6]);
    expect([...c.tracks[1].values]).toEqual([0, 90, 1, 2, 88, 3]); // (Rick’s own left as it was: it’s shared)
    expect(r.duration).toBe(1);
    expect(retarget(null, 90)).toBeNull();
  });

  it('scales from the hips the clip was made on, where it says', () => {
    const r = retarget(clip(0), 100, 50);
    expect(r.tracks[1].values[1]).toBe(180);
  });

  it('turns a clip’s hips so it faces where the walk does', () => {
    const idle = clip(0.9);
    expect(heading(idle, Y)).toBeCloseTo(0.9, 5);
    faceForward(idle, Y, -0.2);
    expect(heading(idle, Y)).toBeCloseTo(-0.2, 5);
    const clips = { idle: clip(1.1), walk: clip(0.25, 'walk'), run: clip(-0.4, 'run'), sit: null };
    faceAhead(clips, Y);
    for (const n of ['idle', 'walk', 'run']) expect(heading(clips[n], Y), n).toBeCloseTo(0.25, 5);
    expect(heading(new THREE.AnimationClip('x', 1, []), Y)).toBeNull();
  });

  it('fetches each of Rick’s clips once, whoever borrows it, noting the hips it was made on', async () => {
    const loader = fakeLoader();
    const a = await borrowClips(['jump', 'crawl'], { loader });
    const b = await borrowClips(['crawl'], { loader });
    expect(loader.loadAsync.mock.calls.map(([u]) => u)).toEqual(['/games/meshy/rick-jump.glb', '/games/meshy/rick-crawl.glb']);
    expect(b.crawl).toBe(a.crawl);
    expect(a.jump.userData.hips).toBe(93.3);
    const none = { loadAsync: vi.fn(async () => Promise.reject(new Error('404'))) };
    expect((await borrowClips(['swim'], { loader: none })).swim).toBeNull();
  });
});

describe('the clip library', () => {
  it('names every shared clip meshyCast plays, Rick’s four and the troopers’', () => {
    expect(SHARED_CLIPS.every((n) => CLIPS[n]?.url === `/games/meshy/clips-${n}.glb`)).toBe(true);
    for (const n of ['idle', 'walk', 'run', 'sit']) expect(CLIPS[n].url).toBe(`/games/meshy/rick-${n}.glb`);
    for (const n of ['die.back', 'die.fwd', 'die.blown', 'kneel', 'taunt.trooper', 'hit.trooper']) expect(CLIPS[n].url, n).toMatch(/^\/models\/galaxy\/troops\/clip-\w+\.glb$/);
  });

  it('has a file on disk for every clip it names', () => {
    for (const [n, c] of Object.entries(CLIPS)) expect(existsSync(`public${c.url}`), n).toBe(true);
  });

  it('loadClip fetches once and keeps the hips height', async () => {
    const loader = fakeLoader();
    const [a, b] = await Promise.all([loadClip('wave', { loader }), loadClip('wave', { loader })]);
    const c = await loadClip('wave', { loader });
    expect(loader.loadAsync.mock.calls.map(([u]) => u)).toEqual(['/games/meshy/clips-wave.glb']);
    expect(a).toBe(b);
    expect(c).toBe(a);
    expect(a.userData.hips).toBe(93.3);
    expect(await loadClip('no.such.clip', { loader })).toBeNull();
    // Rick’s own, fetched once whether borrowed or loaded by name
    const idle = await loadClip('idle', { loader });
    expect((await borrowClips(['idle'], { loader })).idle).toBe(idle);
    expect(loader.loadAsync.mock.calls.filter(([u]) => u === '/games/meshy/rick-idle.glb')).toHaveLength(1);
    // a file that won't load is null, not a throw
    const none = { loadAsync: vi.fn(async () => Promise.reject(new Error('404'))) };
    expect(await loadClip('cheer', { loader: none })).toBeNull();
  });

  it('takes a clip by name from a file that carries several, and the hips the entry says', async () => {
    const two = { scene: sceneWithHips(80), animations: [clip(0, 'A'), clip(0, 'B')] };
    const loader = { loadAsync: vi.fn(async () => two) };
    CLIPS['test.b'] = { url: '/test/two.glb', take: 'B' };
    CLIPS['test.a'] = { url: '/test/two.glb', take: 'A', hips: 70 };
    try {
      const [b, a] = await Promise.all([loadClip('test.b', { loader }), loadClip('test.a', { loader })]);
      expect(b.name).toBe('B');
      expect(b.userData.hips).toBe(80);
      expect(a.name).toBe('A');
      expect(a.userData.hips).toBe(70);
      expect(loader.loadAsync).toHaveBeenCalledTimes(1);
    } finally {
      delete CLIPS['test.b'];
      delete CLIPS['test.a'];
    }
  });

  it('forFigure scales the hips to the figure and caches per key', async () => {
    const loader = fakeLoader({ '/games/meshy/clips-cheer.glb': 1.1, '/games/meshy/rick-walk.glb': 0.25 }, 90);
    const tall = await forFigure('cheer', { hipsY: 180, up: Y, key: 'tall', loader });
    expect([...tall.tracks.find((t) => t.name === 'Hips.position').values]).toEqual([0, 180, 2, 4, 176, 6]);
    expect(tall.tracks.some((t) => t.name === 'Spine.position')).toBe(false);
    expect(heading(tall, Y)).toBeCloseTo(0.25, 5); // (turned to where the walk faces)
    const lib = await loadClip('cheer', { loader });
    expect(heading(lib, Y)).toBeCloseTo(1.1, 5); // (the library’s own left as it was)
    expect(lib.tracks.find((t) => t.name === 'Hips.position').values[1]).toBe(90);
    // the same template gets the same copy; another gets its own
    expect(await forFigure('cheer', { hipsY: 180, up: Y, key: 'tall', loader })).toBe(tall);
    const short = await forFigure('cheer', { hipsY: 45, up: Y, key: 'short', loader });
    expect(short).not.toBe(tall);
    expect(short.tracks.find((t) => t.name === 'Hips.position').values[1]).toBe(45);
    // faced where a figure says its own walk faces
    expect(heading(await forFigure('cheer', { hipsY: 90, up: Y, key: 'own', ahead: -0.5, loader }), Y)).toBeCloseTo(-0.5, 5);
    expect(await forFigure('no.such.clip', { hipsY: 90, up: Y, key: 'tall', loader })).toBeNull();
  });

  it('preload fetches every clip a world names, once', async () => {
    const loader = fakeLoader();
    expect(await preload(['drink', 'happy', 'drink'], { loader })).toBeUndefined();
    expect(loader.loadAsync.mock.calls.map(([u]) => u).sort()).toEqual(['/games/meshy/clips-drink.glb', '/games/meshy/clips-happy.glb']);
    await loadClip('happy', { loader });
    expect(loader.loadAsync).toHaveBeenCalledTimes(2);
  });
});

describe('Quaternius’s clips, baked', () => {
  // UAL's clip → ours (scripts/ual-bake.mjs's `life` set)
  const UAL = {
    Idle_Talking_Loop: 'talk',
    Sitting_Enter: 'sit.enter',
    Sitting_Idle_Loop: 'sit.idle',
    Sitting_Talking_Loop: 'sit.talk',
    Sitting_Exit: 'sit.exit',
    Crouch_Idle_Loop: 'crouch',
    Crouch_Fwd_Loop: 'crouch.walk',
    Interact: 'interact',
    PickUp_Table: 'pickup',
    Fixing_Kneeling: 'kneel.fix',
    Hit_Chest: 'hit.chest',
    Hit_Head: 'hit.head',
    Death01: 'die',
    Pistol_Aim_Neutral: 'aim.pistol',
    Pistol_Aim_Up: 'aim.pistol.up',
    Pistol_Aim_Down: 'aim.pistol.down',
    Pistol_Shoot: 'shoot.pistol',
    Pistol_Reload: 'reload',
    Punch_Jab: 'jab',
    Punch_Cross: 'cross',
    Roll: 'roll',
    Jump_Start: 'jump.start',
    Jump_Loop: 'jump.loop',
    Jump_Land: 'jump.land',
    Push_Loop: 'push',
    Spell_Simple_Enter: 'cast.enter',
    Spell_Simple_Idle_Loop: 'cast.idle',
    Spell_Simple_Shoot: 'cast',
    Sprint_Loop: 'sprint',
    Walk_Formal_Loop: 'walk.formal',
    Idle_Torch_Loop: 'torch',
    Dance_Loop: 'dance.ual',
    Swim_Fwd_Loop: 'swim',
    Swim_Idle_Loop: 'swim.idle',
    Driving_Loop: 'drive',
    Idle_Loop: 'idle.calm',
    // (the paid packs': `--set pro`, `--set ual2`)
    Jog_Fwd_Loop: 'jog',
    Jog_Bwd_Loop: 'jog.back',
    Jog_Left_Loop: 'jog.left',
    Jog_Right_Loop: 'jog.right',
    Jog_Fwd_L_Loop: 'jog.fwd.left',
    Jog_Fwd_R_Loop: 'jog.fwd.right',
    Jog_Bwd_L_Loop: 'jog.back.left',
    Jog_Bwd_R_Loop: 'jog.back.right',
    Crouch_Fwd_L_Loop: 'crouch.fwd.left',
    Crouch_Fwd_R_Loop: 'crouch.fwd.right',
    Hit_Shoulder_L: 'hit.shoulder.l',
    Hit_Shoulder_R: 'hit.shoulder.r',
    Hit_Stomach: 'hit.stomach',
    Death02: 'die.2',
    Idle_Tired_Loop: 'tired',
    Sitting_Idle02_Loop: 'sit.idle2',
    Sitting_Idle03_Loop: 'sit.idle3',
    Sitting_Nodding_Loop: 'sit.nod',
    GroundSit_Enter: 'sit.ground.enter',
    GroundSit_Idle_Loop: 'sit.ground',
    GroundSit_Exit: 'sit.ground.exit',
    Crawl_Fwd_Loop: 'crawl',
    Crawl_Idle_Loop: 'crawl.idle',
    Counter_Idle_Loop: 'counter.idle',
    Counter_Give: 'counter.give',
    Counter_Show: 'counter.show',
    Counter_Angry: 'counter.angry',
    Celebration: 'celebrate',
    Crying: 'cry',
    PickUp_Kneeling: 'pickup.kneel',
    BackFlip: 'backflip',
    Spell_Double_Enter: 'cast.double.enter',
    Spell_Double_Shoot_Loop: 'cast.double',
    Walk_L_Loop: 'walk.left',
    Walk_R_Loop: 'walk.right',
    Walk_Fwd_L_Loop: 'walk.fwd.left',
    Walk_Fwd_R_Loop: 'walk.fwd.right',
    Walk_Bwd_L_Loop: 'walk.back.left',
    Walk_Bwd_R_Loop: 'walk.back.right',
    Idle_FoldArms_Loop: 'arms.folded',
    Yes: 'nod',
    Idle_No_Loop: 'shake',
    Surprise: 'surprise',
    Consume: 'eat',
    Bandage_Loop: 'bandage',
    Hit_Knockback: 'hit.knock',
    KipUp: 'kipup',
    IdleToLay: 'lie.down',
    LayToIdle: 'lie.up',
    Melee_Combo: 'melee.combo',
    Melee_Hook: 'melee.hook',
    Melee_Knee: 'melee.knee',
    OverhandThrow: 'throw',
    Mining_Loop: 'mine',
    TreeChopping_Loop: 'chop',
    Idle_Lantern_Loop: 'lantern',
    Idle_Rail_Loop: 'lean.rail',
    Chest_Open: 'open.chest',
    LiftAir_Idle_Loop: 'lifted',
    LiftAir_Fall: 'lifted.fall',
    LiftAir_Fall_Impact: 'lifted.land',
    Zombie_Idle_Loop: 'zombie.idle',
    Zombie_Walk_Fwd_Loop: 'zombie.walk',
    Zombie_Bite: 'zombie.bite',
    Zombie_Scratch: 'zombie.scratch',
    Farm_Harvest: 'farm.harvest',
    Farm_Watering: 'farm.water',
    Farm_PlantSeed: 'farm.plant',
    Fish_Cast: 'fish.cast',
    Fish_Cast_Idle_Loop: 'fish.idle',
    Fish_Reel: 'fish.reel',
    Turn180_L: 'turn.around',
    Sword_Regular_A: 'sword.a',
    Sword_Regular_A_Rec: 'sword.a.rec',
    Sword_Regular_B: 'sword.b',
    Sword_Regular_B_Rec: 'sword.b.rec',
    Sword_Regular_C: 'sword.c',
    Sword_Regular_Combo: 'sword.combo',
    Sword_Light_A: 'sword.light.a',
    Sword_Light_A_Rec: 'sword.light.a.rec',
    Sword_Light_B: 'sword.light.b',
    Sword_Light_B_Rec: 'sword.light.b.rec',
    Sword_Light_C: 'sword.light.c',
    Sword_Light_C_Rec: 'sword.light.c.rec',
    Sword_Light_D: 'sword.light.d',
    Sword_Light_Combo: 'sword.light.combo',
    Sword_Heavy_A: 'sword.heavy.a',
    Sword_Heavy_A_Rec: 'sword.heavy.a.rec',
    Sword_Heavy_B: 'sword.heavy.b',
    Sword_Heavy_B_Rec: 'sword.heavy.b.rec',
    Sword_Heavy_C: 'sword.heavy.c',
    Sword_Heavy_C_Rec: 'sword.heavy.c.rec',
    Sword_Heavy_D: 'sword.heavy.d',
    Sword_Heavy_Combo: 'sword.heavy.combo',
    Sword_Aerial_A: 'sword.aerial.a',
    Sword_Aerial_A_Rec: 'sword.aerial.a.rec',
    Sword_Aerial_B: 'sword.aerial.b',
    Sword_Aerial_Combo_Loop: 'sword.aerial.combo',
    Sword_Aerial_Idle_Loop: 'sword.aerial.idle',
    Sword_Block: 'sword.block',
    Sword_Dash: 'sword.dash',
    Sword_GroundPound: 'sword.pound',
    Sword_UpperCut: 'sword.uppercut',
  };
  const ual = Object.entries(CLIPS).filter(([, c]) => c.url.startsWith('/games/meshy/ual-') && !c.alias);
  // a GLB's JSON chunk
  const glbJson = (buf) => JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'));

  it('names every clip the bake makes, each in its own file, looping where UAL’s does', () => {
    expect(ual.map(([n]) => n).sort()).toEqual(Object.values(UAL).sort());
    for (const [from, n] of Object.entries(UAL)) {
      expect(CLIPS[n].url, n).toBe(`/games/meshy/ual-${n}.glb`);
      expect(CLIPS[n].loop === true, n).toBe(from.endsWith('_Loop'));
    }
  });

  it('has every UAL clip’s file, the whole body in it, and the hips it was made on', () => {
    for (const [n, c] of ual) {
      expect(existsSync(`public${c.url}`), n).toBe(true);
      const json = glbJson(readFileSync(`public${c.url}`));
      expect(json.animations, n).toHaveLength(1);
      const [anim] = json.animations;
      const moved = new Set(anim.channels.map((ch) => json.nodes[ch.target.node].name));
      for (const b of ['Hips', 'Spine02', 'Head', 'LeftArm', 'RightHand', 'LeftToeBase']) expect(moved.has(b), `${n} ${b}`).toBe(true);
      // (loadClip reads the hips off the Hips node: the same height the bake says)
      expect(anim.extras.hips, n).toBeCloseTo(json.nodes.find((o) => o.name === 'Hips').translation[1], 3);
    }
  });

  it('gives every stroke a contact window inside its clip and the root’s travel from where it starts', () => {
    const strokes = ual.filter(([n]) => n.startsWith('sword.'));
    expect(strokes).toHaveLength(31);
    for (const [n, c] of strokes) {
      const [anim] = glbJson(readFileSync(`public${c.url}`)).animations;
      const { contact, root, rootHips } = anim.extras;
      const d = root.at(-1)[0];
      expect(contact[0], n).toBeGreaterThanOrEqual(0.05);
      expect(contact[1], n).toBeLessThanOrEqual(d - 0.05 + 1e-6);
      expect(contact[1], n).toBeGreaterThan(contact[0]);
      expect(root[0], n).toEqual([0, 0, 0]);
      expect(rootHips, n).toBeGreaterThan(0.5);
    }
    // (the dash goes a long way ahead, +z on the figure)
    const dash = glbJson(readFileSync('public/games/meshy/ual-sword.dash.glb')).animations[0].extras.root.at(-1);
    expect(dash[2]).toBeGreaterThan(3);
  });

  it('plays Heavy_A under its old name too, from the one file', () => {
    expect(CLIPS['sword.heavy'].url).toBe(CLIPS['sword.heavy.a'].url);
  });
});
