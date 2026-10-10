import { describe, expect, it } from 'vitest';
import { Document } from '@gltf-transform/core';
import { clipName, dropLoaderNotes, renameClips, toMetres } from './fbx.mjs';

describe('an FBX pack’s clips', () => {
  it('are named for the action alone, without the armature', () => {
    expect(clipName('Armature|Walk')).toBe('Walk');
    expect(clipName('Armature|WalkSlow')).toBe('WalkSlow');
    expect(clipName('Idle')).toBe('Idle');
  });

  it('are renamed so in the GLB itself, in their order', () => {
    const doc = new Document();
    for (const name of ['Armature|Idle', 'Armature|Jump', 'Walk']) doc.createAnimation(name);
    expect(renameClips(doc)).toEqual(['Idle', 'Jump', 'Walk']);
    expect(doc.getRoot().listAnimations().map((a) => a.getName())).toEqual(['Idle', 'Jump', 'Walk']);
  });

  it('may not come to one name twice', () => {
    const doc = new Document();
    doc.createAnimation('Armature|Idle');
    doc.createAnimation('Rig|Idle');
    expect(() => renameClips(doc)).toThrow(/two clips named Idle/);
  });
});

describe('an FBX pack’s units', () => {
  it('are made metres at the scene’s root by its unit scale factor, once', () => {
    const doc = new Document();
    const root = doc.createNode().setScale([1, 1, 2]).setExtras({ unitScaleFactor: 1, kept: true });
    doc.createScene().addChild(root);
    expect(toMetres(doc)).toBe(0.01);
    expect(root.getScale()).toEqual([0.01, 0.01, 0.02]);
    expect(root.getExtras()).toEqual({ kept: true });
    // (the factor is gone, so a second pass leaves it be)
    expect(toMetres(doc)).toBe(1);
    expect(root.getScale()).toEqual([0.01, 0.01, 0.02]);
  });

  it('leaves a file already in metres as it is', () => {
    const doc = new Document();
    const root = doc.createNode().setExtras({ unitScaleFactor: 100 });
    doc.createScene().addChild(root);
    expect(toMetres(doc)).toBe(1);
    expect(root.getScale()).toEqual([1, 1, 1]);
  });
});

describe('an FBX pack’s nodes', () => {
  it('lose the notes FBXLoader keeps on each, and keep any other extra', () => {
    const doc = new Document();
    const notes = { originalName: 'Horse', transformData: { eulerOrder: 'ZYX', scale: [100, 100, 100] } };
    const root = doc.createNode('Horse').setExtras({ ...notes, kept: 1 });
    const bone = doc.createNode('Bone').setExtras({ originalName: 'Bone' });
    const plain = doc.createNode('Plain').setExtras({ part: 'main' });
    doc.createScene().addChild(root.addChild(bone).addChild(plain));
    expect(dropLoaderNotes(doc)).toBe(2);
    expect(root.getExtras()).toEqual({ kept: 1 });
    expect(bone.getExtras()).toEqual({});
    expect(plain.getExtras()).toEqual({ part: 'main' });
    // (nothing left to take, the second time)
    expect(dropLoaderNotes(doc)).toBe(0);
  });
});
