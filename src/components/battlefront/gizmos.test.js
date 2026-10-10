import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createGizmos, gizmoRows } from './gizmos.js';

const MAP = {
  spawns: [
    { id: 'FantasyBattle_Logic:1', layer: 'FantasyBattle_Logic', team: 1, at: [0, 0, 0], yaw: 0 },
    { id: 'FantasyBattle_Logic:2', layer: 'FantasyBattle_Logic', team: 2, at: [5, 0, 0], yaw: 1 },
    { id: 'FantasyBattle_Logic:3', layer: 'FantasyBattle_Logic', team: 2, at: [9, 0, 0], yaw: 2 },
    { id: 'HeroArena_Logic:1', layer: 'HeroArena_Logic', team: 1, at: [0, 0, 9], yaw: 0 },
  ],
  polygons: [{ id: 'FantasyBattle_Shapes:1', layer: 'FantasyBattle_Shapes', team: 2, points: [[0, 0], [10, 0], [10, 10], [0, 10]], y: 3, height: 0 }],
  volumes: [
    { id: 'FantasyBattle_Logic:30', layer: 'FantasyBattle_Logic', kind: 'shape', points: [[0, 0], [4, 0], [4, 4]], y: 1, height: 3, closed: true },
    { id: 'Mode9_OOBTeam1:1', layer: 'Mode9_OOBTeam1', kind: 'shape', points: [[0, 0], [9, 0], [9, 9]], y: 0, height: 20, closed: true },
  ],
  spheres: [{ id: 'FantasyBattle_Shapes:23', layer: 'FantasyBattle_Shapes', at: [1, 2, 3], r: 12 }],
  boxes: [{ id: 'FantasyBattle_Shapes:26', layer: 'FantasyBattle_Shapes', at: [0, 0, 0], half: [1, 2, 3], yaw: 0.5 }],
  waypoints: [{ id: 'FantasyBattle_Logic:123', layer: 'FantasyBattle_Logic', points: [[0, 0, 0], [1, 0, 1], [2, 0, 2]] }],
  cameras: [{ id: 'FantasyBattle_Logic:328', layer: 'FantasyBattle_Logic', at: [0, 10, 0], yaw: 0, pitch: 0.2, fov: 0 }],
  oob: { team1: ['Mode9_OOBTeam1:1'], team2: [] },
};

describe('gizmoRows', () => {
  it('takes the mode’s rows by layer and sorts them into the overlay’s kinds', () => {
    const r = gizmoRows(MAP, 'galacticAssault');
    expect(r.spawns.map((s) => s.id)).toEqual(['FantasyBattle_Logic:1', 'FantasyBattle_Logic:2', 'FantasyBattle_Logic:3']);
    expect(r.areas).toHaveLength(1);
    expect(r.volumes.map((v) => v.id)).toEqual(['FantasyBattle_Logic:30', 'FantasyBattle_Shapes:26']);
    expect(r.captures.map((v) => v.id)).toEqual(['FantasyBattle_Shapes:23']);
    expect(r.oob).toEqual([]);
    expect(r.paths).toHaveLength(1);
    expect(r.cameras).toHaveLength(1);
    // the out-of-bounds volumes are Co-op's layer, drawn red, not as volumes
    const coop = gizmoRows(MAP, 'coop');
    expect(coop.oob.map((v) => v.id)).toEqual(['Mode9_OOBTeam1:1']);
    expect(coop.volumes).toEqual([]);
  });
});

describe('createGizmos', () => {
  it('draws one line set a kind (spawns a set a team), with the right count of segments', () => {
    const scene = new THREE.Scene();
    const g = createGizmos(scene, MAP, 'galacticAssault', { on: true });
    expect(g.counts).toEqual({ spawns: 3, areas: 1, volumes: 2, captures: 1, oob: 0, paths: 1, cameras: 1 });
    const sets = Object.fromEntries(g.group.children.map((c) => [c.name, c.geometry.getAttribute('position').count / 2]));
    // a spawn: a post and a tick its way; an area: its four edges; the
    // volume prism: 3 bottom, 3 top, 3 posts, the box 12; a capture ring of
    // 32; a path of 2 legs; a camera's frustum of 8 lines
    expect(sets).toEqual({ 'spawns-1': 2, 'spawns-2': 4, areas: 4, volumes: 21, captures: 32, paths: 2, cameras: 8 });
    expect(g.group.children.every((c) => c.isLineSegments && c.material.isLineBasicMaterial)).toBe(true);
    expect(scene.children).toContain(g.group);
    expect(g.group.visible).toBe(true);
    expect(g.legend().map((l) => l.kind)).toEqual(['spawns', 'areas', 'volumes', 'captures', 'paths', 'cameras']);
    g.set(false);
    expect(g.group.visible).toBe(false);
    g.dispose();
    expect(scene.children).not.toContain(g.group);
  });

  it('a mode with no rows draws nothing', () => {
    const scene = new THREE.Scene();
    const g = createGizmos(scene, MAP, 'showdown', { on: true });
    expect(g.group.children).toHaveLength(0);
    expect(g.legend()).toEqual([]);
    expect(Object.values(g.counts).every((n) => n === 0)).toBe(true);
  });

  it('labels the things on screen, nearest first, at most a cap', () => {
    const scene = new THREE.Scene();
    const g = createGizmos(scene, MAP, 'galacticAssault', { on: true });
    const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 1000);
    camera.position.set(0, 20, -40);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const labels = g.labels(camera, { w: 1600, h: 900 }, { max: 3 });
    expect(labels.length).toBeLessThanOrEqual(3);
    expect(labels.every((l) => l.onScreen && typeof l.x === 'number' && l.label)).toBe(true);
    g.set(false);
    expect(g.labels(camera, { w: 1600, h: 900 })).toEqual([]);
  });
});
