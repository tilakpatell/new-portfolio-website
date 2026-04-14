import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useInView } from 'react-intersection-observer';
import {
  RiMailLine, RiGithubLine, RiLinkedinBoxLine,
  RiDownloadLine, RiSendPlaneLine, RiArrowRightUpLine, RiFileCopyLine, RiCheckLine,
} from 'react-icons/ri';

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

/* ── Form submission endpoint ────────────────────────────────────────────── *
 * Replace FORM_ID with a real Formspree ID from https://formspree.io       *
 * Or set to null to fall back to mailto:                                    */
const FORMSPREE_ID = null; // e.g. 'xpznqkdl'

const ContactForm = () => {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email format';
    if (!form.subject.trim()) e.subject = 'Subject is required';
    if (!form.message.trim()) e.message = 'Message is required';
    else if (form.message.trim().length < 10) e.message = 'Message too short (min 10 chars)';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    /* API submission if configured, otherwise mailto fallback */
    if (FORMSPREE_ID) {
      setStatus('sending');
      try {
        const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ name: form.name, email: form.email, subject: form.subject, message: form.message }),
        });
        if (res.ok) { setStatus('sent'); setForm({ name: '', email: '', subject: '', message: '' }); }
        else setStatus('error');
      } catch { setStatus('error'); }
    } else {
      /* mailto fallback */
      window.location.href = `mailto:tilakny@gmail.com?subject=${encodeURIComponent(
        form.subject)}&body=${encodeURIComponent(
        `Name: ${form.name}\nEmail: ${form.email}\n\n${form.message}`)}`;
      setStatus('sent');
    }
  };

  const handleChange = (e) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) setErrors(p => { const c = { ...p }; delete c[e.target.name]; return c; });
    if (status === 'sent' || status === 'error') setStatus('idle');
  };

  const inputCls = (field) => `w-full bg-white/[0.03] border text-white/90 text-sm placeholder:text-white/35
    px-4 py-2.5 transition-all duration-250 focus:outline-none focus:bg-white/[0.05]
    ${errors[field] ? 'border-red-400/40 focus:border-red-400/60' : 'border-white/[0.12] focus:border-white/30'}`;

  const labelCls = 'block text-xs font-medium text-white/45 mb-1.5 tracking-wide';

  if (status === 'sent') {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        className="text-center py-10 space-y-4">
        <div className="w-14 h-14 border border-white/20 mx-auto flex items-center justify-center">
          <RiSendPlaneLine className="w-6 h-6 text-white/60" />
        </div>
        <h3 className="font-display text-lg font-bold text-white/85">Message Sent</h3>
        <p className="text-sm text-white/45 max-w-xs mx-auto">
          {FORMSPREE_ID ? 'Your message has been delivered. I\'ll get back to you soon.' : 'Your email client should have opened. If not, email me directly at tilakny@gmail.com'}
        </p>
        <button onClick={() => setStatus('idle')} className="btn-imperial px-5 py-2 text-xs mt-2">
          Send Another
        </button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Name</label>
          <input type="text" name="name" value={form.name} onChange={handleChange}
            placeholder="Your name" className={inputCls('name')} />
          {errors.name && <p className="text-[0.68rem] text-red-400/60 mt-1">{errors.name}</p>}
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input type="email" name="email" value={form.email} onChange={handleChange}
            placeholder="your@email.com" className={inputCls('email')} />
          {errors.email && <p className="text-[0.68rem] text-red-400/60 mt-1">{errors.email}</p>}
        </div>
      </div>
      <div>
        <label className={labelCls}>Subject</label>
        <input type="text" name="subject" value={form.subject} onChange={handleChange}
          placeholder="What's this about?" className={inputCls('subject')} />
        {errors.subject && <p className="text-[0.68rem] text-red-400/60 mt-1">{errors.subject}</p>}
      </div>
      <div>
        <label className={labelCls}>Message</label>
        <textarea name="message" value={form.message} onChange={handleChange}
          rows={5} placeholder="Your message..."
          className={`${inputCls('message')} resize-none min-h-[120px]`} />
        <div className="flex items-center justify-between mt-1">
          {errors.message
            ? <p className="text-[0.68rem] text-red-400/60">{errors.message}</p>
            : <span />}
          <span className={`font-mono text-xs ${form.message.length > 0 ? 'text-white/40' : 'text-transparent'}`}>
            {form.message.length}
          </span>
        </div>
      </div>

      {status === 'error' && (
        <div className="border border-red-400/25 bg-red-400/5 px-4 py-2.5">
          <p className="text-xs text-red-400/70">Something went wrong. Please try again or email directly.</p>
        </div>
      )}

      <motion.button
        whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
        type="submit" disabled={status === 'sending'}
        className="w-full btn-imperial-solid px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'sending' ? (
          <>
            <div className="w-4 h-4 border border-black/30 border-t-black/80 rounded-full animate-spin" />
            <span>Sending...</span>
          </>
        ) : (
          <>
            <RiSendPlaneLine className="w-4 h-4" />
            <span>Send Message</span>
          </>
        )}
      </motion.button>
    </form>
  );
};

