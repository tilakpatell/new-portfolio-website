// The last word: why he's here, his photos with it (when they've opened).
// The catalogue ends with it, and so does the tour: it's the panel at the
// friendship wall over the island.
export default function Tribute({ tribute, photos, className = '', id = 'dk-tribute-title' }) {
  return (
    <section className={`dk-tribute ${className}`} aria-labelledby={id}>
      <p className="dk-eyebrow">The last exhibit</p>
      <h2 id={id} className="dk-h2">
        {tribute.title}
      </h2>
      {tribute.lines.map((l) => (
        <p key={l} className="dk-tribute-line">
          {l}
        </p>
      ))}
      <p className="dk-tribute-from">— {tribute.from}</p>
      {photos.length > 0 && (
        <ul className="dk-polaroids">
          {photos.map((p, i) => (
            <li key={p.url} style={{ '--tilt': `${(i % 2 ? 1 : -1) * (1.5 + (i % 3))}deg` }}>
              <img src={p.url} alt={p.caption || 'A photo of him'} width={p.w} height={p.h} loading="lazy" />
              {p.caption && <span>{p.caption}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

