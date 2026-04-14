import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useRef, useMemo, useEffect, memo, useState } from 'react';
import * as THREE from 'three';

/* ── Camera ─────────────────────────────────────────────────────────────── */
const CAM_Z = 9;
const FOV   = 42;
const TAN_H = Math.tan((FOV / 2) * Math.PI / 180);
const TEXT_HALF_PX = 384;

/* ── Layout ─────────────────────────────────────────────────────────────── */
const getConfig = () => {
  const w = typeof window !== 'undefined' ? window.innerWidth  : 1200;
  const h = typeof window !== 'undefined' ? window.innerHeight : 800;
  if (w < 1280) return null;

  const ar   = w / h;
  const eZ   = -5;                     // pushed back to reduce perspective distortion
  const dist = CAM_Z - eZ;             // 14
  const rE   = TAN_H * dist * ar;
  const textR = 2 * TEXT_HALF_PX * TAN_H * dist / h;

  const pad   = 0.6;
  const avail = rE - textR - pad;
  if (avail < 2.0) return null;

  const eR = Math.min(3.2, avail / 2.9);
  const eX = textR + pad + 1.7 * eR + (avail - 2.9 * eR) / 2;

  return {
    eR, ePos: [eX, -0.15, eZ],
    dsR: eR * 0.2, orbitR: eR * 1.7,
    seg: 48, dpr: [1, 1.5],
  };
};

/* ═══════════════════════════════════════════════════════════════════════════
   EARTH
   ═══════════════════════════════════════════════════════════════════════════ */
