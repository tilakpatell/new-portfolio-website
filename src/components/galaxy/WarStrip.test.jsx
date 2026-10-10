import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import WarStrip from './WarStrip';
import { WARS } from './sides';
import { warNow } from './warState';

const NOW = 1_700_000_000_000;
const strip = (war, fighting) => renderToStaticMarkup(<WarStrip table={warNow(NOW, war)} fighting={fighting} />);

describe('WarStrip', () => {
  it('names the war shown, and marks it when it is the one you fight in', () => {
    expect(strip('gcw', 'gcw')).toContain(`${WARS.gcw.name}<span class="holomap-strip-yours"> · yours</span>`);
    const other = strip('clone', 'gcw');
    expect(other).toContain(WARS.clone.name);
    expect(other).not.toContain('holomap-strip-yours');
  });
  it('has no war switch of its own: the era chips pick the war', () => {
    expect(strip('gcw', 'gcw')).not.toContain('holomap-strip-wars');
    expect(strip('gcw', 'gcw')).not.toContain('<button');
  });
});
