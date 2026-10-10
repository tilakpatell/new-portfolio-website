import { Link } from 'react-router-dom';
import { InstallBar } from './InstallCard';
import { sizeText, timeText } from './usePack';
import './installed.css';

// The worlds on this device (/worlds): each with its size and Remove, and
// the rest with Install, so a world can be fetched whole before going in.
// rows: [{ to, label, bytes, installed, current, busy, progress, error }]
export default function InstalledList({ rows, onInstall, onRemove }) {
  const on = rows.filter((r) => r.installed);
  const off = rows.filter((r) => !r.installed);
  return (
    <div className="installed">
      <section aria-labelledby="installed-on">
        <h3 id="installed-on" className="label">
          On this device
        </h3>
        {on.length ? (
          <ul className="installed-list">
            {on.map((r) => (
              <li key={r.to} className="installed-row" data-world={r.to}>
                <div className="installed-name">
                  <Link to={r.to}>{r.label}</Link>
                  <span className="installed-size">{sizeText(r.bytes)}</span>
                  {!r.current && <span className="installed-note">an older build: Install brings it up to date</span>}
                </div>
                <div className="installed-actions">
                  {!r.current && !r.busy && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => onInstall(r.to)}>
                      Install
                    </button>
                  )}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRemove(r.to)} aria-label={`Remove ${r.label}`}>
                    Remove
                  </button>
                </div>
                {r.busy && <InstallBar progress={r.progress} pack={r} label={`Installing ${r.label}`} />}
              </li>
            ))}
          </ul>
        ) : (
          <p className="installed-empty">No world is installed yet. Install one below, or from its own page, and it opens from here after, without the wait.</p>
        )}
      </section>
      {off.length > 0 && (
        <section aria-labelledby="installed-off" className="mt-10">
          <h3 id="installed-off" className="label">
            Ready to install
          </h3>
          <ul className="installed-list">
            {off.map((r) => (
              <li key={r.to} className="installed-row" data-world={r.to}>
                <div className="installed-name">
                  <Link to={r.to}>{r.label}</Link>
                  <span className="installed-size">
                    {sizeText(r.bytes)} · {timeText(r.bytes)}
                  </span>
                  {r.error && (
                    <span className="installed-note" role="alert">
                      {r.error}
                    </span>
                  )}
                </div>
                <div className="installed-actions">
                  {!r.busy && (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => onInstall(r.to)} aria-label={`Install ${r.label}`}>
                      {r.error ? 'Try again' : 'Install'}
                    </button>
                  )}
                </div>
                {r.busy && <InstallBar progress={r.progress} pack={r} label={`Installing ${r.label}`} />}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
