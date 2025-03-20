import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bars3Icon as MenuIcon, XMarkIcon as XIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { 
  RiHomeLine, 
  RiRocketLine, 
  RiMedalLine,
  RiMailLine,
  RiGithubLine,
  RiLinkedinBoxLine,
} from 'react-icons/ri';

const NavItem = ({ to, item, icon: Icon, index }) => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="relative group"
    >
      <button
        onClick={() => navigate(to)}
        className="flex items-center gap-2 text-white/90 hover:text-brand-400 transition-all cursor-pointer
                 relative py-3 px-4 group"
      >
        <span className="relative">
          <Icon className="w-5 h-5 group-hover:animate-pulse" />
          <span className="absolute inset-0 blur-lg bg-brand-400/30 opacity-0 
                        group-hover:opacity-100 transition-opacity duration-300" />
        </span>
        
        <span className="relative z-10 text-sm font-medium tracking-wide">{item}</span>
        
        <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-gradient-to-r from-brand-400 via-accent-400 to-brand-400 
                      transition-all duration-500 ease-out group-hover:w-full" />
        
        <span className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 
                      transition-all duration-300 bg-gradient-to-r from-brand-400/5 to-accent-400/5" />
      </button>
    </motion.div>
  );
};

const SocialIcon = ({ href, icon: Icon, label }) => (
  <motion.a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.95 }}
    className="relative group p-2"
    aria-label={label}
  >
    <Icon className="w-5 h-5 text-white/70 group-hover:text-brand-400 transition-colors duration-300" />
    <span className="absolute inset-0 blur-md bg-brand-400/20 opacity-0 
                  group-hover:opacity-100 transition-opacity duration-300" />
  </motion.a>
);

export default function Navigation({ isScrolled }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const navigate = useNavigate();

  const navItems = [
    { name: 'Home', icon: RiHomeLine, to: '/' },
    { name: 'Projects', icon: RiRocketLine, to: '/projects' },
    { name: 'Experience', icon: RiMedalLine, to: '/experience' },
    { name: 'Contact', icon: RiMailLine, to: '/contact' }
  ];

  const socialLinks = [
    { href: "https://github.com/tilakpatell", icon: RiGithubLine, label: "GitHub" },
    { href: "https://linkedin.com/in/tilakpatell", icon: RiLinkedinBoxLine, label: "LinkedIn" },
  ];

  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = (window.scrollY / totalScroll) * 100;
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled ? 'bg-neutral-950/80 backdrop-blur-xl' : 'bg-transparent'
      }`}
    >
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-brand-400/50 to-transparent" />
      
      <motion.div 
        className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-brand-400 to-accent-400"
        style={{ width: `${scrollProgress}%` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      />

      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative group cursor-pointer"
            onClick={() => navigate('/')}
          >
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 rounded-lg bg-gradient-to-tr from-brand-400 to-accent-400 blur-md animate-pulse" />
                <div className="relative flex items-center justify-center w-full h-full rounded-lg bg-neutral-950/50 border border-white/10">
                  <span className="text-xl font-bold text-white">TP</span>
                </div>
              </div>
              
              <span className="text-2xl font-bold bg-gradient-to-r from-brand-400 to-accent-400 
                           bg-clip-text text-transparent">
                Portfolio
              </span>
            </div>
          </motion.div>

          <div className="hidden md:flex items-center">
            <div className="flex items-center space-x-1">
              {navItems.map((item, index) => (
                <NavItem 
                  key={item.name} 
                  item={item.name} 
                  icon={item.icon} 
                  to={item.to}
                  index={index} 
                />
              ))}
            </div>
            
            <div className="mx-4 h-8 w-[1px] bg-gradient-to-b from-transparent via-white/10 to-transparent" />
            
            <div className="flex items-center gap-2">
              {socialLinks.map((link) => (
                <SocialIcon key={link.href} {...link} />
              ))}
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="md:hidden relative group p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <div className="relative">
              <span className="relative z-10 text-white/90">
                {isMenuOpen ? <XIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
              </span>
              <span className="absolute inset-0 blur-lg bg-brand-400/20 opacity-0 
                           group-hover:opacity-100 transition-opacity duration-300" />
            </div>
          </motion.button>
        </div>

        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="md:hidden overflow-hidden"
            >
              <div className="px-2 py-4 space-y-1 backdrop-blur-xl bg-neutral-950/90 
                           rounded-2xl border border-white/10 shadow-lg mb-4">
                {navItems.map((item, index) => (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <button
                      onClick={() => {
                        navigate(item.to);
                        setIsMenuOpen(false);
                      }}
                      className="flex items-center gap-3 px-4 py-3 text-white/90 
                               hover:text-brand-400 rounded-lg relative group
                               transition-all duration-300 w-full text-left"
                    >
                      <item.icon className="w-5 h-5" />
                      <span>{item.name}</span>
                    </button>
                  </motion.div>
                ))}
                
                <div className="flex items-center gap-4 px-4 py-3 mt-4 border-t border-white/10">
                  {socialLinks.map((link) => (
                    <SocialIcon key={link.href} {...link} />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  );
}
