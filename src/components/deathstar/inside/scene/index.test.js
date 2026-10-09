import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createTrack, leafPlaces, playerAct, roomsOf } from './index';
import { createPeople } from './people';

const STEP = 1 / 30;
const slide = { kind: 'slide', w: 2, h: 2.6 };
const blast = { kind: 'blast', w: 2.4, h: 2.6 };
const hatch = { kind: 'hatch', w: 1.6, h: 1.9 };

describe('a door’s leaves, from how open the game says it is', () => {
  it('shuts a sliding door with two halves meeting in the middle', () => {
    expect(leafPlaces(slide, 0)).toEqual([
      { x0: -1, x1: 0, y0: 0, y1: 2.6, lead: 'x1' },
      { x0: 0, x1: 1, y0: 0, y1: 2.6, lead: 'x0' },
    ]);
  });

  it('parts the halves sideways into the wall, showing only what is still in the doorway', () => {
    const [left, right] = leafPlaces(slide, 0.5);
    expect(left.x0).toBeCloseTo(-1);
    expect(left.x1).toBeCloseTo(-0.5);
    expect(right.x0).toBeCloseTo(0.5);
    expect(right.x1).toBeCloseTo(1);
  });

  it('shows no leaf at all once a door is wide open, and never one in an arch', () => {
    expect(leafPlaces(slide, 1)).toEqual([]);
    expect(leafPlaces(blast, 1)).toEqual([]);
    expect(leafPlaces({ kind: 'arch', w: 56, h: 20 }, 0)).toEqual([]);
  });

  it('drops a blast door from above: its foot rises as it opens', () => {
    expect(leafPlaces(blast, 0)).toEqual([{ x0: -1.2, x1: 1.2, y0: 0, y1: 2.6, lead: 'y0' }]);
    const [leaf] = leafPlaces(blast, 0.5);
    expect(leaf.y0).toBeCloseTo(1.3);
    expect(leaf.y1).toBeCloseTo(2.6);
  });

  it('swings a hatch whole on its hinge, a hundred degrees when open, and never takes its leaf away', () => {
    const deg = (r) => (r.swing * 180) / Math.PI;
    const [shut] = leafPlaces(hatch, 0);
    expect(shut).toMatchObject({ x0: -0.8, x1: 0.8, y0: 0, y1: 1.9, lead: 'x1' });
    expect(deg(shut)).toBeCloseTo(0);
    expect(deg(leafPlaces(hatch, 0.5)[0])).toBeCloseTo(50);
    const open = leafPlaces(hatch, 1);
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({ x0: -0.8, x1: 0.8 });
    expect(deg(open[0])).toBeCloseTo(100);
  });
});

describe('where a body is drawn between the game’s steps', () => {
  it('is drawn between its last two steps, and goes at their pace', () => {
    const track = createTrack();
    track.push(0, { x: 0, y: 0, z: 0, yaw: 0 });
    track.push(STEP, { x: 0.1, y: 0, z: 0, yaw: 0 });
    expect(track.at(0.5).x).toBeCloseTo(0.05);
    expect(track.at(1).x).toBeCloseTo(0.1);
    expect(track.speed()).toBeCloseTo(3);
  });

  it('keeps the pair when the same step is pushed again', () => {
    const track = createTrack();
    track.push(0, { x: 0, y: 0, z: 0, yaw: 0 });
    track.push(STEP, { x: 0.1, y: 0, z: 0, yaw: 0 });
    track.push(STEP, { x: 0.1, y: 0, z: 0, yaw: 0 });
    expect(track.at(0.5).x).toBeCloseTo(0.05);
  });

  it('draws a lift ride or a teleport where it lands, not on the way', () => {
    const track = createTrack();
    track.push(0, { x: 0, y: 0, z: 0, yaw: 0 });
    track.push(STEP, { x: 30, y: -36, z: -40, yaw: 0 });
    expect(track.at(0)).toMatchObject({ x: 30, y: -36, z: -40 });
    expect(track.speed()).toBe(0);
  });

  it('turns the short way round', () => {
    const track = createTrack();
    track.push(0, { x: 0, y: 0, z: 0, yaw: 3.1 });
    track.push(STEP, { x: 0, y: 0, z: 0, yaw: -3.1 });
    expect(Math.abs(track.at(0.5).yaw)).toBeCloseTo(Math.PI, 2);
  });
});

