import { memo } from 'react';
import MODELS from '../data/modelCredits.json';

// Who made the 3D models a page shows that aren't the site's own: each one's
// title, author, licence and where it came from, as the Creative Commons
// licences ask (and as the travel page does for its photos). The list
// (data/modelCredits.json) is kept by scripts/sketchfab-batch.mjs, which reads
// it out of the downloads; the universe map's Star Wars models, which
// scripts/build-universe.py makes, are in it by hand.
//
// `where`: the page ('universe', 'middle-earth', 'galaxy': a model one page
// shares with another says so in its `also`). As a list that opens, like
// the photo credits; or with `line`, as one sentence for a page with no room
// for a list. `only`: just the ones in these files (what's on screen now).

const licence = (m) => (m.license === 'permission' ? 'used with permission' : m.license.replace(/^CC-/, 'CC ').replace(/-(\d)/, ' $1')); // 'CC-BY-NC-SA-4.0' → 'CC BY-NC-SA 4.0'
// where they came from: Sketchfab, or (a Battlefront II remaster model, its author's permission) the mod
const from = (m) => (m.license === 'permission' ? 'from the Battlefront 2 Remaster' : 'from Sketchfab');
const upper = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const out = { target: '_blank', rel: 'noopener noreferrer' };

export default memo(function ModelCredits({ where, only = null, line = false, className = '' }) {
  const shown = Object.values(MODELS).filter((m) => (m.where === where || m.also?.includes(where)) && (!only || only.includes(m.file)));
  // (one model used twice, as the galaxy's Y-wing in space and on the ground, is credited once)
  const list = shown.filter((m, i) => shown.findIndex((n) => n.source === m.source && n.as === m.as) === i);
  if (!list.length) return null;
  if (line) {
    // one licence between them all is said once, at the end
    const shared = list.every((m) => m.license === list[0].license) ? list[0] : null;
    return (
      <p className={className}>
        {list.map((m, i) => (
          <span key={`${m.source}-${m.as}`}>
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
            , {from(shared)} (
            <a href={shared.licenseUrl} {...out}>
              {licence(shared)}
            </a>
            ), reduced for the web.
          </>
        ) : (
          ', reduced for the web.'
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
          <li key={`${m.source}-${m.as}`}>
            {upper(m.as)}:{' '}
            <a href={m.source} {...out}>
              {m.title}
            </a>{' '}
            by{' '}
            <a href={m.authorUrl} {...out}>
              {m.author}
            </a>
            ,{' '}
            <a href={m.licenseUrl} {...out} title={m.permission}>
              {licence(m)}
            </a>
            , reduced for the web.
          </li>
        ))}
      </ul>
    </details>
  );
});
