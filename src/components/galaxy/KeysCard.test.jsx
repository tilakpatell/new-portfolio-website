import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import KeysCard from './KeysCard';

describe('KeysCard', () => {
  it('lists the keys in three groups, with a close button', () => {
    const html = renderToStaticMarkup(<KeysCard open onClose={() => {}} />);
    for (const h of ['Fly', 'Fight', 'Travel']) expect(html).toContain(`<h3>${h}</h3>`);
    expect(html).toContain('<kbd class="hud-cap">J</kbd>');
    expect(html).toContain('aria-label="Close the keys"');
  });
  it('leaves the hangar out until there is one to open', () => {
    expect(renderToStaticMarkup(<KeysCard open onClose={() => {}} />)).not.toContain('Hangar');
  });
  it('is nothing when shut', () => {
    expect(renderToStaticMarkup(<KeysCard open={false} onClose={() => {}} />)).toBe('');
  });
});
