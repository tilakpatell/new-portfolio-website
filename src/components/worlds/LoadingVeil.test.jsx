import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LoadingVeil, { STEP_WORDS } from './LoadingVeil';

const veil = (props) => renderToStaticMarkup(<LoadingVeil title="The universe" line="Lighting the stars" {...props} />);

describe('the loading veil', () => {
  it('says what step the world is on, in words', () => {
    const html = veil({ shown: true, progress: 0.4, step: 'shaders' });
    expect(html).toContain('Compiling shaders');
    expect(html).toContain('The universe');
    expect(html).toContain('Lighting the stars');
  });

  it('has words for every step prepare reports', () => {
    for (const step of ['pictures', 'shaders', 'first draw', 'bake', 'tune']) {
      expect(veil({ shown: true, progress: 0, step })).toContain(STEP_WORDS[step]);
    }
  });

  it('is a polite status for screen readers', () => {
    const html = veil({ shown: true, progress: 0 });
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });

  it('moves its bar with a transform, clamped to 0..1', () => {
    expect(veil({ shown: true, progress: 0.25 })).toContain('transform:scaleX(0.25)');
    expect(veil({ shown: true, progress: 3 })).toContain('transform:scaleX(1)');
    expect(veil({ shown: true, progress: Number.NaN })).toContain('transform:scaleX(0)');
  });

  it('is not there when it isn’t shown', () => {
    expect(veil({ shown: false, progress: 1, step: 'tune' })).toBe('');
  });
});
