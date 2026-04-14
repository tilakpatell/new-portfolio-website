import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  RiRocketLine, RiMedalLine, RiMailLine, RiTerminalBoxLine,
  RiGithubLine, RiLinkedinBoxLine, RiMenuLine, RiCloseLine,
} from 'react-icons/ri';

const navItems = [
  { name: 'Projects',   icon: RiRocketLine,      to: '/projects' },
  { name: 'Experience', icon: RiMedalLine,       to: '/experience' },
  { name: 'Terminal',   icon: RiTerminalBoxLine, to: '/terminal' },
  { name: 'Contact',    icon: RiMailLine,        to: '/contact' },
];

const socialLinks = [
  { href: 'https://github.com/tilakpatell',      icon: RiGithubLine,      label: 'GitHub' },
  { href: 'https://linkedin.com/in/tilakpatell', icon: RiLinkedinBoxLine, label: 'LinkedIn' },
];

export default function Navigation({ isScrolled }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const progressRef = useRef(null);
  const navigate    = useNavigate();
  const location    = useLocation();
  const rafRef      = useRef(null);

  const updateScrollProgress = useCallback(() => {
    if (progressRef.current) {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      progressRef.current.style.width = `${total > 0 ? (window.scrollY / total) * 100 : 0}%`;
    }
  }, []);

  useEffect(() => {
    const onScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateScrollProgress);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [updateScrollProgress]);

  useEffect(() => { setIsMenuOpen(false); }, [location.pathname]);

  const isActive = (path) =>
    path === '/' ? (location.pathname === '/' || location.hash === '#/')
                 : (location.pathname === path || location.hash === `#${path}`);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled
        ? 'bg-black/95 backdrop-blur-xl border-b border-white/[0.10]'
        : 'bg-transparent'
    }`}>

      {/* Scroll progress line */}
      <div
        ref={progressRef}
        className="absolute bottom-0 left-0 h-[1px] transition-none"
        style={{ width: '0%', background: 'rgba(255,255,255,0.50)' }}
      />

      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 lg:h-16">

          {/* Logo — Imperial Crest + name */}
          <motion.button
            onClick={() => navigate('/')}
            whileTap={{ scale: 0.97 }}
            className="group flex items-center gap-2.5"
          >
            <img
              src="/imperial-emblem.png"
              alt="Imperial Emblem"
              className="w-6 h-6 sm:w-7 sm:h-7 opacity-30 group-hover:opacity-55 transition-opacity duration-300 invert"
            />
            <span className="font-display font-bold text-white tracking-[0.10em] text-base sm:text-lg
                             group-hover:text-white/75 transition-colors duration-200 uppercase">
              Tilak Patel
            </span>
          </motion.button>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-0">
            {navItems.map((item) => {
              const active = isActive(item.to);
              return (
                <button
                  key={item.name}
                  onClick={() => navigate(item.to)}
                  className={`relative px-4 py-2 font-display font-semibold text-sm
                              tracking-[0.08em] uppercase transition-colors duration-200
                              ${active ? 'text-white' : 'text-white/45 hover:text-white/80'}`}
                >
                  {item.name}
                  {active && (
                    <motion.div
                      layoutId="nav-underline"
                      className="absolute bottom-0 left-4 right-4 h-[1px] bg-white/60"
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                  )}
                </button>
              );
            })}

            <div className="mx-3 h-4 w-px bg-white/[0.12]" />

            {socialLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={link.label}
                className="p-2.5 text-white/30 hover:text-white/65 transition-colors duration-200"
              >
                <link.icon className="w-4 h-4" />
              </a>
            ))}
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 text-white/55 hover:text-white/85 transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <RiCloseLine className="w-5 h-5" /> : <RiMenuLine className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.20, ease: 'easeInOut' }}
            className="md:hidden overflow-hidden border-t border-white/[0.08]"
          >
            <div className="bg-black/98 backdrop-blur-xl px-4 py-3 space-y-0.5">
              {navItems.map((item, idx) => {
                const active = isActive(item.to);
                return (
                  <motion.button
                    key={item.name}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    onClick={() => navigate(item.to)}
                    className={`w-full flex items-center gap-3 px-3 py-3
                                font-display font-semibold text-sm tracking-[0.08em] uppercase
                                transition-colors duration-150 border-l-2
                                ${active
                                  ? 'text-white border-white/50 bg-white/[0.04]'
                                  : 'text-white/45 border-transparent hover:text-white/75 hover:bg-white/[0.03]'}`}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span>{item.name}</span>
                  </motion.button>
                );
              })}
              <div className="flex gap-0 pt-2 mt-1 border-t border-white/[0.07]">
                {socialLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 text-white/35 hover:text-white/65 transition-colors"
                  >
                    <link.icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
