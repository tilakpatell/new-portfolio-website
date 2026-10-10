import { describe, expect, it, vi } from 'vitest';
import { STAND_INS, markBuilt, resolveFigure } from './cast';
import { CREW } from './crewList';
import { SURFACE_MODELS } from './catalog';

const fig = (name) => ({ model: { userData: {} }, name });
const none = async () => null;

describe('how a kind is drawn', () => {
  it('takes a walker, then a crew model, then a catalogue model, then a build, then a prop', async () => {
    const order = [];
    const step = (name, got) => async (k) => (order.push(name), got ? fig(`${name}:${k}`) : null);
    const out = await resolveFigure('x', { walker: step('walker'), crew: step('crew'), model: step('model'), built: step('built', true), prop: step('prop', true) });
    expect(out.name).toBe('built:x');
    expect(order).toEqual(['walker', 'crew', 'model', 'built']);
  });

  it('under the models-only cast never builds: it tries the files twice, then the stand-in', async () => {
    const crew = vi.fn(async (k) => (k === 'hothtrooper' ? fig('crew:hothtrooper') : null));
    const model = vi.fn(none);
    const built = vi.fn(async () => fig('built'));
    const out = await resolveFigure('rebel', { crew, model, built, prop: built }, { only: true, standIns: { rebel: 'hothtrooper' }, pause: async () => {} });
    expect(out.name).toBe('crew:hothtrooper');
    expect(built).not.toHaveBeenCalled();
    expect(crew.mock.calls.map((c) => c[0])).toEqual(['rebel', 'rebel', 'hothtrooper']);
  });

  it('under the models-only cast gives nothing, and says so, when no model will do', async () => {
    const warn = vi.fn();
    const built = vi.fn(async () => fig('built'));
    const out = await resolveFigure('wampa', { crew: none, model: none, built, prop: built }, { only: true, standIns: {}, warn, pause: async () => {} });
    expect(out).toBeNull();
    expect(built).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('wampa');
  });

  it('a maker that throws is a miss, not a crash', async () => {
    const boom = async () => {
      throw new Error('404');
    };
    const out = await resolveFigure('rebel', { crew: boom, model: boom, built: none, prop: none }, { only: true, standIns: {}, pause: async () => {} });
    expect(out).toBeNull();
  });

  it('marks a built figure', () => {
    expect(markBuilt(fig('a')).model.userData.built).toBe(true);
    expect(markBuilt(null)).toBeNull();
  });

  it('every stand-in is itself a model', () => {
    for (const [kind, to] of Object.entries(STAND_INS)) expect(Boolean(CREW[to] || SURFACE_MODELS[to]), `${kind} → ${to}`).toBe(true);
  });
  it('on a world that builds, a file that throws still fails the figure, as it always did', async () => {
    const boom = async () => {
      throw new Error('bad file');
    };
    await expect(resolveFigure('rebel', { crew: boom, model: none, built: async () => fig('built'), prop: none })).rejects.toThrow('bad file');
  });

  it('under the models-only cast, waits a moment before trying the files again', async () => {
    const pause = vi.fn(async () => {});
    await resolveFigure('wampa', { crew: none, model: none, built: none, prop: none }, { only: true, standIns: {}, pause });
    expect(pause).toHaveBeenCalledTimes(1);
  });
});
