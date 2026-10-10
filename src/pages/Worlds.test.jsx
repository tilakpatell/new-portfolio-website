import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import InstalledList from '../components/worlds/InstalledList';

const MB = 1048576;
const ROWS = [
  { to: '/earth', label: 'Earth', bytes: 3 * MB, installed: true, current: true },
  { to: '/galaxy', label: 'A galaxy far, far away', bytes: 120 * MB, installed: true, current: false },
  { to: '/music', label: 'The music room', bytes: 9 * MB, installed: false, current: false },
];

// the elements of a tree, depth first (the list has no hooks, so it can be called)
const walk = (el, out = []) => {
  if (Array.isArray(el)) el.forEach((e) => walk(e, out));
  else if (el && typeof el === 'object' && el.props) {
    out.push(el);
    walk(el.props.children, out);
  }
  return out;
};
const buttons = (tree) => walk(tree).filter((e) => e.type === 'button');
const label = (b) => b.props['aria-label'] ?? [b.props.children].flat().join('');

describe('the worlds page’s list', () => {
  it('lists what is installed with its size, and the rest to install', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <InstalledList rows={ROWS} onInstall={() => {}} onRemove={() => {}} />
      </MemoryRouter>,
    );
    const [on, off] = html.split('Ready to install');
    expect(on).toContain('Earth');
    expect(on).toContain('3 MB');
    expect(on).toContain('an older build');
    expect(off).toContain('The music room');
    expect(off).toContain('9 MB · under a minute');
  });

  it('removes with Remove, and installs with Install', () => {
    const onRemove = vi.fn();
    const onInstall = vi.fn();
    const all = buttons(InstalledList({ rows: ROWS, onInstall, onRemove }));
    all.find((b) => label(b) === 'Remove Earth').props.onClick();
    expect(onRemove).toHaveBeenCalledWith('/earth');
    all.find((b) => label(b) === 'Install The music room').props.onClick();
    expect(onInstall).toHaveBeenCalledWith('/music');
    // an older build's install is brought up to date
    all.find((b) => label(b) === 'Install').props.onClick();
    expect(onInstall).toHaveBeenLastCalledWith('/galaxy');
  });

  it('says so when nothing is installed', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <InstalledList rows={[ROWS[2]]} onInstall={() => {}} onRemove={() => {}} />
      </MemoryRouter>,
    );
    expect(html).toContain('No world is installed yet');
  });
});
