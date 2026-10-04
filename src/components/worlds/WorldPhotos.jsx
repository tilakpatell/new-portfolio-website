import Photo, { photoCredit } from '../Photo';

// Real places and things behind a world, each a freely licensed photo with
// its credit underneath. `items`: [{ id, title, note }], ids from photos.js.
export default function WorldPhotos({ items }) {
  const shown = items.filter((it) => photoCredit(it.id));
  if (!shown.length) return null;
  return (
    <ul className="world-photos">
      {shown.map((it, i) => {
        const c = photoCredit(it.id);
        return (
          <li key={it.id} className={i === 0 ? 'world-photo world-photo-lead' : 'world-photo'}>
            <figure className="m-0">
              <div className="world-photo-frame">
                <Photo id={it.id} sizes={i === 0 ? '(min-width: 1024px) 60vw, 100vw' : '(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw'} className="h-full w-full object-cover" />
              </div>
              <figcaption className="mt-3">
                <span className="block font-semibold text-ink">{it.title}</span>
                {it.note && <span className="mt-0.5 block text-sm text-body">{it.note}</span>}
                <span className="mt-1 block text-xs text-muted">
                  <a className="link" href={c.source} target="_blank" rel="noopener noreferrer">
                    Photo
                  </a>{' '}
                  by {c.author}
                  {c.license && (
                    <>
                      {', '}
                      {c.licenseUrl ? (
                        <a className="link" href={c.licenseUrl} target="_blank" rel="noopener noreferrer">
                          {c.license}
                        </a>
                      ) : (
                        c.license
                      )}
                    </>
                  )}
                </span>
              </figcaption>
            </figure>
          </li>
        );
      })}
    </ul>
  );
}
