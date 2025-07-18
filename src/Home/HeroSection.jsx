import { useState, useEffect, useCallback, useRef, memo } from "react";
import { motion } from "framer-motion";
import { FaGithub, FaLinkedinIn, FaEnvelope } from "react-icons/fa";
import { useTypewriter, Cursor } from "react-simple-typewriter";
import { useInView } from "react-intersection-observer";
import { useNavigate } from "react-router-dom";
import BackgroundEffect from "./BackgroundEffect";
import Navigation from "./Navbar";

const socialLinks = [
  {
    href: "https://github.com/tilakpatell",
    icon: FaGithub,
    label: "GitHub",
  },
  {
    href: "https://linkedin.com/in/tilakpatell",
    icon: FaLinkedinIn,
    label: "LinkedIn",
  },
  {
    href: "mailto:tilakny@gmail.com",
    icon: FaEnvelope,
    label: "Email",
  },
];

const SocialLink = memo(({ href, icon: Icon, label }) => (
  <motion.a
    href={href}
    whileHover={{ scale: 1.2, y: -2 }}
    whileTap={{ scale: 0.9 }}
    className="text-white/80 hover:text-white transition-colors duration-200 
             hover:shadow-lg p-2 rounded-full bg-black/20 backdrop-blur-sm transform-gpu"
    target="_blank"
    rel="noopener noreferrer"
    aria-label={label}
  >
    <Icon size={20} />
  </motion.a>
));

SocialLink.displayName = 'SocialLink';

const HeroSection = () => {
  const navigate = useNavigate(); 
  const [isScrolled, setIsScrolled] = useState(false);
  const rafRef = useRef(null);
  const [ref, inView] = useInView({
    threshold: 0.1,
    triggerOnce: true,
  });

  const handleScroll = useCallback(() => {
    if (rafRef.current) return;
    
    rafRef.current = requestAnimationFrame(() => {
      setIsScrolled(window.scrollY > 50);
      rafRef.current = null;
    });
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [handleScroll]);

  const [text] = useTypewriter({
    words: [
      "Embedded Software Developer",
      "High Performance Computing Researcher",
      "Avid Star Wars Fan",
      "Tech Enthusiast",
    ],
    loop: true,
    delaySpeed: 2000,
  });

  return (
    <section className="relative min-h-screen overflow-hidden">
      <BackgroundEffect />
      <Navigation isScrolled={isScrolled} />

      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/50 z-[1]" />

      <div className="relative z-10 container mx-auto px-4 h-screen">
        <div className="h-full flex flex-col justify-center items-center text-center">
          <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="max-w-4xl mx-auto backdrop-blur-sm px-4 sm:px-6 py-6 sm:py-8 rounded-2xl bg-black/20 transform-gpu"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-black/30 backdrop-blur-sm border border-white/20 mb-6 sm:mb-8"
            >
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs sm:text-sm text-white">Available for Work</span>
            </motion.div>

            <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-white via-white to-white/80 bg-clip-text text-transparent drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]">
              Building Digital
              <span className="block mt-2">Experiences</span>
            </h1>

            <div className="text-lg sm:text-xl md:text-3xl text-white h-16 sm:h-20 mb-2 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">
              <span>{text}</span>
              <Cursor cursorStyle="_" />
            </div>

            <p className="text-base sm:text-lg text-white/90 mb-8 sm:mb-12 max-w-2xl mx-auto drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)] px-4">
              Engineering intelligent and high-performance software solutions
              with modern technologies. Let's push
              the boundaries of innovation together.
            </p>

            <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 sm:gap-4 mb-8 sm:mb-12">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/projects')} 
                className="w-full sm:w-auto px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg bg-white text-black font-medium 
                         hover:bg-white/90 transition-colors duration-200 shadow-lg transform-gpu"
              >
                View Projects
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/contact')} 
                className="w-full sm:w-auto px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg border-2 border-white text-white 
                         hover:bg-white/10 transition-colors duration-200 shadow-lg transform-gpu"
              >
                Contact Me
              </motion.button>
            </div>

            <div className="flex justify-center gap-4 sm:gap-6">
              {socialLinks.map((link) => (
                <SocialLink key={link.href} {...link} />
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
