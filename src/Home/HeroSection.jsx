import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import { FaGithub, FaLinkedinIn, FaEnvelope } from 'react-icons/fa';
import { useTypewriter, Cursor } from 'react-simple-typewriter';
import { useInView } from 'react-intersection-observer';
import { useNavigate } from 'react-router-dom';

const socialLinks = [
  { href: 'https://github.com/tilakpatell',      icon: FaGithub,     label: 'GitHub' },
  { href: 'https://linkedin.com/in/tilakpatell', icon: FaLinkedinIn, label: 'LinkedIn' },
  { href: 'mailto:tilakny@gmail.com',            icon: FaEnvelope,   label: 'Email' },
];

const SocialLink = memo(({ href, icon: Icon, label, index }) => (
  <motion.a
    href={href}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 1.8 + index * 0.1, duration: 0.4 }}
    whileHover={{ y: -2 }}
    className="w-10 h-10 flex items-center justify-center
               border border-white/15 hover:border-white/35
               bg-white/[0.04] hover:bg-white/[0.09]
               text-white/45 hover:text-white
               transition-all duration-250"
    target="_blank"
    rel="noopener noreferrer"
    aria-label={label}
  >
    <Icon size={15} />
  </motion.a>
));
SocialLink.displayName = 'SocialLink';

const HeroSection = () => {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const rafRef = useRef(null);
  const [ref, inView] = useInView({ threshold: 0.1, triggerOnce: true });

  const handleScroll = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      setIsScrolled(window.scrollY > 50);
      rafRef.current = null;
    });
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handleScroll]);

  const [text] = useTypewriter({
    words: [
      'Software Engineer Co-op @ Bose',
      'HPC Researcher @ Northeastern',
      'Avid Star Wars Fan',
      'Open Source Contributor',
      'Game Boy Emulator Author',
    ],
    loop: true,
    delaySpeed: 2000,
  });

  return (
    <section className="relative min-h-screen overflow-hidden flex items-center justify-center pt-14 sm:pt-16">

      {/* Ambient radial glow — adds depth behind content */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 55% 45% at 50% 46%, rgba(255,255,255,0.025) 0%, transparent 70%)',
        }}
      />

      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.018]"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Corner accents */}
      <div className="absolute top-5 left-5 sm:top-8 sm:left-8 pointer-events-none hidden sm:block">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="relative w-14 h-14"
        >
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-white/25 to-transparent" />
          <div className="absolute top-0 left-0 h-full w-px bg-gradient-to-b from-white/25 to-transparent" />
        </motion.div>
      </div>
      <div className="absolute bottom-5 right-5 sm:bottom-8 sm:right-8 pointer-events-none hidden sm:block">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.8 }}
          className="relative w-14 h-14"
        >
          <div className="absolute bottom-0 right-0 w-full h-px bg-gradient-to-l from-white/25 to-transparent" />
          <div className="absolute bottom-0 right-0 h-full w-px bg-gradient-to-t from-white/25 to-transparent" />
        </motion.div>
      </div>

      {/* Vertical side accents — wide screens */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.0, duration: 1 }}
        className="absolute left-[3vw] top-1/2 -translate-y-1/2 hidden xl:flex flex-col items-center gap-4 pointer-events-none"
      >
        <div className="w-px h-20 bg-gradient-to-b from-transparent via-white/[0.08] to-transparent" />
        <div className="w-1 h-1 border border-white/20 rotate-45" />
        <div className="w-px h-20 bg-gradient-to-b from-transparent via-white/[0.08] to-transparent" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 1 }}
        className="absolute right-[3vw] top-1/2 -translate-y-1/2 hidden xl:flex flex-col items-center gap-4 pointer-events-none"
      >
        <div className="w-px h-20 bg-gradient-to-b from-transparent via-white/[0.08] to-transparent" />
        <div className="w-1 h-1 border border-white/20 rotate-45" />
        <div className="w-px h-20 bg-gradient-to-b from-transparent via-white/[0.08] to-transparent" />
      </motion.div>

      {/* ── Main content ── */}
      <div ref={ref} className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 text-center">

        {/* Name heading */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.35, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6 sm:mb-7 hero-name-wrapper"
        >
          <h1
            className="font-display font-bold leading-[0.88] hero-name"
            style={{ fontSize: 'clamp(3.5rem, 12vw, 8.5rem)', letterSpacing: '0.07em' }}
          >
            TILAK PATEL
          </h1>
        </motion.div>

        {/* Glowing divider */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={inView ? { scaleX: 1, opacity: 1 } : {}}
          transition={{ delay: 0.65, duration: 0.6, ease: 'easeOut' }}
          className="hero-divider w-24 sm:w-28 mx-auto mb-7 sm:mb-8"
        />

        {/* Typewriter */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.85, duration: 0.5 }}
          className="h-8 mb-7 sm:mb-8 flex items-center justify-center"
        >
          <span className="text-sm sm:text-base font-medium tracking-wider text-white/70">
            {text}
          </span>
          <Cursor cursorStyle="|" cursorColor="rgba(255,255,255,0.45)" />
        </motion.div>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 1.0, duration: 0.5 }}
          className="text-[0.95rem] sm:text-lg text-white/45 max-w-lg mx-auto mb-10 sm:mb-12 leading-relaxed font-light"
        >
          Engineering intelligent and high-performance software solutions
          with modern technologies.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 1.2, duration: 0.5 }}
          className="flex flex-col sm:flex-row justify-center gap-3 mb-10 sm:mb-12"
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/projects')}
            className="btn-imperial-solid px-8 py-2.5"
          >
            View Projects
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/contact')}
            className="btn-imperial px-8 py-2.5"
          >
            Contact Me
          </motion.button>
        </motion.div>

        {/* Social links */}
        <div className="flex justify-center gap-2.5 pb-8">
          {socialLinks.map((link, i) => (
            <SocialLink key={link.href} {...link} index={i} />
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isScrolled ? 0 : 0.4 }}
        transition={{ delay: 2.2, duration: 0.8 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <motion.div
          animate={{ y: [0, 4, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="w-px h-8 bg-gradient-to-b from-transparent to-white/35"
        />
        <div className="w-1 h-1 bg-white/35 rotate-45" />
      </motion.div>
    </section>
  );
};

export default HeroSection;
