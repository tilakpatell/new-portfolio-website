import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { CHECK, deriveKeys, seal, toBase64 } from './crypt';
import { PLAYER, checkPassword, playerUrl, unpack } from './load';

describe('where the game runs', () => {
  it('on an origin of its own: the published player for the site, the other loopback name in development', () => {
    expect(playerUrl({ hostname: 'tilakpatell.com', port: '' })).toBe(PLAYER);
    expect(new URL(PLAYER).origin).toBe('https://tilakpatell.github.io');
    expect(playerUrl({ hostname: '127.0.0.1', port: '5191' })).toBe('http://localhost:5191/eagler-player/index.html');
    expect(playerUrl({ hostname: 'localhost', port: '5188' })).toBe('http://127.0.0.1:5188/eagler-player/index.html');
  });
});

const salt = new TextEncoder().encode('0123456789abcdef');

describe('unlocking and unpacking a client', () => {
  it('the right password opens the check; a wrong one doesn’t', async () => {
    const keys = await deriveKeys('pw', salt, 1000);
    const manifest = { kdf: { salt: toBase64(salt), iterations: 1000 }, check: toBase64(await seal(keys, new TextEncoder().encode(CHECK))) };
    expect(await checkPassword(manifest, 'pw')).toBeTruthy();
    expect(await checkPassword(manifest, 'nope')).toBeNull();
  });

  it('a sealed, gzipped client comes back as its page', async () => {
    const keys = await deriveKeys('pw', salt, 1000);
    const html = `<html>${'block '.repeat(5000)}</html>`;
    const sealed = await seal(keys, gzipSync(new TextEncoder().encode(html)));
    expect(await unpack(keys, sealed)).toBe(html);
  });
});
