import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FaGithub, FaLinkedinIn, FaEnvelope } from "react-icons/fa";
import { useTypewriter, Cursor } from "react-simple-typewriter";
import { useInView } from "react-intersection-observer";
import { useNavigate } from "react-router-dom"; // Add this import
import BackgroundEffect from "./BackgroundEffect";
import Navigation from "./Navbar";

const socialLinks = [
  {
    href: "https://github.com/tilakpatell",
    icon: <FaGithub size={20} />,
    label: "GitHub",
  },
  {
    href: "https://linkedin.com/in/tilakpatell",
    icon: <FaLinkedinIn size={20} />,
    label: "LinkedIn",
  },
  {
    href: "mailto:tilakny@gmail.com",
    icon: <FaEnvelope size={20} />,
    label: "Email",
  },
];

const HeroSection = () => {
  const navigate = useNavigate(); 
  const [isScrolled, setIsScrolled] = useState(false);
  const [ref, inView] = useInView({
    threshold: 0.1,
    triggerOnce: true,
  });

  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 50;
      setIsScrolled(isScrolled);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
            className="max-w-4xl mx-auto backdrop-blur-sm px-6 py-8 rounded-2xl bg-black/20"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/30 backdrop-blur-sm border border-white/20 mb-8"
            >
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-sm text-white">Available for Work</span>
            </motion.div>

            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-white to-white/80 bg-clip-text text-transparent drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]">
              Building Digital
              <span className="block mt-2">Experiences</span>
            </h1>

            <div className="text-xl md:text-3xl text-white h-20 mb-2 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">
              <span>{text}</span>
              <Cursor cursorStyle="_" />
            </div>

            <p className="text-lg text-white/90 mb-12 max-w-2xl mx-auto drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">
              Engineering intelligent and high-performance software solutions
              with modern technologies. Let's push
              the boundaries of innovation together.
            </p>

            <div className="flex flex-wrap justify-center gap-4 mb-12">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/projects')} 
                className="px-8 py-3 rounded-lg bg-white text-black font-medium 
                         hover:bg-white/90 transition-colors duration-200 shadow-lg"
              >
                View Projects
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/contact')} 
                className="px-8 py-3 rounded-lg border-2 border-white text-white 
                         hover:bg-white/10 transition-colors duration-200 shadow-lg"
              >
                Contact Me
              </motion.button>
            </div>

            <div className="flex justify-center gap-6">
              {socialLinks.map((link) => (
                <motion.a
                  key={link.href}
                  href={link.href}
                  whileHover={{ scale: 1.2, y: -2 }}
                  whileTap={{ scale: 0.9 }}
                  className="text-white/80 hover:text-white transition-colors duration-200 
                           hover:shadow-lg p-2 rounded-full bg-black/20 backdrop-blur-sm"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.label}
                >
                  {link.icon}
                </motion.a>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
