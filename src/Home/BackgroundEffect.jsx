import { memo, useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';

const IS_MOBILE = typeof window !== 'undefined' && window.innerWidth < 768;
const COUNT = IS_MOBILE ? 600 : 1500;

/* ── Star particles ──────────────────────────────────────────────────────── */

const StarField = () => {
  const ref = useRef();
  const mouse = useRef({ x: 0, y: 0 });

  const positions = useMemo(() => {
    const arr = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 32;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 32;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 16;
    }
    return arr;
  }, []);

  useEffect(() => {
    const move = (e) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', move, { passive: true });
    return () => window.removeEventListener('mousemove', move);
  }, []);

  useFrame((state, delta) => {
    if (!ref.current) return;
    const posAttr = ref.current.geometry.attributes.position;
    const arr = posAttr.array;

    for (let i = 0; i < COUNT; i++) {
      arr[i * 3 + 1] -= delta * 0.14;
      if (arr[i * 3 + 1] < -16) arr[i * 3 + 1] += 32;
    }
    posAttr.needsUpdate = true;

    const cam = state.camera;
    cam.position.x += (mouse.current.x * 0.5 - cam.position.x) * delta * 0.55;
    cam.position.y += (mouse.current.y * 0.3 - cam.position.y) * delta * 0.55;
    cam.lookAt(0, 0, 0);
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={COUNT}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#ffffff"
        size={0.055}
        transparent
        opacity={0.38}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
};

/* ── Background wrapper ──────────────────────────────────────────────────── */

const BackgroundEffect = memo(() => (
  <div className="fixed inset-0 overflow-hidden" style={{ zIndex: 0 }}>
    <div className="absolute inset-0 bg-[#050505]" />

    <Canvas
      camera={{ position: [0, 0, 8], fov: 60 }}
      dpr={[1, 1.5]}
      gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <color attach="background" args={['#050505']} />
      <StarField />
    </Canvas>

    {/* Vignette */}
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background:
          'radial-gradient(ellipse 65% 55% at 50% 50%, transparent 20%, rgba(0,0,0,0.85) 100%)',
      }}
    />
  </div>
));

BackgroundEffect.displayName = 'BackgroundEffect';
export default BackgroundEffect;
