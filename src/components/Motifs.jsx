import { createContext, useContext } from 'react';
import { useOnceVisible } from './ui';
import Motif3D from './experience/Motif3D';

const SceneName = createContext(null);

// One small diagram per role, drawn from what the work actually was.
// Everything draws in once when it scrolls into view and then stays still.

function Frame({ label, caption, children }) {
  const ref = useOnceVisible('seen');
  const scene = useContext(SceneName);
  return (
    <figure className="panel overflow-hidden">
      <div ref={ref} className="motif">
        <svg viewBox="0 0 320 168" className="block h-auto w-full" role="img" aria-label={label}>
          {children}
        </svg>
        {scene && <Motif3D name={scene} />}
      </div>
      {caption && <figcaption className="mono border-t border-line px-4 py-2.5 text-xs text-muted">{caption}</figcaption>}
    </figure>
  );
}

const T = { fill: 'var(--muted)', fontSize: 7.5, letterSpacing: '0.06em' };
const line = { stroke: 'var(--border-strong)', strokeWidth: 1, fill: 'none' };

// AWS — rows of rack slots filling as servers are placed; one stale record flagged.
function Capacity() {
  const rows = 4;
  const cols = 13;
  const gpu = new Set([3, 4, 9, 17, 18, 22, 30, 31, 36, 44, 45]);
  const empty = new Set([12, 25, 38, 50, 51]);
  const stale = 28;
  return (
    <Frame label="Data-center rows with server slots being filled, one record flagged as stale" caption="Server placement · stale-data flags via MCP">
      {Array.from({ length: rows }).map((_, r) => (
        <g key={r}>
          <text x="14" y={34 + r * 32} style={T}>{`ROW ${String.fromCharCode(65 + r)}`}</text>
          {Array.from({ length: cols }).map((__, c) => {
            const i = r * cols + c;
            if (empty.has(i)) return <rect key={c} x={56 + c * 19} y={24 + r * 32} width="15" height="14" rx="3" style={{ ...line, strokeDasharray: '2 2' }} />;
            const isStale = i === stale;
            return (
              <rect
                key={c}
                className="m-fade"
                x={56 + c * 19}
                y={24 + r * 32}
                width="15"
                height="14"
                rx="3"
                style={{
                  '--d': `${(c + r * 3) * 18}ms`,
                  fill: isStale ? 'transparent' : gpu.has(i) ? 'var(--accent)' : 'color-mix(in srgb, var(--text) 18%, transparent)',
                  stroke: isStale ? 'var(--accent)' : 'none',
                  strokeDasharray: isStale ? '3 2' : undefined,
                }}
              />
            );
          })}
        </g>
      ))}
      <path className="m-fade" d="M 196 86 L 196 70 L 214 70 L 210 74 L 214 78 L 196 78" style={{ '--d': '500ms', fill: 'var(--accent)' }} />
      <text x="56" y="160" style={T}>■ GPU capacity   □ open slot   ⚑ stale record</text>
    </Frame>
  );
}

// RTX — the modernization value stream: milestones on a rule, workloads moving to cloud.
function Roadmap() {
  const stops = [
    { x: 30, label: 'DISCOVER' },
    { x: 115, label: 'ASSESS' },
    { x: 200, label: 'MIGRATE' },
    { x: 288, label: '2028' },
  ];
  return (
    <Frame label="Roadmap from discovery to 2028 with applications moving from on-prem to cloud" caption="Value stream → Xeta Cloud, targeting 2028">
      <path className="m-draw" pathLength="1" d="M 30 34 L 288 34" style={{ stroke: 'var(--accent)', strokeWidth: 3, fill: 'none' }} />
      {stops.map((s, i) => (
        <g key={s.label} className="m-fade" style={{ '--d': `${150 + i * 120}ms` }}>
          <path d={`M ${s.x} 26 L ${s.x + 7} 38 L ${s.x - 7} 38 Z`} style={{ fill: i === 3 ? 'var(--accent)' : 'var(--text)' }} />
          <text x={s.x} y="54" textAnchor="middle" style={T}>
            {s.label}
          </text>
        </g>
      ))}
      <rect x="14" y="74" width="292" height="36" style={{ ...line, strokeDasharray: '3 3' }} />
      <rect x="14" y="118" width="292" height="36" style={line} />
      <text x="20" y="86" style={T}>ON-PREM</text>
      <text x="20" y="130" style={T}>XETA CLOUD</text>
      {[0, 1, 2, 3, 4].map((a) => (
        <rect
          key={a}
          className="m-move"
          x={92 + a * 40}
          y="88"
          width="30"
          height="16"
          rx="2"
          style={{ '--d': `${450 + a * 100}ms`, '--to': a === 2 ? '0px' : '44px', fill: a === 2 ? 'color-mix(in srgb, var(--text) 25%, transparent)' : 'var(--text)' }}
        />
      ))}
    </Frame>
  );
}

