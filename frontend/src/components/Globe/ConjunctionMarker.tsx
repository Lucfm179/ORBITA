import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function ConjunctionMarker({ position }: { position: [number, number, number] }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  
  useFrame(({ clock }) => {
    if (meshRef.current) {
      const s = 0.02 + Math.sin(clock.elapsedTime * 4) * 0.008;
      meshRef.current.scale.setScalar(s);
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshBasicMaterial color="#ff3366" transparent opacity={0.9} />
    </mesh>
  );
}
