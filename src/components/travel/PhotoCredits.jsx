import { PHOTOS } from '../../data/photos';

// Every photo on the site with its author, licence and source. Required by the
// Creative Commons licences, and simply the right thing to do.
export default function PhotoCredits() {
  const entries = Object.entries(PHOTOS).filter(([, p]) => p.credit && p.alt);
  const baps = entries.filter(([, p]) => p.credit.author === 'BAPS Swaminarayan Sanstha');
  const commons = entries.filter(([, p]) => p.credit.author !== 'BAPS Swaminarayan Sanstha');
  return (
    <section id="credits" className="shell relative z-10 scroll-mt-28 pb-24 pt-6" aria-labelledby="credits-title">
      <details className="credits">
        <summary>
          <h2 id="credits-title" className="inline text-base font-semibold text-ink">
            Photo credits
          </h2>
          <span className="ml-2 text-sm text-muted">({entries.length})</span>
        </summary>
        <p className="mt-4 max-w-[70ch] text-sm leading-relaxed text-body">
          The mandir photos are courtesy of BAPS Swaminarayan Sanstha. The landscapes are freely licensed photos from Wikimedia Commons, standing in until I add my own.
        </p>
        <ul className="mt-4 grid gap-2 text-sm leading-relaxed text-body md:grid-cols-2 md:gap-x-10">
          {[...baps, ...commons].map(([id, p]) => (
            <li key={id}>
              <a className="link" href={p.credit.source} target="_blank" rel="noopener noreferrer">
                {p.credit.title || p.alt}
              </a>
              {' by '}
              {p.credit.author}
              {p.credit.license && (
                <>
                  {', '}
                  {p.credit.licenseUrl ? (
                    <a className="link" href={p.credit.licenseUrl} target="_blank" rel="noopener noreferrer">
                      {p.credit.license}
                    </a>
                  ) : (
                    p.credit.license
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
