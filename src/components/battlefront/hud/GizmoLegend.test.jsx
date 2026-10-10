import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import GizmoLegend from './GizmoLegend.jsx';

describe('GizmoLegend', () => {
  it('names each kind with its colour and count, and hangs each label where it stands', () => {
    const html = renderToStaticMarkup(<GizmoLegend gizmos={{ legend: [{ kind: 'captures', count: 2, colour: '#4ce8f2' }], labels: [{ id: 'gizmo:a', label: 'FantasyBattle_Shapes:23', x: 10, y: 20 }] }} />);
    expect(html).toMatch(/capture points <span class="bf-num">2<\/span>/);
    expect(html).toMatch(/background:#4ce8f2/);
    expect(html).toMatch(/left:10px;top:20px[^>]*>FantasyBattle_Shapes:23/);
  });
});
