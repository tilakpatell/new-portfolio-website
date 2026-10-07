import { createServer } from 'node:net';
import { describe, expect, it } from 'vitest';
import { NOISE, freePort, noisy } from './noise.mjs';

describe('console noise', () => {
  it('is what a sandbox or a software renderer always says, and means nothing', () => {
    expect(NOISE.length).toBeGreaterThan(0);
    expect(noisy('WebGL: INVALID_OPERATION: drawArrays')).toBe(true);
    expect(noisy('Failed to load resource: net::ERR_CONNECTION_REFUSED')).toBe(true);
    expect(noisy('[vite] connected.')).toBe(true);
  });
  it('is never a real error', () => {
    expect(noisy('TypeError: Cannot read properties of undefined (reading \'scene\')')).toBe(false);
    expect(noisy('THREE.GLTFLoader: Unknown extension')).toBe(false);
  });
});

describe('a free port', () => {
  it('is one nothing is listening on', async () => {
    const port = await freePort();
    expect(port).toBeGreaterThan(0);
    const s = createServer();
    await new Promise((ok, fail) => s.once('error', fail).listen(port, '127.0.0.1', ok));
    await new Promise((r) => s.close(r));
  });
});
