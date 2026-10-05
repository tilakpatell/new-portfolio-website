import { readFileSync } from 'node:fs';
import { matchPath } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { projectById } from '../../data/projects';
import { WORLDS } from '../worlds/worlds';
import { UNIVERSES, byPath, contrast } from './universes';

const app = readFileSync(new URL('../../App.jsx', import.meta.url), 'utf8');
const ROUTES = [...app.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]).filter((p) => p !== '*');

describe('the universes', () => {
  it('are the site’s six pages and eleven fandoms, each with its own id', () => {
    expect(UNIVERSES.filter((u) => u.kind === 'core').map((u) => u.to)).toEqual(['/home', '/experience', '/projects', '/resume', '/contact', '/terminal']);
    expect(UNIVERSES.filter((u) => u.kind === 'fandom')).toHaveLength(11);
    expect(new Set(UNIVERSES.map((u) => u.id)).size).toBe(17);
    for (const u of UNIVERSES) expect(u.place, u.id).toBeTruthy();
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
    expect(WORLDS.map((w) => w.to)).toEqual(['/galaxy', '/deathstar', '/music', '/middle-earth', '/cybertron', '/avengers', '/albuquerque', '/scranton', '/c-137', '/caribbean']);
    expect(WORLDS[0]).toMatchObject({ to: '/galaxy', label: 'A galaxy far, far away', from: 'Star Wars' });
    expect(WORLDS[1]).toMatchObject({ to: '/deathstar', label: 'Death Star', from: 'Star Wars' });
  });

  it('know the pages inside them', () => {
    expect(byPath('/galaxy')?.id).toBe('starwars');
    expect(byPath('/deathstar')?.id).toBe('starwars');
    for (const u of UNIVERSES) for (const p of u.pages ?? []) expect(ROUTES.some((r) => matchPath(r, p.to)), p.to).toBe(true);
  });
});
