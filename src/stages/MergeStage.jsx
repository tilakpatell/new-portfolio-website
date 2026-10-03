import { RiCheckLine, RiGitMergeLine, RiGitPullRequestLine } from 'react-icons/ri';
import { PhaseBar, StageWindow, useStagePlayer } from './StageKit';

// The life of the upstream contribution: branch, pull request, checks, merge.
const PHASES = [
  { id: 'main', ms: 1800, label: 'github/awesome-copilot — main' },
  { id: 'branch', ms: 2600, label: 'Fork and branch: error-recovery hooks + PyInstaller recipes' },
  { id: 'pr', ms: 2200, label: 'Open pull request #1388' },
  { id: 'checks', ms: 2400, label: 'Checks pass and the review is approved' },
  { id: 'merged', ms: 3400, label: 'Merged into github/awesome-copilot' },
];
const ORDER = PHASES.map((p) => p.id);
const MAIN = [40, 110, 180, 250, 330, 470, 560];
const BRANCH = [
  { x: 270, msg: 'add error-recovery hooks' },
  { x: 340, msg: 'add PyInstaller frozen-build recipe' },
  { x: 410, msg: 'docs: usage notes' },
];

export default function MergeStage() {
  const player = useStagePlayer(PHASES);
  const at = ORDER.indexOf(player.phase.id);
  const past = (id) => at >= ORDER.indexOf(id);
  const merged = past('merged');

  return (
    <div ref={player.ref}>
      <StageWindow title="git log --graph — github/awesome-copilot">
        <svg viewBox="0 0 640 190" className="block h-auto w-full" role="img" aria-label="Git graph: a branch with three commits merged into main">
          <path d="M 20 56 L 620 56" style={{ stroke: 'var(--border-strong)', strokeWidth: 2 }} />
          <path
            d="M 180 56 C 215 56, 225 136, 260 136 L 420 136"
            fill="none"
            pathLength="1"
            style={{ stroke: 'var(--accent)', strokeWidth: 2, strokeDasharray: 1, strokeDashoffset: past('branch') ? 0 : 1, transition: 'stroke-dashoffset 1.4s ease' }}
          />
          <path
            d="M 420 136 C 450 136, 440 56, 470 56"
            fill="none"
            pathLength="1"
            style={{ stroke: 'var(--accent)', strokeWidth: 2, strokeDasharray: 1, strokeDashoffset: merged ? 0 : 1, transition: 'stroke-dashoffset 1s ease' }}
          />
          {MAIN.map((x, i) => {
            const isMerge = x === 470;
            const visible = isMerge ? merged : x <= 330 || merged;
            return (
              <circle
                key={x}
                cx={x}
                cy="56"
                r={isMerge ? 8 : 6}
                style={{
                  fill: isMerge ? 'var(--accent)' : 'var(--bg-deep)',
                  stroke: isMerge ? 'var(--accent)' : 'var(--text)',
                  strokeWidth: 2,
                  opacity: visible ? 1 : 0,
                  transition: `opacity .4s ease ${i * 60}ms`,
                }}
              />
            );
          })}
          <text x="20" y="34" style={{ fill: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>main</text>
          {BRANCH.map((c, i) => (
            <g key={c.x} style={{ opacity: past('branch') ? 1 : 0, transition: `opacity .4s ease ${400 + i * 300}ms` }}>
              <circle cx={c.x} cy="136" r="6" style={{ fill: 'var(--bg-deep)', stroke: 'var(--accent)', strokeWidth: 2 }} />
              <text x={c.x} y={i % 2 ? 172 : 114} textAnchor="middle" style={{ fill: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                {c.msg}
              </text>
            </g>
          ))}
        </svg>
      </StageWindow>

      <div className="card stage-fade mt-4 p-5" data-on={past('pr') ? 'true' : 'false'}>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold"
            style={{ background: merged ? 'var(--accent)' : 'var(--surface-2)', color: merged ? 'var(--bg-deep)' : 'var(--text)' }}
          >
            {merged ? <RiGitMergeLine className="h-4 w-4" aria-hidden="true" /> : <RiGitPullRequestLine className="h-4 w-4" aria-hidden="true" />}
            {merged ? 'Merged' : 'Open'}
          </span>
          <p className="font-semibold text-ink">Add error recovery hooks and PyInstaller frozen build recipes</p>
          <span className="mono text-sm text-muted">#1388</span>
        </div>
        <p className="mono mt-2 text-xs text-muted">{merged ? 'aaronpowell merged tilakpatell’s commits into github:main' : 'tilakpatell wants to merge into github:main'}</p>
        <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
          {['validate-readme', 'build', 'Review approved'].map((c, i) => (
            <li key={c} className="flex items-center gap-2 text-body stage-fade" data-on={past('checks') ? 'true' : 'false'} style={{ transitionDelay: `${i * 250}ms` }}>
              <span className="grid h-5 w-5 place-items-center rounded-full" style={{ background: 'color-mix(in srgb, var(--accent) 22%, transparent)' }}>
                <RiCheckLine className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              </span>
              {c}
            </li>
          ))}
        </ul>
      </div>
      <PhaseBar phases={PHASES} {...player} />
    </div>
  );
}
