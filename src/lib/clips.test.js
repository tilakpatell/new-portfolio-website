import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLIPS } from './clips';

const at = (path) => new URL(`../../public${path}`, import.meta.url);

describe('the recorded clips', () => {
  it('each have their file under public/', () => {
    // a missing one is served as the site's HTML page, and decodeAudioData throws on it
    const clips = Object.entries(CLIPS);
    expect(clips.length).toBeGreaterThan(0);
    for (const [id, clip] of clips) {
      expect(clip.src, id).toMatch(/^\/audio\/.+\.mp3$/);
      expect(existsSync(at(clip.src)), `${id}: ${clip.src}`).toBe(true);
    }
  });
});
