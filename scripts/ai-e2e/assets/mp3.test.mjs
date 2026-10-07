// Reading an mp3's length from its frames, with nothing but the bytes.
import { describe, expect, it } from 'vitest';
import { mp3 } from './mp3.mjs';

// MPEG-1 Layer III, 128 kbit/s, 44.1 kHz, no padding: 417 bytes a frame, 1152 samples
const FRAME = Buffer.concat([Buffer.from([0xff, 0xfb, 0x90, 0x00]), Buffer.alloc(413)]);
const frames = (n) => Buffer.concat(Array.from({ length: n }, () => FRAME));
const id3 = (size) => Buffer.concat([Buffer.from('ID3'), Buffer.from([4, 0, 0, 0, 0, size >> 7, size & 0x7f]), Buffer.alloc(size)]);

describe('an mp3’s frames', () => {
  it('give its length in seconds', () => {
    const m = mp3(frames(100));
    expect(m.frames).toBe(100);
    expect(m.seconds).toBeCloseTo((100 * 1152) / 44100, 3);
  });
  it('are found after an ID3 tag', () => {
    expect(mp3(Buffer.concat([id3(300), frames(10)])).frames).toBe(10);
  });
  it('are not in a WAV given an mp3’s name, or in a file cut off before its first frame ends', () => {
    expect(mp3(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(400)])).frames).toBe(0);
    expect(mp3(FRAME.subarray(0, 200)).frames).toBe(0);
  });
  it('read a lower sampling rate and MPEG-2’s half-size frames', () => {
    // MPEG-2 Layer III, 64 kbit/s, 24 kHz: 576 samples, 72 × 64000 / 24000 = 192 bytes
    const f = Buffer.concat([Buffer.from([0xff, 0xf3, 0x84, 0x00]), Buffer.alloc(188)]);
    const m = mp3(Buffer.concat([f, f, f]));
    expect(m.frames).toBe(3);
    expect(m.seconds).toBeCloseTo((3 * 576) / 24000, 4);
  });
});
