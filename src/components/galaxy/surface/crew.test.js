import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CREW, fileOf } from './crew';
import { faceOf, filesOf } from './crewList';

const at = (path) => new URL(`../../../../public${path}`, import.meta.url);

describe('the surfaces’ crew', () => {
  it('has a model in the site for each of them', () => {
    for (const [kind, c] of Object.entries(CREW)) for (const file of filesOf(c)) expect(existsSync(at(file)), `${kind}: ${file}`).toBe(true);
  });

  it('gives a kind with other faces each of them in turn', () => {
    expect([0, 1, 2, 3].map((i) => fileOf(faceOf(CREW.jedi, i)))).toEqual(['/models/galaxy/crew/jedi.glb', '/models/galaxy/crew/jedi2.glb', '/models/galaxy/crew/jedi3.glb', '/models/galaxy/crew/jedi.glb']);
    expect(faceOf(CREW.han, 3)).toBe(CREW.han);
  });

  it('has Luke and Leia, rigged on the same skeleton as Han, and Chewie, whose model is the cockpits’', () => {
    expect(fileOf(CREW.han)).toBe('/models/galaxy/crew/han.glb');
    expect(CREW.luke).toEqual({ url: '/models/galaxy/crew/luke.glb', tall: 1.72 });
    expect(CREW.leia).toEqual({ url: '/models/galaxy/crew/leia.glb', tall: 1.5 });
    expect(CREW.chewie).toMatchObject({ url: '/models/cockpit/chewie.glb', tall: 2.28 });
  });
});
