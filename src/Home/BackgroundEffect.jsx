const BackgroundEffect = () => {
  return (
    <div className="fixed inset-0 h-full w-full overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url("/planet-bg.jpg")',
          opacity: 0.7
        }}
      />

      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `radial-gradient(2px 2px at 20px 30px, rgba(255, 255, 255, 0.95) 50%, rgba(0,0,0,0)),
                           radial-gradient(2px 2px at 40px 70px, rgba(255, 255, 255, 0.9) 50%, rgba(0,0,0,0)),
                           radial-gradient(2px 2px at 50px 160px, rgba(255, 255, 255, 0.8) 50%, rgba(0,0,0,0))`,
          backgroundSize: '200px 200px'
        }}
      />

      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-imperial-black/30 to-imperial-black/80" />
    </div>
  );
};

export default BackgroundEffect;
