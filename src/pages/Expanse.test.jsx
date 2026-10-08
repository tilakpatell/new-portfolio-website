import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const three = { on: true, can: true, set: vi.fn() };
vi.mock('../lib/gpu', () => ({ use3D: () => three }));
vi.mock('../components/expanse/surface/ExpanseWorld', () => ({ default: ({ seed, type, name }) => <div data-world={`${seed}:${type}`}>{name}</div> }));
const { default: Expanse } = await import('./Expanse');
const { planetName } = await import('../components/expanse/surface/names');

const at = (url) =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/universe/expanse/:seed" element={<Expanse />} />
      </Routes>
    </MemoryRouter>,
  );

describe('the Expanse page', () => {
  it('opens the planet of the seed in the address, temperate unless asked', () => {
    expect(at('/universe/expanse/7')).toContain('data-world="7:temperate"');
    expect(at('/universe/expanse/k9?type=desert')).toContain('data-world="k9:desert"');
    expect(at('/universe/expanse/k9?type=jelly')).toContain('data-world="k9:temperate"');
    expect(at('/universe/expanse/7')).toContain(planetName('7', 'temperate'));
  });

  it('says so without 3D', () => {
    three.on = false;
    const html = at('/universe/expanse/7');
    expect(html).toContain('Turn 3D on');
    expect(html).not.toContain('data-world');
    three.on = true;
  });
});
