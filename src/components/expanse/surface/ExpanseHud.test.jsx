import { describe, expect, it } from 'vitest';
import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import ExpanseHud, { screenAngle } from './ExpanseHud';

const refs = () => ({ speed: createRef(), water: createRef(), arrow: createRef(), moment: createRef() });

describe('screenAngle', () => {
  it('points up the screen for water straight ahead of the view (−x −z), right for (+x −z)', () => {
    expect(screenAngle(Math.atan2(-1, -1))).toBeCloseTo(0, 5);
    expect(screenAngle(Math.atan2(-1, 1))).toBeCloseTo(90, 5);
    expect(screenAngle(Math.atan2(1, 1))).toBeCloseTo(180, 5);
  });
});

describe('ExpanseHud', () => {
  it('shows the planet, the speed, the water compass and R to come back', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ExpanseHud name="Temperate planet 7" refs={refs()} way={{ label: 'Universe map', to: '/universe' }} onStick={() => {}} onRespawn={() => {}} onJump={() => {}} onBoost={() => {}} />
      </MemoryRouter>,
    );
    expect(html).toContain('Temperate planet 7');
    expect(html).toContain('km/h');
    expect(html).toContain('Looking for water');
    expect(html).toContain('to dry land');
    expect(html).not.toContain('Jump');
  });

  it('gives touch its stick and buttons', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ExpanseHud name="x" refs={refs()} touch onStick={() => {}} onRespawn={() => {}} onJump={() => {}} onBoost={() => {}} />
      </MemoryRouter>,
    );
    expect(html).toContain('Jump');
    expect(html).toContain('Boost');
  });
});
