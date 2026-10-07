import { describe, expect, it } from 'vitest';
import { MAGIC, deriveKeys, fromBase64, keysFromRaw, open, seal, toBase64 } from './crypt';

const enc = (s) => new TextEncoder().encode(s);
const dec = (b) => new TextDecoder().decode(b);
const salt = enc('0123456789abcdef');
const FAST = 1000; // (the page uses many more; the sums are the same)

describe('the game files’ lock', () => {
  it('seals and opens with the same password', async () => {
    const keys = await deriveKeys('correct horse', salt, FAST);
    const sealed = await seal(keys, enc('<html>the game</html>'));
    expect(dec(await open(keys, sealed))).toBe('<html>the game</html>');
  });

  it('a wrong password opens nothing', async () => {
    const sealed = await seal(await deriveKeys('correct horse', salt, FAST), enc('the game'));
    await expect(open(await deriveKeys('wrong horse', salt, FAST), sealed)).rejects.toThrow();
  });

  it('starts with its mark and version, and hides what it holds', async () => {
    const sealed = await seal(await deriveKeys('pw', salt, FAST), enc('minecraft minecraft minecraft'));
    expect([...sealed.subarray(0, 5)]).toEqual([...MAGIC, 2]);
    expect(dec(sealed)).not.toContain('minecraft');
  });

  it('the same file sealed twice is the same bytes (a rebuild adds nothing to git), another file differs', async () => {
    const keys = await deriveKeys('pw', salt, FAST);
    const a = await seal(keys, enc('one'));
    const b = await seal(keys, enc('one'));
    const c = await seal(keys, enc('two'));
    expect(toBase64(a)).toBe(toBase64(b));
    expect(toBase64(a.subarray(5, 17))).not.toBe(toBase64(c.subarray(5, 17))); // (a different nonce)
  });

  it('stretches the password once, to 32 bytes, and expands the two keys from them', async () => {
    const keys = await deriveKeys('pw', salt, FAST);
    expect(keys.raw.length).toBe(32);
    // the same 32 bytes as one PBKDF2 block: no second block an attacker could skip
    const base = await crypto.subtle.importKey('raw', enc('pw'), 'PBKDF2', false, ['deriveBits']);
    const one = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: FAST }, base, 256));
    expect(toBase64(keys.raw)).toBe(toBase64(one));
  });

  it('a remembered key opens what the password sealed; an old 64-byte one doesn’t load', async () => {
    const keys = await deriveKeys('pw', salt, FAST);
    const sealed = await seal(keys, enc('the game'));
    const again = await keysFromRaw(fromBase64(toBase64(keys.raw)));
    expect(dec(await open(again, sealed))).toBe('the game');
    await expect(keysFromRaw(new Uint8Array(64))).rejects.toThrow();
  });

  it('a file sealed by the first version is refused, not misread', async () => {
    const keys = await deriveKeys('pw', salt, FAST);
    const sealed = await seal(keys, enc('x'));
    sealed[4] = 1;
    await expect(open(keys, sealed)).rejects.toThrow(/not a sealed/);
  });
});
