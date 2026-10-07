import { describe, expect, it } from 'vitest';
import { CLIENTS, canRun, parseWorldArg, patchClient } from './clients';

// a stand-in offline file with the two places the patches change
const offline = `<script>window.eaglercraftXOpts = { container: "game_frame", worldsDB: "worlds", relays: [] };</script>
<script>var launchTick = function() { if(++launchCounter > 100 || launchSkipCountdown) { main(); } };</script>`;
const parts = (v) => v.split(/[.-]/).map(Number);
const newer = (a, b) => {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
};

describe('the clients', () => {
  it('each keeps its own saves', () => {
    for (const id of Object.keys(CLIENTS)) {
      const out = patchClient(id, offline);
      expect(out).not.toContain('worldsDB: "worlds"');
      expect(out).toContain(`worldsDB: "tp_worlds_${id.split('.').slice(0, 2).join('_')}`);
      expect(out).toContain('localStorageNamespace: "tp_');
    }
    // (1.12.2's countdown goes; lax1dude's signed 1.8 file has none)
    expect(patchClient('1.12.2', offline)).toContain('if(true) {');
  });

  it('a patch that finds nothing stops the build', () => {
    expect(() => patchClient('1.12.2', '<html>something else</html>')).toThrow(/found nothing/);
    expect(() => patchClient('9.9', offline)).toThrow(/no client/);
  });

  it('newest first, every one with a label and a note', () => {
    const ids = Object.keys(CLIENTS);
    for (let i = 1; i < ids.length; i++) expect(newer(ids[i - 1], ids[i]), `${ids[i - 1]} before ${ids[i]}`).toBe(true);
    for (const c of Object.values(CLIENTS)) expect(c.label && c.note).toBeTruthy();
  });

  it('the 1.21.11 beta runs only where WebAssembly can suspend (JSPI): Chrome and Edge', () => {
    expect(canRun(CLIENTS['1.21.11'], { WebAssembly: {} })).toBe(false);
    expect(canRun(CLIENTS['1.21.11'], { WebAssembly: { Suspending: function Suspending() {} } })).toBe(true);
    expect(canRun(CLIENTS['1.12.2'], { WebAssembly: {} })).toBe(true);
  });
});

describe('a shared world to seal', () => {
  it('reads --world <client>:<name>=<file>', () => {
    expect(parseWorldArg('1.12.2:The Island=C:/worlds/island.epk')).toEqual({ client: '1.12.2', name: 'The Island', path: 'C:/worlds/island.epk', id: 'the-island-1-12-2', kind: 'epk' });
    expect(parseWorldArg('1.8.8:Spawn=/tmp/spawn.zip')).toMatchObject({ kind: 'zip', id: 'spawn-1-8-8' });
  });

  it('refuses a world for a client the page doesn’t have, or a file it can’t import', () => {
    expect(() => parseWorldArg('1.7.10:Old=/x.epk')).toThrow(/no client/);
    expect(() => parseWorldArg('1.12.2:Odd=/x.mca')).toThrow(/\.epk or \.zip/);
  });

  it('refuses a world with no name or no file, rather than guessing', () => {
    expect(() => parseWorldArg('1.12.2:C:/w/island.epk')).toThrow(/<client>:<name>=<file>/);
    expect(() => parseWorldArg('1.12.2:=x.epk')).toThrow(/<client>:<name>=<file>/);
    expect(() => parseWorldArg('1.12.2:Island=')).toThrow(/<client>:<name>=<file>/);
    expect(() => parseWorldArg('Island=x.epk')).toThrow(/<client>:<name>=<file>/);
  });

  it('a name with nothing to spell an id from still gets one of its own', () => {
    const a = parseWorldArg('1.12.2:島=a.epk');
    const b = parseWorldArg('1.12.2:森=b.epk');
    expect(a.id).not.toBe(b.id);
    expect(a.id).toMatch(/^w[0-9a-f]+-1-12-2$/);
  });
});