describe('what the people are told of the rooms', () => {
  const streamOf = (...ids) => ({ built: new Map(ids.map((id) => [id, { group: { visible: true } }])) });

  it('has a room drawn while the stream shows it, and standing from when it is built until it is freed', () => {
    const stream = streamOf('corr327');
    const rooms = roomsOf(stream);
    expect([rooms.shown('corr327'), rooms.built('corr327')]).toEqual([true, true]);
    stream.built.get('corr327').group.visible = false;
    expect([rooms.shown('corr327'), rooms.built('corr327')]).toEqual([false, true]);
    stream.built.delete('corr327');
    expect([rooms.shown('corr327'), rooms.built('corr327')]).toEqual([false, false]);
    expect([rooms.shown('aa23'), rooms.built('aa23')]).toEqual([false, false]);
  });

  it('keeps a body while a door is shut on its room, and lets it go once the stream frees the room', () => {
    const scene = new THREE.Scene();
    const people = createPeople(scene, { mat: () => new THREE.MeshStandardMaterial() }, { tier: 'low' });
    const stream = streamOf('corr327');
    const rooms = Object.assign(roomsOf(stream), { dt: STEP });
    const crew = { people: new Map([['ito', { id: 'ito', kind: 'ito', x: 4, y: 0, z: 0, yaw: 0, room: 'corr327', hp: 0, mode: 'dead', anim: 'die', aim: null }]]) };
    const eye = { x: 0, y: 1.6, z: 0 };
    const bodies = () => scene.children.filter((o) => o.name === 'person-ito');
    people.sync(crew, 1, eye, rooms);
    const [body] = bodies();
    expect(body.visible).toBe(true);
    stream.built.get('corr327').group.visible = false;
    people.sync(crew, 1, eye, rooms);
    expect(bodies()).toEqual([body]);
    expect(body.visible).toBe(false);
    stream.built.get('corr327').group.visible = true;
    people.sync(crew, 1, eye, rooms);
    expect(body.visible).toBe(true);
    stream.built.delete('corr327');
    people.sync(crew, 1, eye, rooms);
    expect(bodies()).toEqual([]);
    people.dispose();
  });
});

describe('what the player’s figure plays', () => {
  it('crouches still or crouch-walks, and stands to walk', () => {
    expect(playerAct({ crouch: true }).base).toBe('crouch');
    expect(playerAct({ crouch: true, moving: true }).base).toBe('crouch.walk');
    expect(playerAct({ moving: true }).base).toBeNull();
  });

  it('sits in a seat, the gun put up', () => {
    expect(playerAct({ sit: true, gun: 'e11', aim: true })).toEqual({ base: 'sit.idle', upper: null });
  });

  it('holds the gun out while aiming, fires it for a moment after each shot, and carries it otherwise', () => {
    expect(playerAct({ gun: 'e11', aim: true }).upper).toBe('aim.pistol');
    expect(playerAct({ gun: 'e11', shotAgo: 0.1 }).upper).toBe('shoot.pistol');
    expect(playerAct({ gun: 'e11', shotAgo: 2 }).upper).toBeNull();
  });

  it('strokes with a blade for a moment after each swing, and holds nothing out between', () => {
    expect(playerAct({ blade: 'blue', swungAgo: 0.1 }).upper).toBe('stroke');
    expect(playerAct({ blade: 'blue', swungAgo: 3, aim: true }).upper).toBeNull();
  });
});
