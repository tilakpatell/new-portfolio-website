import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { fmtMonth } from '../data/roles';
import { entryMatches, resume, skillCount, skillPattern } from '../data/resume';
import '../styles/lazy/resumesheet.css';

// Wrap every match of the active skills in <mark>.
function Marked({ text, active }) {
  if (!active.length) return text;
  const source = active.map((s) => skillPattern(s).source).join('|');
  const re = new RegExp(`(${source})`, 'g');
  const parts = text.split(re).filter((p) => p !== undefined && p !== '');
  return parts.map((p, i) => (active.some((s) => new RegExp(`^(?:${skillPattern(s).source})$`).test(p)) ? <mark key={i}>{p}</mark> : <Fragment key={i}>{p}</Fragment>));
}

function Entry({ entry, active, preview, children }) {
  const lit = active.length > 0 && entryMatches(entry, active);
  const dim = active.length > 0 && !lit;
  return (
    <div className="resume-entry" data-lit={lit || undefined} data-dim={dim || undefined}>
      {children}
      <ul className="resume-bullets">
        {entry.bullets.map((b) => (
          <li key={b} data-dim={active.length > 0 && !active.some((s) => skillPattern(s).test(b)) ? 'true' : undefined}>
            {preview ? b : <Marked text={b} active={active} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

// The résumé as a page. `active` is the list of selected skills; `onToggle`
// makes the skills clickable. `preview` renders a static copy (for thumbnails).
export default function ResumeSheet({ active = [], onToggle, preview = false }) {
  const r = resume;
  const H = preview ? 'p' : 'h2';
  return (
    <article className={`resume-sheet ${preview ? 'is-preview' : ''}`} aria-label={preview ? undefined : 'Résumé'}>
      <header className="text-center">
        {preview ? <p className="resume-name">{r.name}</p> : <h2 className="resume-name">{r.name}</h2>}
        <p className="resume-contact">
          {r.contact.map((c, i) => (
            <Fragment key={c.label}>
              {i > 0 && <span aria-hidden="true"> | </span>}
              {preview ? <span>{c.label}</span> : <a href={c.href}>{c.label}</a>}
            </Fragment>
          ))}
        </p>
      </header>

      <section className="resume-section">
        <H className="resume-h">Technical skills</H>
        <dl className="resume-skills">
          {r.skills.map((g) => (
            <div key={g.id}>
              <dt>{g.label}:</dt>{' '}
              <dd>
                {g.items.map((skill, i) => {
                  const on = active.includes(skill);
                  const count = preview ? 0 : skillCount(skill);
                  return (
                    <Fragment key={skill}>
                      {i > 0 && ', '}
                      {preview || !onToggle ? (
                        <span>{skill}</span>
                      ) : (
                        <button
                          type="button"
                          className="resume-skill"
                          aria-pressed={on}
                          onClick={() => onToggle(skill)}
                          title={count ? `${count} line${count === 1 ? '' : 's'} on this page` : 'Listed skill; no single line names it'}
                        >
                          {skill}
                        </button>
                      )}
                    </Fragment>
                  );
                })}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="resume-section">
        <H className="resume-h">Experience</H>
        {r.experience.map((e) => (
          <Entry key={e.id} entry={e} active={active} preview={preview}>
            <div className="resume-row">
              {preview ? <strong>{e.title}</strong> : <Link to={e.link} className="resume-title">{e.title}</Link>}
              <span>{e.where}</span>
            </div>
            <div className="resume-row resume-sub">
              <em>{e.subtitle}</em>
              <em>{e.when}</em>
            </div>
          </Entry>
        ))}
      </section>

      <section className="resume-section">
        <H className="resume-h">Projects and research</H>
        {r.projects.map((p) => (
          <Entry key={p.id} entry={p} active={active} preview={preview}>
            <div className="resume-row">
              <span>
                {preview ? <strong>{p.title}</strong> : <Link to={p.link} className="resume-title">{p.title}</Link>}
                {p.note && <span className="font-semibold"> ({p.note})</span>}
                <span className="resume-stack"> | {p.stackLine}</span>
              </span>
              {p.source && !preview && (
                <a href={p.source} target="_blank" rel="noopener noreferrer" className="resume-link">
                  GitHub
                </a>
              )}
            </div>
          </Entry>
        ))}
      </section>

      <section className="resume-section">
        <H className="resume-h">Education</H>
        <div className="resume-entry">
          <div className="resume-row">
            <strong>{r.education.school}</strong>
            <span>{r.education.location}</span>
          </div>
          <div className="resume-row resume-sub">
            <em>
              {r.education.degree} | GPA: {r.education.gpa}
            </em>
            <em>{fmtMonth(r.education.graduation)}</em>
          </div>
          <p className="resume-course">
            <strong>Coursework:</strong> {r.education.coursework.join(', ')}
          </p>
        </div>
      </section>
    </article>
  );
}
