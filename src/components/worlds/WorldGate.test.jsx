import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { InstallCard, InstallPill } from './InstallCard';
import { cardState, leftText, sizeText, SMALL, timeText } from './usePack';

const MB = 1048576;
const big = { slug: 'galaxy', bytes: 184 * MB, v: 'a' };
const card = (state, extra = {}) => renderToStaticMarkup(<InstallCard name="The galaxy" why="It’s a big download." state={state} pack={big} onInstall={() => {}} onOpen={() => {}} onLight={() => {}} onAlways={() => {}} {...extra} />);

describe('the install card', () => {
  it('says the pack’s true size and how long it takes', () => {
    expect(sizeText(184 * MB)).toBe('184 MB');
    expect(sizeText(2.44 * MB)).toBe('2.4 MB');
    expect(timeText(184 * MB)).toBe('about 2 min');
    expect(timeText(20 * MB)).toBe('under a minute');
    expect(leftText(30)).toBe('under a minute left');
    expect(card('install')).toContain('Install · 184 MB · about 2 min');
  });

  it('shows Open once the install is done, or the world is on this device', () => {
    expect(cardState({ held: true, pack: big, installed: null, busy: false })).toBe('install');
    expect(cardState({ held: true, pack: big, installed: null, busy: true })).toBe('installing');
    expect(cardState({ held: true, pack: big, installed: { v: 'a', bytes: big.bytes }, busy: false })).toBe('open');
    const open = card('open');
    expect(open).toContain('>Open</button>');
    expect(open).not.toContain('Install ·');
  });

  it('opens a light world at once on a desktop', () => {
    expect(cardState({ held: false, pack: { ...big, bytes: SMALL - 1 }, installed: null })).toBe('open');
    expect(cardState({ held: false, pack: big, installed: null })).toBe('install');
    expect(cardState({ held: false, pack: null, installed: null })).toBe('none');
  });

  it('fills a bar, for a screen reader too, while it installs', () => {
    const html = card('installing', { progress: { done: 46 * MB, total: 184 * MB, files: 10, left: 6, eta: 90 } });
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="25"');
    expect(html).toContain('46 MB of 184 MB · about 2 min left');
    expect(html).not.toContain('Install ·');
  });

  it('keeps the old gate’s reasons and ways out', () => {
    const html = card('install');
    expect(html).toContain('It’s a big download.');
    for (const b of ['Open without installing', 'Keep it light', 'Always load on this device']) expect(html).toContain(b);
    expect(card('failed', { error: 'couldn’t fetch /models/x.glb (404)' })).toContain('Try again');
  });

  it('offers a desktop the install in a pill', () => {
    expect(renderToStaticMarkup(<InstallPill state="install" pack={big} onInstall={() => {}} onClose={() => {}} />)).toContain('Install · 184 MB');
    expect(renderToStaticMarkup(<InstallPill state="installing" pack={big} progress={{ done: 92 * MB }} />)).toContain('aria-valuenow="50"');
  });
});
