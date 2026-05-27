import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { TextureLoader, Texture, Mesh } from 'three';
import { useStore } from '../../store/store';

interface EarthProps {
  simTimeRef: React.MutableRefObject<number>;
}

function EarthFallback({ simTimeRef }: EarthProps) {
  const meshRef = useRef<Mesh>(null!);
  useFrame(() => {
    if (meshRef.current && simTimeRef && simTimeRef.current) {
      const siderealDayMs = 86164090;
      const t = simTimeRef.current % siderealDayMs;
      meshRef.current.rotation.y = (t / siderealDayMs) * 2 * Math.PI;
    }
  });
  return (
    <group rotation={[0, 0, 0.41]}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshPhongMaterial color="#1a3a5c" emissive="#0a1a2e" emissiveIntensity={0.3} shininess={15} />
      </mesh>
    </group>
  );
}

export function Earth({ simTimeRef }: EarthProps) {
  const earthTextureMode = useStore((s) => s.earthTexture);
  const [dayTexture, setDayTexture] = useState<Texture | null>(null);
  const [nightTexture, setNightTexture] = useState<Texture | null>(null);
  const meshRef = useRef<Mesh>(null!);

  useEffect(() => {
    const loader = new TextureLoader();
    
    // Load Day Map
    loader.load(
      '/textures/2k_earth_daymap.jpg',
      (tex) => {
        setDayTexture(tex);
      },
      undefined,
      (err) => {
        console.warn("Failed to load day texture:", err);
      }
    );

    // Load Night Map
    loader.load(
      '/textures/8k_earth_nightmap.jpg',
      (tex) => {
        setNightTexture(tex);
      },
      undefined,
      (err) => {
        console.warn("Failed to load night texture:", err);
      }
    );
  }, []);

  useFrame(() => {
    if (meshRef.current && simTimeRef && simTimeRef.current) {
      const siderealDayMs = 86164090;
      const t = simTimeRef.current % siderealDayMs;
      meshRef.current.rotation.y = (t / siderealDayMs) * 2 * Math.PI;
    }
  });

  let activeTexture: Texture | null = null;
  if (earthTextureMode === 'day') {
    activeTexture = dayTexture;
  } else if (earthTextureMode === 'night') {
    activeTexture = nightTexture;
  }

  if (earthTextureMode === 'fallback' || !activeTexture) {
    return <EarthFallback simTimeRef={simTimeRef} />;
  }

  return (
    <group rotation={[0, 0, 0.41]}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshPhongMaterial map={activeTexture} shininess={15} />
      </mesh>
    </group>
  );
}
