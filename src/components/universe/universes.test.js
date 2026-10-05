import { readFileSync } from 'node:fs';
import { matchPath } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { projectById } from '../../data/projects';
import { WORLDS } from '../worlds/worlds';
import { UNIVERSES, byPath, contrast } from './universes';

const app = readFileSync(new URL('../../App.jsx', import.meta.url), 'utf8');
const ROUTES = [...app.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]).filter((p) => p !== '*');

describe('the universes', () => {
  it('are the site’s six pages and twelve fandoms, each with its own id', () => {
    expect(UNIVERSES.filter((u) => u.kind === 'core').map((u) => u.to)).toEqual(['/home', '/experience', '/projects', '/resume', '/contact', '/terminal']);
    expect(UNIVERSES.filter((u) => u.kind === 'fandom')).toHaveLength(12);
    expect(new Set(UNIVERSES.map((u) => u.id)).size).toBe(18);
    for (const u of UNIVERSES) expect(u.place, u.id).toBeTruthy();
  });

  it('each go somewhere real', () => {
    for (const u of UNIVERSES) expect(ROUTES.some((p) => matchPath(p, u.to)), u.to).toBe(true);
    // (the Game Boy's world links to its project page)
    expect(byPath('/dot-matrix')?.id).toBe('gaming');
    expect(projectById('gameboy-emulator')).toBeTruthy();
  });

  it('have accents that read on the deep-space page', () => {
    for (const u of UNIVERSES) expect(contrast(u.accent, '#03040a'), u.id).toBeGreaterThanOrEqual(4.5);
  });

  it('give the world pages their list, in map order', () => {
    expect(WORLDS.map((w) => w.to)).toEqual(['/deathstar', '/music', '/middle-earth', '/cybertron', '/avengers', '/albuquerque', '/scranton', '/c-137', '/dot-matrix', '/caribbean', '/invincible']);
    expect(WORLDS[0]).toMatchObject({ to: '/deathstar', label: 'Death Star', from: 'Star Wars' });
  });
});
