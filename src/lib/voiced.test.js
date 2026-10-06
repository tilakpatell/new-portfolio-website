import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('the lines made in the crews’ voices', () => {
  it('give each line from each speaker its own steady id', async () => {
    const { lineId } = await import('./voiced');
    expect(lineId('walt', 'Jesse.')).toBe(lineId('walt', 'Jesse.'));
    expect(lineId('walt', 'Jesse.')).not.toBe(lineId('jesse', 'Jesse.'));
    expect(lineId('walt', 'Jesse.')).not.toBe(lineId('walt', 'Jesse!'));
    expect(lineId('rick', 'Morty’s fine.')).toMatch(/^[0-9a-f]{8}$/);
  });
  it('find a line’s file in the manifest', async () => {
    const { lineId, voicedSrc } = await import('./voiced');
    const id = lineId('han', 'Punch it.');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ lines: { [id]: `han/${id}.mp3` } }) })));
    await expect(voicedSrc('han', 'Punch it.')).resolves.toBe(`/audio/voiced/han/${id}.mp3`);
    await expect(voicedSrc('han', 'Chewie, we’re home.')).resolves.toBeNull();
  });
  it('leave every line to the blips when there is no manifest, or the page is not one', async () => {
    const { voicedSrc } = await import('./voiced');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => Promise.reject(new SyntaxError('<!doctype html>')) })));
    await expect(voicedSrc('han', 'Punch it.')).resolves.toBeNull();
  });
});

describe('the worlds’ conversations, said in their speakers’ voices', () => {
  it('know each speaker’s voice, and that a narrator has none', async () => {
    const { voiceOf } = await import('./voiced');
    expect(voiceOf('gandalf')).toBe('gandalf');
    expect(voiceOf('strider')).toBe('aragorn');
    expect(voiceOf('councilb')).toBe('rick');
    expect(voiceOf('evilmorty')).toBe('morty');
    expect(voiceOf('narrator')).toBeNull();
    expect(voiceOf('caller')).toBeNull();
    expect(voiceOf(undefined)).toBeNull();
  });
  it('say aloud only what’s in quotes when a line mixes them with narration', async () => {
    const { spoken } = await import('./voiced');
    expect(spoken('Footsteps on the stair. Aragorn. “Frodo?” You back away. “It has taken Boromir.”')).toBe('Frodo? It has taken Boromir.');
    expect(spoken('“Why do you shrink from me? I am no thief.”')).toBe('Why do you shrink from me? I am no thief.');
    expect(spoken('Thank you thank you thank you. Just put them through.')).toBe('Thank you thank you thank you. Just put them through.');
  });
  it('play a line in its speaker’s voice, and stop it when the next comes', async () => {
    const { lineId } = await import('./voiced');
    const say = 'Footsteps. “It has taken Boromir.”';
    const id = lineId('aragorn', say);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ lines: { [id]: `aragorn/${id}.mp3` } }) })));
    const played = [];
    vi.doMock('./clips', () => ({ playFile: vi.fn(async (src) => { const h = { src, stopped: false, stop() { h.stopped = true; } }; played.push(h); return h; }) }));
    const { sayVoiced, stopVoiced } = await import('./voiced');
    const h = await sayVoiced('strider', say);
    expect(h.src).toBe(`/audio/voiced/aragorn/${id}.mp3`);
    await sayVoiced('strider', 'Not made yet.');
    expect(h.stopped).toBe(true);
    expect(await sayVoiced('narrator', say)).toBeNull();
    const again = await sayVoiced('aragorn', say);
    stopVoiced();
    expect(again.stopped).toBe(true);
    expect(played).toHaveLength(2);
  });
});
