import { motion } from 'framer-motion';
import { useState } from 'react';
import { RiMailLine, RiGithubLine, RiLinkedinBoxLine, RiDownloadLine, RiSendPlaneLine } from 'react-icons/ri';

const ContactForm = () => {
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const mailtoUrl = `mailto:tilakny@gmail.com?subject=${encodeURIComponent(formState.subject)}&body=${encodeURIComponent(
      `Name: ${formState.name}\nEmail: ${formState.email}\n\n${formState.message}`
    )}`;
    
    window.location.href = mailtoUrl;
  };

  const handleChange = (e) => {
    setFormState(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-white/80 mb-2">Name</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formState.name}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-lg bg-white/10 border border-white/20 
                     text-white shadow-sm focus:border-saber-500 focus:ring-saber-500 focus:ring-2
                     placeholder:text-white/40 px-4 py-3 transition-all duration-200
                     focus:outline-none"
            placeholder="Your name"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-white/80 mb-2">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formState.email}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-lg bg-white/10 border border-white/20 
                     text-white shadow-sm focus:border-saber-500 focus:ring-saber-500 focus:ring-2
                     placeholder:text-white/40 px-4 py-3 transition-all duration-200
                     focus:outline-none"
            placeholder="your.email@example.com"
          />
        </div>
      </div>

      <div>
        <label htmlFor="subject" className="block text-sm font-medium text-white/80 mb-2">Subject</label>
        <input
          type="text"
          id="subject"
          name="subject"
          value={formState.subject}
          onChange={handleChange}
          required
          className="mt-1 block w-full rounded-lg bg-white/10 border border-white/20 
                   text-white shadow-sm focus:border-saber-500 focus:ring-saber-500 focus:ring-2
                   placeholder:text-white/40 px-4 py-3 transition-all duration-200
                   focus:outline-none"
          placeholder="Subject of your message"
        />
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium text-white/80 mb-2">Message</label>
        <textarea
          id="message"
          name="message"
          value={formState.message}
          onChange={handleChange}
          required
          rows={6}
          className="mt-1 block w-full rounded-lg bg-white/10 border border-white/20 
                   text-white shadow-sm focus:border-saber-500 focus:ring-saber-500 focus:ring-2
                   placeholder:text-white/40 px-4 py-3 transition-all duration-200
                   focus:outline-none resize-none min-h-[150px]"
          placeholder="Your message here..."
        />
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        type="submit"
        className="w-full px-8 py-4 rounded-lg bg-saber-600 text-white font-medium
                 hover:bg-saber-700 focus:outline-none focus:ring-2 focus:ring-saber-500
                 focus:ring-offset-2 focus:ring-offset-imperial-black transition-all duration-200
                 relative overflow-hidden group flex items-center justify-center gap-2
                 transform-gpu"
      >
        <RiSendPlaneLine className="w-5 h-5" />
        <span className="relative z-10">Send Message</span>
        <div className="absolute inset-0 bg-gradient-to-r from-saber-400 to-saber-600
                     opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </motion.button>
    </form>
  );
};

const ResumeDownload = () => {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = '/Resume.pdf';
    link.download = 'Tilak_Patel_Resume.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.button
      onClick={handleDownload}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="w-full block p-6 rounded-xl bg-white/10 border border-white/20 
               hover:border-saber-500/50 hover:bg-white/15 
               transition-all duration-300 group shadow-lg transform-gpu"
    >
      <div className="flex items-center gap-4">
        <div className="rounded-full bg-saber-500/20 p-3 flex-shrink-0">
          <RiDownloadLine className="w-8 h-8 text-saber-400" />
        </div>
        <div className="text-left flex-1 min-w-0">
          <h4 className="text-lg font-medium text-white truncate">Download Resume</h4>
          <p className="text-sm text-white/70">Get my complete professional background</p>
        </div>
      </div>
    </motion.button>
  );
};

const socialLinks = [
  {
    href: "mailto:tilakny@gmail.com",
    icon: RiMailLine,
    label: "Email",
    colorClass: "text-saber-400 hover:border-saber-500/50"
  },
  {
    href: "https://github.com/tilakpatell",
    icon: RiGithubLine,
    label: "GitHub",
    colorClass: "text-purple-400 hover:border-purple-500/50"
  },
  {
    href: "https://linkedin.com/in/tilakpatell",
    icon: RiLinkedinBoxLine,
    label: "LinkedIn",
    colorClass: "text-blue-400 hover:border-blue-500/50"
  }
];

const SocialLink = ({ href, icon: Icon, label, colorClass }) => (
  <motion.a
    href={href}
    target={href.startsWith('mailto:') ? '_self' : '_blank'}
    rel={href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
    whileHover={{ scale: 1.05, y: -3 }}
    whileTap={{ scale: 0.95 }}
    className={`flex items-center gap-3 px-6 py-4 rounded-lg bg-white/10 
             border border-white/20 hover:bg-white/15 transition-all duration-300 
             group shadow-md transform-gpu ${colorClass}`}
  >
    <Icon className="w-6 h-6 transition-colors duration-300 flex-shrink-0" />
    <span className="text-white/80 group-hover:text-white 
                  transition-colors duration-300 font-medium">
      {label}
    </span>
  </motion.a>
);

const ContactPage = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.1,
        delayChildren: 0.3
      }
    }
  };
  
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { duration: 0.5 }
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-black">
      <div className="fixed inset-0 z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover opacity-40"
        >
          <source src="/andor.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/70 to-black/90" />
      </div>  
      <div className="relative z-10">
        <div className="h-20" />
        <div className="container mx-auto px-4 py-12 lg:py-16">
          <motion.div 
            className="max-w-4xl mx-auto"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div 
              className="text-center mb-16"
              variants={itemVariants}
            >
              <h1 className="text-5xl md:text-6xl font-bold text-white mb-6
                          [text-shadow:_0_0_30px_rgba(9,103,210,0.5)]">
                Contact Me
              </h1>
              
              <motion.div
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="w-[120px] h-0.5 bg-gradient-to-r from-saber-500/30 via-saber-400/50 to-saber-500/30 mx-auto mb-4"
              />
              
              <p className="text-xl text-white/80">
                Laugh it up, fuzzball!
              </p>
            </motion.div>

            <motion.div 
              className="mb-16"
              variants={itemVariants}
            >
              <ResumeDownload />
            </motion.div>

            <motion.div 
              className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16"
              variants={itemVariants}
            >
              {socialLinks.map((link, index) => (
                <SocialLink
                  key={index}
                  href={link.href}
                  icon={link.icon}
                  label={link.label}
                  colorClass={link.colorClass}
                />
              ))}
            </motion.div>

            <motion.div 
              className="backdrop-blur-xl bg-black/50 p-8 md:p-10 rounded-2xl 
                        border border-white/20 shadow-2xl"
              variants={itemVariants}
            >
              <h2 className="text-2xl font-bold text-white mb-6">Send Me a Message</h2>
              <ContactForm />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </main>
  );
};

export default ContactPage;