// Bose — log levels feeding the three-phase analysis pipeline.
function Stream() {
  const phases = ['INGEST', 'ANALYZE', 'REPORT'];
  return (
    <Frame label="Device log levels feeding a three-phase analysis pipeline" caption="3-phase pipeline · 25+ tools · 60+ endpoints">
      <text x="14" y="22" style={T}>DEVICE LOG STREAM</text>
      {Array.from({ length: 22 }).map((_, i) => {
        const h = 20 + ((i * 37) % 44);
        return (
          <rect
            key={i}
            className="m-grow"
            x={14 + i * 6.5}
            y={108 - h}
            width="3.5"
            height={h}
            rx="1"
            style={{ '--d': `${i * 18}ms`, fill: i % 3 === 0 ? `var(--spec-${(i % 4) + 1}, var(--accent))` : 'color-mix(in srgb, var(--text) 65%, transparent)' }}
          />
        );
      })}
      {phases.map((p, i) => (
        <g key={p} className="m-fade" style={{ '--d': `${350 + i * 120}ms` }}>
          <rect x={14 + i * 104} y="122" width="84" height="30" rx="4" style={{ ...line, fill: i === 1 ? 'color-mix(in srgb, var(--accent) 16%, transparent)' : 'transparent', stroke: i === 1 ? 'var(--accent)' : 'var(--border-strong)' }} />
          <text x={56 + i * 104} y="141" textAnchor="middle" style={{ ...T, fill: 'var(--text)' }}>
            {p}
          </text>
          {i < 2 && <path d={`M ${100 + i * 104} 137 L ${116 + i * 104} 137`} style={{ stroke: 'var(--muted)', strokeDasharray: '3 3', fill: 'none' }} />}
        </g>
      ))}
    </Frame>
  );
}

// Pendar — a laser spectrum drawing in.
function Spectrum() {
  const d =
    'M 20 140 L 40 138 L 55 135 L 66 120 L 72 72 L 78 124 L 92 132 L 110 130 L 124 118 L 131 92 L 138 120 L 156 128 L 178 126 L 190 104 L 196 40 L 202 108 L 214 124 L 236 128 L 252 120 L 260 96 L 268 122 L 286 134 L 304 137';
  return (
    <Frame label="A laser spectrum with sharp peaks" caption="Real-time acquisition · overnight runs → CSV">
      <path d="M 20 146 L 304 146 M 20 146 L 20 18" style={line} />
      {[60, 100, 140, 180, 220, 260, 300].map((x) => (
        <path key={x} d={`M ${x} 146 L ${x} 150`} style={line} />
      ))}
      <path className="m-draw" pathLength="1" d={d} style={{ stroke: 'var(--accent)', strokeWidth: 1.8, fill: 'none', strokeLinejoin: 'round' }} />
      <text x="26" y="26" style={T}>INTENSITY</text>
      <text x="304" y="162" textAnchor="end" style={T}>
        WAVENUMBER
      </text>
    </Frame>
  );
}

// Empowerreg — complaint severity heatmap for medical-device risk analysis.
function Heatmap() {
  const rows = 6;
  const cols = 16;
  const v = (r, c) => {
    const x = Math.sin(r * 12.9898 + c * 78.233) * 43758.5453;
    const base = x - Math.floor(x);
    return r === 2 && c > 8 && c < 13 ? 0.95 : base * (0.35 + (c / cols) * 0.55);
  };
  return (
    <Frame label="Heatmap of complaint severity by device category" caption="FDA complaint severity · Grafana + Loki across 5+ services">
      <text x="14" y="20" style={T}>SEVERITY BY DEVICE CLASS</text>
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((__, c) => (
          <rect
            key={`${r}-${c}`}
            className="m-fade"
            x={14 + c * 18.3}
            y={30 + r * 19}
            width="15.5"
            height="15.5"
            rx="4"
            style={{ '--d': `${(r + c) * 14}ms`, fill: `color-mix(in srgb, var(--accent) ${Math.round(v(r, c) * 100)}%, var(--surface-2))` }}
          />
        )),
      )}
    </Frame>
  );
}

// SRC — knowledge-graph triplets on a radar field.
function Graph() {
  const nodes = [
    [160, 84, 'subject'],
    [96, 50],
    [226, 46, 'object'],
    [236, 120],
    [106, 128],
    [60, 92],
    [272, 82],
    [168, 140],
  ];
  const edges = [
    [0, 1], [0, 2], [0, 3], [0, 4], [1, 5], [2, 6], [3, 6], [4, 7], [3, 7],
  ];
  return (
    <Frame label="Radar rings and a knowledge graph of extracted triplets" caption="500+ radar documents → triplets → knowledge graph">
      {[30, 58, 86].map((r) => (
        <circle key={r} cx="160" cy="84" r={r} style={{ ...line, opacity: 0.6 }} />
      ))}
      <path d="M 160 84 L 236 40" style={{ stroke: 'var(--accent)', strokeWidth: 1, opacity: 0.55 }} />
      {edges.map(([a, b], i) => (
        <path
          key={i}
          className="m-draw"
          pathLength="1"
          d={`M ${nodes[a][0]} ${nodes[a][1]} L ${nodes[b][0]} ${nodes[b][1]}`}
          style={{ '--d': `${100 + i * 60}ms`, stroke: 'var(--text)', strokeWidth: 1, opacity: 0.7, fill: 'none' }}
        />
      ))}
      {nodes.map(([x, y, lbl], i) => (
        <g key={i} className="m-fade" style={{ '--d': `${i * 50}ms` }}>
          <circle cx={x} cy={y} r={i === 0 ? 6 : 4} style={{ fill: i === 0 || lbl ? 'var(--accent)' : 'var(--bg-deep)', stroke: 'var(--text)', strokeWidth: 1 }} />
          {lbl && (
            <text x={x} y={y - 10} textAnchor="middle" style={{ ...T, fill: 'var(--text)' }}>
              {lbl}
            </text>
          )}
        </g>
      ))}
      <text x="193" y="60" style={T}>relation</text>
    </Frame>
  );
}

const MOTIFS = { capacity: Capacity, roadmap: Roadmap, stream: Stream, spectrum: Spectrum, heatmap: Heatmap, graph: Graph };

export default function Motif({ name }) {
  const Component = MOTIFS[name];
  return Component ? (
    <SceneName.Provider value={name}>
      <Component />
    </SceneName.Provider>
  ) : null;
}
