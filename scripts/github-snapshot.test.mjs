import { describe, expect, it } from 'vitest';
import { sameSnapshot, snapshotOf } from './github-snapshot.mjs';

const user = { login: 'tilakpatell', name: 'Tilak Patel', avatar_url: 'a.png', html_url: 'https://github.com/tilakpatell', public_repos: 3 };
const repo = (name, extra = {}) => ({ name, html_url: `u/${name}`, description: null, language: 'Python', pushed_at: '2026-10-01', stargazers_count: 1, fork: false, archived: false, ...extra });
const repos = [repo('a'), repo('b', { language: 'Java' }), repo('c', { fork: true })];
const contrib = { total: { lastYear: 5 }, contributions: [{ date: '2025-10-06', count: 2, level: 1 }, { date: '2025-10-07', count: 3, level: 2 }] };
const ok = (value) => ({ status: 'fulfilled', value });
const down = { status: 'rejected', reason: new Error('503') };
const NOW = '2026-10-06T00:00:00.000Z';

describe('the GitHub snapshot', () => {
  it('builds one from all three answers', () => {
    const s = snapshotOf([ok(user), ok(repos), ok(contrib)], null, NOW);
    expect(s.fetchedAt).toBe(NOW);
    expect(s.user).toEqual({ login: 'tilakpatell', name: 'Tilak Patel', avatar: 'a.png', url: 'https://github.com/tilakpatell', publicRepos: 3 });
    expect(s.languages).toEqual([['Python', 1], ['Java', 1]]);
    expect(s.repos.map((r) => r.name)).toEqual(['a', 'b']);
    expect(s.contributions).toEqual({ total: 5, start: '2025-10-06', counts: [2, 3], levels: '12' });
  });

  it('keeps the last contributions when only that API is down', () => {
    const before = snapshotOf([ok(user), ok(repos), ok(contrib)], null, NOW);
    const s = snapshotOf([ok({ ...user, public_repos: 4 }), ok(repos), down], before, NOW);
    expect(s.user.publicRepos).toBe(4);
    expect(s.contributions).toEqual(before.contributions);
  });

  it('keeps the last profile and repositories when GitHub is down', () => {
    const before = snapshotOf([ok(user), ok(repos), ok(contrib)], null, NOW);
    const s = snapshotOf([down, ok(repos), ok({ ...contrib, total: { lastYear: 9 } })], before, NOW);
    expect(s.user).toEqual(before.user);
    expect(s.repos).toEqual(before.repos);
    expect(s.contributions.total).toBe(9);
  });

  it('has nothing new when nothing answered, or GitHub is down with no snapshot to fall back on', () => {
    expect(snapshotOf([down, down, down], { fetchedAt: 'x' }, NOW)).toBeNull();
    expect(snapshotOf([down, ok(repos), ok(contrib)], null, NOW)).toBeNull();
  });

  it('tells a snapshot that only moved its clock from one that changed', () => {
    const a = snapshotOf([ok(user), ok(repos), ok(contrib)], null, NOW);
    expect(sameSnapshot(a, { ...a, fetchedAt: '2027-01-01T00:00:00.000Z' })).toBe(true);
    expect(sameSnapshot(a, { ...a, user: { ...a.user, publicRepos: 9 } })).toBe(false);
    expect(sameSnapshot(null, a)).toBe(false);
  });
});
