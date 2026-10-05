import { memo } from 'react';
import MODELS from '../data/modelCredits.json';

// Who made the 3D models a page shows that aren't the site's own: each one's
// title, author, licence and where it came from, as the Creative Commons
// licences ask (and as the travel page does for its photos). The list is kept
// by scripts/sketchfab-batch.mjs, which reads it out of the downloads.
//
// `where`: the page ('universe', 'middle-earth'). As a list that opens, like
// the photo credits; or with `line`, as one sentence for a page with no room
// for a list.

const licence = (m) => m.license.replace(/^CC-BY-/, 'CC BY ').replace(/-/g, ' ');
const upper = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const out = { target: '_blank', rel: 'noopener noreferrer' };

export default memo(function ModelCredits({ where, line = false, className = '' }) {
  const list = Object.values(MODELS).filter((m) => m.where === where);
  if (!list.length) return null;
  if (line) {
    // one licence between them all is said once, at the end
    const shared = list.every((m) => m.license === list[0].license) ? list[0] : null;
    return (
      <p className={className}>
        {list.map((m, i) => (
          <span key={m.source}>
            {i === 0 ? upper(m.as) : m.as}{' '}
            by{' '}
            <a href={m.source} {...out}>
              {m.author}
            </a>
            {!shared && (
              <>
                {' '}
                (
                <a href={m.licenseUrl} {...out}>
                  {licence(m)}
                </a>
                )
              </>
            )}
            {i < list.length - 2 ? ', ' : i === list.length - 2 ? ' and ' : ''}
          </span>
        ))}
        {shared ? (
          <>
            , from Sketchfab (
            <a href={shared.licenseUrl} {...out}>
              {licence(shared)}
            </a>
            ), reduced for the web.
          </>
        ) : (
          ', from Sketchfab, reduced for the web.'
        )}
      </p>
    );
  }
  return (
    <details className={`credits ${className}`}>
      <summary>
        3D model credits <span>({list.length})</span>
      </summary>
      <ul>
        {list.map((m) => (
          <li key={m.source}>
            {upper(m.as)}:{' '}
            <a href={m.source} {...out}>
              {m.title}
            </a>{' '}
            by{' '}
            <a href={m.authorUrl} {...out}>
              {m.author}
            </a>
            ,{' '}
            <a href={m.licenseUrl} {...out}>
              {licence(m)}
            </a>
            , reduced for the web.
          </li>
        ))}
      </ul>
    </details>
  );
});
