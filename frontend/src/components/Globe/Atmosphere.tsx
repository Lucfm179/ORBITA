import * as THREE from 'three';

export function Atmosphere() {
  return (
    <mesh>
      <sphereGeometry args={[1.015, 64, 64]} />
      <meshBasicMaterial color="#4da6ff" transparent opacity={0.12} side={THREE.BackSide} />
    </mesh>
  );
}
