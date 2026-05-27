import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { TextureLoader, Texture, Mesh } from 'three';

function EarthFallback() {
  const meshRef = useRef<Mesh>(null!);
  useFrame(() => {
    if (meshRef.current) meshRef.current.rotation.y += 0.0002;
  });
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 64, 64]} />
      <meshPhongMaterial color="#1a3a5c" emissive="#0a1a2e" emissiveIntensity={0.3} shininess={15} />
    </mesh>
  );
}

export function Earth() {
  const [texture, setTexture] = useState<Texture | null>(null);
  const [hasError, setHasError] = useState(false);
  const meshRef = useRef<Mesh>(null!);

  useEffect(() => {
    const loader = new TextureLoader();
    loader.load(
      '/textures/earth_day_2k.jpg',
      (tex) => {
        setTexture(tex);
      },
      undefined,
      () => {
        setHasError(true);
      }
    );
  }, []);

  useFrame(() => {
    if (meshRef.current) meshRef.current.rotation.y += 0.0002;
  });

  if (hasError || !texture) {
    return <EarthFallback />;
  }

  return (
    <group rotation={[0, 0, 0.41]}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshPhongMaterial map={texture} shininess={15} />
      </mesh>
    </group>
  );
}
