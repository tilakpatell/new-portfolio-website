import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PlanetMap from './PlanetMap';

const ship = { x: 0, z: 0, yaw: 0 };
const render = (spec, waypoint = null) => renderToStaticMarkup(<PlanetMap spec={spec} source={() => ({ ship })} markers={() => []} waypoint={waypoint} onWaypoint={() => {}} onClose={() => {}} />);

describe('the planet map', () => {
  it('lists every place nearest first with its bearing and distance, two of a name both there', () => {
    const spec = { name: 'Hoth', pois: [{ id: 'a', name: 'Imperial outpost', at: [5000, 0] }, { id: 'b', name: 'Imperial outpost', at: [-1000, 0] }, { id: 'c', name: 'Echo Base', at: [0, -3000] }] };
    const html = render(spec, { id: 'c', name: 'Echo Base', at: [0, -3000] });
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-label="Map of Hoth"');
    const rows = [...html.matchAll(/fly-map-place-name">([^<]+)<\/span><span class="fly-map-place-way">([^<]+)</g)].map((m) => [m[1], m[2]]);
    expect(rows).toEqual([['Imperial outpost', 'W · 1.0 km'], ['Echo Base', 'N · 3.0 km'], ['Imperial outpost', 'E · 5.0 km']]);
    expect(html).toMatch(/aria-pressed="true"[^>]*><span class="fly-map-place-name">Echo Base/);
    expect(html).toContain('Clear the waypoint');
  });
  it('says what to do on a planet with no named places', () => {
    expect(render({ name: 'Bespin', pois: [] })).toContain('No named places here yet');
  });
});
