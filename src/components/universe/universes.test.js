import { readFileSync } from 'node:fs';
import { matchPath } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { projectById } from '../../data/projects';
import { WORLDS } from '../worlds/worlds';
import { UNIVERSES, byPath, contrast } from './universes';

const app = readFileSync(new URL('../../App.jsx', import.meta.url), 'utf8');
const ROUTES = [...app.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]).filter((p) => p !== '*');

describe('the universes', () => {
  it('are nine, each with its own id', () => {
    expect(UNIVERSES).toHaveLength(9);
    expect(new Set(UNIVERSES.map((u) => u.id)).size).toBe(9);
  });

  it('each go somewhere real', () => {
    for (const u of UNIVERSES) expect(ROUTES.some((p) => matchPath(p, u.to)), u.to).toBe(true);
    const id = byPath('/projects/gameboy-emulator') && 'gameboy-emulator';
    expect(projectById(id)).toBeTruthy();
  });

  it('have accents that read on the deep-space page', () => {
    for (const u of UNIVERSES) expect(contrast(u.accent, '#03040a'), u.id).toBeGreaterThanOrEqual(4.5);
  });

  it('give the world pages their list, in map order', () => {
    expect(WORLDS.map((w) => w.to)).toEqual(['/deathstar', '/music', '/middle-earth', '/cybertron', '/avengers', '/albuquerque', '/scranton']);
    expect(WORLDS[0]).toMatchObject({ to: '/deathstar', label: 'Death Star', from: 'Star Wars' });
  });
});