const socialLinks = [
  { href: 'mailto:tilakny@gmail.com',            icon: RiMailLine,        label: 'Email',    detail: 'tilakny@gmail.com' },
  { href: 'https://github.com/tilakpatell',      icon: RiGithubLine,      label: 'GitHub',   detail: '@tilakpatell' },
  { href: 'https://linkedin.com/in/tilakpatell', icon: RiLinkedinBoxLine, label: 'LinkedIn', detail: '/in/tilakpatell' },
];

const ContactPage = () => {
  const [headerRef, headerInView] = useInView({ threshold: 0.2, triggerOnce: true });
  const [contentRef, contentInView] = useInView({ threshold: 0.08, triggerOnce: true });
  const [copied, setCopied] = useState(null);

  const handleCopy = async (text, label) => {
    try { await navigator.clipboard.writeText(text); setCopied(label); setTimeout(() => setCopied(null), 2000); } catch {}
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = '/Resume.pdf';
    link.download = 'Tilak_Patel_Resume.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="relative min-h-screen">
      {/* Video background */}
      <div className="fixed inset-0 z-0">
        <video autoPlay loop muted playsInline className="w-full h-full object-cover opacity-[0.20]">
          <source src="/andor.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 80% 70% at 50% 50%, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.88) 100%)' }}
        />
      </div>

      <div className="relative z-10 pt-20 lg:pt-24 pb-20 sm:pb-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto">

            {/* Header — centered */}
            <div ref={headerRef} className="text-center mb-12 sm:mb-14">
              <motion.p
                initial={{ opacity: 0 }}
                animate={headerInView ? { opacity: 1 } : {}}
                className="section-label mb-3"
              >
                Get in Touch
              </motion.p>

              <motion.h1
                initial={{ opacity: 0, y: 15 }}
                animate={headerInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.1 }}
                className="font-display text-4xl sm:text-5xl font-bold text-white tracking-tight"
              >
                Contact Me
              </motion.h1>

              <div className="gold-line w-16 mx-auto mt-4" />

              <motion.p
                initial={{ opacity: 0 }}
                animate={headerInView ? { opacity: 1 } : {}}
                transition={{ delay: 0.2 }}
                className="text-sm text-white/50 mt-4"
              >
                {getGreeting()} — open to opportunities, collaborations, and conversations
              </motion.p>
            </div>

            <div ref={contentRef} className="space-y-4">

              {/* Resume download */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={contentInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.1 }}
              >
                <motion.button
                  onClick={handleDownload}
                  whileHover={{ scale: 1.005, y: -1 }}
                  className="w-full imperial-panel p-4 hover:border-white/[0.14] transition-all duration-300 group text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-white/[0.06] border border-white/[0.14]">
                      <RiDownloadLine className="w-5 h-5 text-white/55" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-white/75 group-hover:text-white/95 transition-colors">
                        Download Resume
                      </h4>
                      <p className="text-xs text-white/35 mt-0.5">Complete professional background</p>
                    </div>
                    <RiArrowRightUpLine className="w-4 h-4 text-white/15 group-hover:text-white/40 transition-colors" />
                  </div>
                </motion.button>
              </motion.div>

              {/* Social links */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={contentInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.18 }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3"
              >
                {socialLinks.map((link) => (
                  <motion.div
                    key={link.label}
                    whileHover={{ y: -2 }}
                    className="imperial-panel p-3.5 hover:border-white/[0.14] transition-all duration-300 group relative"
                  >
                    <a href={link.href}
                      target={link.href.startsWith('mailto:') ? '_self' : '_blank'}
                      rel={link.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
                      className="flex items-center gap-3"
                    >
                      <link.icon className="w-4 h-4 text-white/30 group-hover:text-white/55 transition-colors" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-white/55 group-hover:text-white/80 transition-colors">
                          {link.label}
                        </div>
                        <div className="text-xs text-white/42 mt-0.5 font-mono truncate">{link.detail}</div>
                      </div>
                    </a>
                    {/* Copy button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCopy(link.detail, link.label); }}
                      className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Copy"
                    >
                      <AnimatePresence mode="wait">
                        {copied === link.label ? (
                          <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                            <RiCheckLine className="w-3 h-3 text-green-400/60" />
                          </motion.div>
                        ) : (
                          <motion.div key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                            <RiFileCopyLine className="w-3 h-3 text-white/20 hover:text-white/50" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </button>
                  </motion.div>
                ))}
              </motion.div>

              {/* LinkedIn profile card */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={contentInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.22 }}
                className="imperial-panel overflow-hidden"
              >
                <div className="flex items-center justify-between px-5 py-2.5 border-b border-white/[0.06]">
                  <span className="font-mono text-xs tracking-[0.18em] text-white/35 uppercase">
                    ◈ LinkedIn Profile
                  </span>
                  <RiLinkedinBoxLine className="w-3.5 h-3.5 text-[#0A66C2]/50" />
                </div>
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <img src="/profile-pic.jpg" alt=""
                      className="w-14 h-14 object-cover border border-white/[0.10] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-display text-sm font-bold text-white/80 uppercase tracking-wide">Tilak Patel</h4>
                      <p className="text-xs text-white/45 mt-0.5 leading-relaxed">
                        Software Engineer Co-op @ Bose | CS @ Northeastern '27 | Systems, AI/ML, Backend
                      </p>
                      <div className="flex items-center gap-3 mt-2.5">
                        <span className="font-mono text-xs text-white/40">500+ connections</span>
                        <span className="text-white/25">|</span>
                        <span className="font-mono text-xs text-white/40">Boston, MA</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2.5 mt-4">
                    <a href="https://linkedin.com/in/tilakpatell" target="_blank" rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 py-2 border border-[#0A66C2]/30
                                 bg-[#0A66C2]/8 hover:bg-[#0A66C2]/15 transition-colors font-mono text-[0.58rem]
                                 text-[#0A66C2]/70 hover:text-[#0A66C2] uppercase tracking-wider">
                      <RiLinkedinBoxLine className="w-3.5 h-3.5" />
                      Connect
                    </a>
                    <a href="https://linkedin.com/in/tilakpatell" target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-4 py-2 border border-white/[0.08]
                                 hover:border-white/[0.18] transition-colors font-mono text-[0.58rem]
                                 text-white/35 hover:text-white/60 uppercase tracking-wider">
                      View Profile
                    </a>
                  </div>
                </div>
              </motion.div>

              {/* Contact form */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={contentInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.30 }}
                className="imperial-panel p-5 sm:p-7"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="white-line w-6" />
                  <h2 className="text-sm font-semibold text-white/55">Send a Message</h2>
                </div>
                <ContactForm />
              </motion.div>

            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default ContactPage;
