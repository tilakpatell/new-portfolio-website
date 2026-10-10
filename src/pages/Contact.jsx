import { useRef, useState } from 'react';
import PageTitle from '../components/PageTitle';
import { RiDownloadLine, RiGithubFill, RiLinkedinBoxFill, RiMailLine, RiArrowRightUpLine } from 'react-icons/ri';
import RouteLine from '../components/RouteLine';
import { CopyButton, Waypoint } from '../components/ui';
import { useAchievements } from '../components/Achievements';
import { education, profile } from '../data/profile';
import { fmtMonth } from '../data/roles';
import { useDocumentTitle } from '../lib/hooks';
import { checkMessage, firstInvalid } from '../lib/contact';
import { useFun } from '../fun/FunProvider';
import { AurebeshLine } from '../components/Wordmark';
import Egg from '../components/Egg';
import PaperPlane from '../components/contact/PaperPlane';

// Without a clipboard, the address opens in the visitor's mail app instead.
const mailTo = (address) => {
  window.location.href = `mailto:${address}`;
};

function MessageForm() {
  const { twss } = useFun();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [errors, setErrors] = useState({});
  const [opened, setOpened] = useState(false);

  const submit = (ev) => {
    ev.preventDefault();
    const e = checkMessage(form);
    setErrors(e);
    // (to the first field that's wrong, where its message is read out with it)
    const first = firstInvalid(e);
    if (first) {
      ev.currentTarget.elements.namedItem(first)?.focus();
      return;
    }
    if (/that'?s what she said|\btwss\b/i.test(form.message)) twss();
    const subject = form.subject.trim() || `Hello from ${form.name.trim()}`;
    const body = `${form.message.trim()}\n\n- ${form.name.trim()}${form.email.trim() ? ` (${form.email.trim()})` : ''}`;
    window.location.href = `mailto:${profile.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setOpened(true);
    // the paper airplane by the heading takes off with it
    window.dispatchEvent(new Event('tp:memo-sent'));
  };

  const field = (name) => ({
    id: `f-${name}`,
    name,
    value: form[name],
    onChange: (e) => {
      setForm((f) => ({ ...f, [name]: e.target.value }));
      if (errors[name])
        setErrors((prev) => {
          const next = { ...prev };
          delete next[name];
          return next;
        });
    },
    'aria-invalid': errors[name] ? 'true' : undefined,
    'aria-describedby': errors[name] ? `f-${name}-err` : undefined,
    className: `w-full rounded-panel border bg-[var(--bg-deep)] px-4 py-3 text-ink placeholder:text-[var(--muted)] transition-colors focus:border-[var(--accent)] ${
      errors[name] ? 'border-[color:var(--danger)]' : 'border-line-strong'
    }`,
  });
  const label = 'mb-2 block text-sm font-medium text-ink';
  const err = (name) =>
    errors[name] && (
      <p id={`f-${name}-err`} className="mt-1.5 text-sm text-[color:var(--danger)]">
        {errors[name]}
      </p>
    );

  return (
    <form onSubmit={submit} noValidate className="card memo-form grid gap-5 p-6 sm:p-8">
      <div className="memo-top">
        <p className="memo-head" data-tour="contact-form">Dunder Mifflin Paper Company · Interoffice memo</p>
        <p className="mt-3 text-sm text-ink">
          <span className="font-semibold">To:</span> Tilak Patel
        </p>
        <p className="mt-1 text-sm text-muted">This opens your email app with the memo filled in. Nothing is sent from this page.</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="f-name" className={label}>
            From <span className="font-normal text-muted">(your name)</span>
          </label>
          <input type="text" autoComplete="name" {...field('name')} />
          {err('name')}
        </div>
        <div>
          <label htmlFor="f-email" className={label}>
            Reply to <span className="font-normal text-muted">(optional)</span>
          </label>
          <input type="email" autoComplete="email" {...field('email')} />
          {err('email')}
        </div>
      </div>
      <div>
        <label htmlFor="f-subject" className={label}>
          Re <span className="font-normal text-muted">(optional)</span>
        </label>
        <input type="text" {...field('subject')} />
      </div>
      <div>
        <label htmlFor="f-message" className={label}>
          Message
        </label>
        <textarea rows={6} {...field('message')} className={`${field('message').className} resize-y`} />
        {err('message')}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="btn btn-primary">
          <RiMailLine className="h-4 w-4" aria-hidden="true" /> Send the memo
        </button>
        {opened && (
          <p className="text-sm text-muted" role="status">
            Your email app should have opened. If it didn’t, write to {profile.email}.
          </p>
        )}
      </div>
    </form>
  );
}

export default function Contact() {
  useDocumentTitle('Contact');
  const page = useRef(null);
  const { unlock } = useAchievements();
  const rows = [
    { icon: RiLinkedinBoxFill, label: 'LinkedIn', value: `in/${profile.linkedin.handle}`, href: profile.linkedin.url },
    { icon: RiGithubFill, label: 'GitHub', value: `github.com/${profile.github.handle}`, href: profile.github.url },
  ];

  return (
    <div ref={page} className="relative">
      <RouteLine containerRef={page} />
      <header className="shell relative z-10 pb-12 pt-[var(--page-top)]">
        <div className="relative">
          <Waypoint top="0.6rem" />
          <p className="eyebrow">Contact</p>
          <PageTitle className="display display-1 mt-6">Let’s talk.</PageTitle>
          <p className="mt-3 text-sm text-muted">
            <AurebeshLine>Let’s talk.</AurebeshLine>
          </p>
          <p className="lead mt-6 max-w-2xl">
            Email is the fastest way to reach me about roles, projects or anything on this site. I’m graduating in{' '}
            {fmtMonth(education.graduation)} with a {education.degree} from {education.school}.
          </p>
        </div>
        <PaperPlane />
      </header>

      <section className="shell section-last relative z-10" aria-label="Ways to reach me">
        <Egg id="hologram" className="egg-corner" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
          <Waypoint top="1.6rem" />
          <div className="grid content-start gap-4">
            <div className="card p-6">
              <p className="label">Email</p>
              <a href={`mailto:${profile.email}`} className="link-hover stretch-semi mt-3 block break-all text-[clamp(1.25rem,1rem+1vw,1.75rem)] font-semibold text-ink">
                {profile.email}
              </a>
              <div className="mt-5 flex flex-wrap gap-3">
                <CopyButton text={profile.email} label="Copy email address" onFail={mailTo} data-tour="contact-copy" />
              </div>
            </div>
            {rows.map((r) => (
              <a key={r.label} href={r.href} target="_blank" rel="noopener noreferrer" className="card card-lift group flex items-center gap-4 p-5">
                <r.icon className="h-6 w-6 flex-none text-ink" aria-hidden="true" />
                <span className="flex-1">
                  <span className="label block">{r.label}</span>
                  <span className="mt-1 block text-ink">{r.value}</span>
                </span>
                <RiArrowRightUpLine className="h-5 w-5 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
              </a>
            ))}
            <a href={profile.resume.href} download={profile.resume.filename} onClick={() => unlock('resume')} className="card card-lift group flex items-center gap-4 p-5">
              <RiDownloadLine className="h-6 w-6 flex-none text-ink" aria-hidden="true" />
              <span className="flex-1">
                <span className="label block">Résumé</span>
                <span className="mt-1 block text-ink">{profile.resume.filename}</span>
              </span>
            </a>
          </div>
          <MessageForm />
        </div>
      </section>
    </div>
  );
}
