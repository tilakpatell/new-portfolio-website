import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

// the 3D left out: what the page hands the surface, kept to look at
const seen = { props: null };
vi.mock('../../galaxy/surface/SurfaceView', () => ({
  default: (props) => {
    seen.props = props;
    return <div data-surface={props.site?.id} />;
  },
}));
const { default: RmSurface } = await import('./RmSurface');
const { FOUND_KEY, QUESTS_KEY } = await import('./saves');

const at = (url, props) =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[url]}>
      <RmSurface id="gazorpazorp" onLeave={() => {}} {...props} />
    </MemoryRouter>,
  );
const store = () => {
  const m = new Map();
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

describe('a big planet’s page', () => {
  beforeEach(() => {
    seen.props = null;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('lands the cruiser on the planet’s own site with no saves at all, its places on the compass', () => {
    const html = at('/c-137/gazorpazorp');
    expect(html).toContain('data-surface="gazorpazorp"');
    expect(seen.props.site.id).toBe('gazorpazorp');
    expect(seen.props.ship).toBe('cruiser');
    expect(seen.props.found).toEqual([]);
    expect(seen.props.done).toEqual([]);
    expect(seen.props.missionSpec).toBeNull();
    expect(seen.props.compass).toBeTruthy();
    // (the women's gate, not found yet, on the compass; the cruiser too)
    expect(html).toMatch(/data-id="gate"[^>]*>/);
    expect(html).toMatch(/data-id="ship"/);
    expect(html).toContain('Back to space');
    // nothing of the galaxy's war on it
    expect(html).not.toMatch(/Loadout|allegiance|Back to orbit/i);
  });

  it('hands the surface the planets’ kit, laid over the galaxy’s books', async () => {
    const { RM_MODELS } = await import('./catalog');
    const { RM_RIDES } = await import('./rides');
    const { PROPS, SCATTER } = await import('./props');
    const galaxy = await import('../../galaxy/surface/props');
    const { RIDES } = await import('../../galaxy/surface/rides');
    at('/c-137/gazorpazorp');
    expect(seen.props.models).toBe(RM_MODELS);
    for (const k of Object.keys(RM_RIDES)) expect(seen.props.rides[k], k).toBe(RM_RIDES[k]);
    expect(seen.props.rides.landspeeder).toBe(RIDES.landspeeder);
    expect(seen.props.props.rocksled).toBe(PROPS.rocksled);
    expect(seen.props.props.rock).toBe(galaxy.PROPS.rock);
    expect(seen.props.scatter.redrock).toBe(SCATTER.redrock);
    // (the people: the scene's own cast handed to the planets' figure maker)
    const maker = seen.props.figures({ make: () => null });
    expect(typeof maker).toBe('function');
    expect(await maker('rock', {}, 0)).toBeNull();
  });

  it('reads what was found here before, and nothing of another planet’s', () => {
    const ls = store();
    ls.setItem(FOUND_KEY, JSON.stringify({ gazorpazorp: ['gate'], squanch: ['arch'] }));
    ls.setItem(QUESTS_KEY, JSON.stringify({ squanch: ['toast'] }));
    vi.stubGlobal('window', { localStorage: ls, matchMedia: () => ({ matches: false }) });
    at('/c-137/gazorpazorp');
    expect(seen.props.found).toEqual(['gate']);
    expect(seen.props.done).toEqual([]);
  });

  it('starts no mission for one the planet hasn’t got', () => {
    at('/c-137/gazorpazorp?mission=chase');
    expect(seen.props.missionSpec).toBeNull();
  });

  it('goes back to space once the cruiser’s away, once however often it says so', () => {
    vi.useFakeTimers();
    const onLeave = vi.fn();
    at('/c-137/gazorpazorp', { onLeave });
    seen.props.onEvent({ type: 'leave' });
    seen.props.onEvent({ type: 'leave' });
    expect(onLeave).not.toHaveBeenCalled();
    vi.advanceTimersByTime(700);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('keeps a place found in the planets’ own save', () => {
    const ls = store();
    vi.stubGlobal('window', { localStorage: ls, matchMedia: () => ({ matches: false }) });
    at('/c-137/gazorpazorp');
    seen.props.onEvent({ type: 'found', id: 'gate' });
    seen.props.onEvent({ type: 'found', id: 'nowhere' });
    expect(JSON.parse(ls.getItem(FOUND_KEY))).toEqual({ gazorpazorp: ['gate'] });
    expect([...ls.m.keys()]).toEqual([FOUND_KEY]);
  });
});