const Earth = ({ radius, seg, meshRef }) => {
  const earthMap = useMemo(() => {
    const t = new THREE.TextureLoader().load('/earth-texture.jpg');
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[radius, seg, seg]} />
      <meshStandardMaterial map={earthMap} roughness={0.85} metalness={0.05} />
    </mesh>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   DEATH STAR — dish on +Z so lookAt(Earth) points it correctly
   ═══════════════════════════════════════════════════════════════════════════ */
const DeathStarMesh = ({ radius }) => {
  const lats = useMemo(() => {
    const out = [];
    for (let j = -3; j <= 3; j++) {
      if (j === 0) continue;
      const a = (j / 4) * (Math.PI * 0.42);
      const r = radius * Math.cos(a);
      const y = radius * Math.sin(a);
      if (r > 0.04) out.push({ r, y });
    }
    return out;
  }, [radius]);

  const dishR = radius * 0.3;

  return (
    <group>
      {/* Wireframe body */}
      <mesh>
        <icosahedronGeometry args={[radius, 3]} />
        <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.09} />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[radius * 1.005, 2]} />
        <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.035} />
      </mesh>

      {/* Equatorial trench */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius * 1.003, radius * 0.012, 6, 48]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
      </mesh>

      {/* Latitude rings */}
      {lats.map((l, i) => (
        <mesh key={i} position={[0, l.y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[l.r * 1.002, radius * 0.006, 4, 36]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.14} />
        </mesh>
      ))}

      {/* Dish — placed on +Z pole so lookAt(Earth) points it at the planet */}
      <group position={[0, 0, radius * 0.96]}>
        <mesh>
          <ringGeometry args={[dishR * 0.85, dishR, 24]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.22} side={THREE.DoubleSide} />
        </mesh>
        <mesh>
          <ringGeometry args={[dishR * 0.45, dishR * 0.55, 20]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.12} side={THREE.DoubleSide} />
        </mesh>
        <mesh>
          <circleGeometry args={[dishR * 0.12, 12]} />
          <meshStandardMaterial
            color="#001a0e" emissive="#22ff55"
            emissiveIntensity={0.7} roughness={0.1} side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   SCENE
   ═══════════════════════════════════════════════════════════════════════════ */
const Scene = ({ config }) => {
  const { camera, gl } = useThree();
  const earthRef  = useRef();
  const dsRef     = useRef();     // orbit position group
  const dsSpinRef = useRef();     // body spin

  /* ── Drag-to-rotate ─────────────────────────────────────────────────── */
  const dragging  = useRef(false);
  const prevMouse = useRef({ x: 0, y: 0 });
  const rotVel    = useRef({ x: 0, y: 0 });

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndcVec    = useMemo(() => new THREE.Vector2(), []);
  const sphere    = useMemo(
    () => new THREE.Sphere(new THREE.Vector3(...config.ePos), config.eR * 1.1),
    [config.ePos, config.eR],
  );

  const isOverEarth = (e) => {
    const rect = gl.domElement.getBoundingClientRect();
    ndcVec.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndcVec, camera);
    return raycaster.ray.intersectsSphere(sphere);
  };

  useEffect(() => {
    const down = (e) => {
      if (isOverEarth(e)) {
        dragging.current = true;
        prevMouse.current = { x: e.clientX, y: e.clientY };
        rotVel.current = { x: 0, y: 0 };
        document.body.style.cursor = 'grabbing';
        e.preventDefault();
      }
    };
    const move = (e) => {
      if (dragging.current && earthRef.current) {
        const dx = (e.clientX - prevMouse.current.x) * 0.005;
        const dy = (e.clientY - prevMouse.current.y) * 0.005;
        earthRef.current.rotation.y += dx;
        earthRef.current.rotation.x = Math.max(-1.2, Math.min(1.2,
          earthRef.current.rotation.x + dy));
        rotVel.current = { x: dx, y: dy };
        prevMouse.current = { x: e.clientX, y: e.clientY };
      } else if (!dragging.current) {
        document.body.style.cursor = isOverEarth(e) ? 'grab' : '';
      }
    };
    const up = () => {
      if (dragging.current) { dragging.current = false; document.body.style.cursor = ''; }
    };

    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.cursor = '';
    };
  }, [config]);

  /* ── Orbit ──────────────────────────────────────────────────────────── */
  const TILT  = 0.35;
  const SPEED = 0.12;
  const ECC_A = 1.0;
  const ECC_B = 0.75;
  const orbitAngle = useRef(0);

  useFrame((_, dt) => {
    if (earthRef.current && !dragging.current) {
      rotVel.current.x *= 0.97;
      rotVel.current.y *= 0.97;
      earthRef.current.rotation.y += dt * 0.012 + rotVel.current.x;
      earthRef.current.rotation.x += rotVel.current.y;
      earthRef.current.rotation.x = Math.max(-1.2, Math.min(1.2,
        earthRef.current.rotation.x));
    }

    if (dsRef.current) {
      const oR = config.orbitR;
      const d = 1.0 - 0.12 * Math.cos(orbitAngle.current);
      orbitAngle.current += SPEED * dt / (d * d);
      const a = orbitAngle.current;

      const lx = oR * ECC_A * Math.cos(a);
      const ly = oR * ECC_B * Math.sin(a);
      const wx = lx;
      const wy = ly * Math.cos(TILT);
      const wz = -ly * Math.sin(TILT);

      dsRef.current.position.set(wx, wy, wz);
    }

    /* DS body spins slowly on its own axis */
    if (dsSpinRef.current) {
      dsSpinRef.current.rotation.y += dt * 0.08;
    }
  });

  return (
    <>
      <ambientLight intensity={0.12} />
      <directionalLight position={[6, 4, 5]} intensity={0.85} color="#ffffff" />
      <directionalLight position={[-5, 1, -2]} intensity={0.04} color="#334466" />

      <group position={config.ePos}>
        <Earth radius={config.eR} seg={config.seg} meshRef={earthRef} />
        <mesh rotation={[TILT, 0, 0]} scale={[ECC_A, ECC_B, 1]}>
          <torusGeometry args={[config.orbitR, 0.006, 4, 120]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.035} />
        </mesh>
        <group ref={dsRef}>
          <group ref={dsSpinRef}>
            <DeathStarMesh radius={config.dsR} />
          </group>
        </group>
      </group>
    </>
  );
};

/* ── Canvas — only mounts on wide screens ───────────────────────────────── */
const HeroCanvas = memo(() => {
  const [config, setConfig] = useState(getConfig);

  useEffect(() => {
    const onResize = () => setConfig(getConfig());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!config) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-[1]">
      <Canvas
        camera={{ position: [0, 0, CAM_Z], fov: FOV }}
        dpr={config.dpr}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <Scene config={config} />
      </Canvas>
    </div>
  );
});

HeroCanvas.displayName = 'HeroCanvas';
export default HeroCanvas;
