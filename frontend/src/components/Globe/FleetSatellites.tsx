import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface Props {
  positionsRef: React.MutableRefObject<Float32Array>;
  positionsState: Float32Array;
  fleetData: React.MutableRefObject<Array<{ norad_id: number; name: string; isFleet: boolean }>>;
}

export function FleetSatellites({ positionsRef, positionsState, fleetData }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  const fleetSats = useMemo(() => {
    return fleetData.current.filter(s => s.isFleet);
  }, [fleetData.current]);
  
  const count = Math.max(fleetSats.length, 1);

  useFrame(() => {
    if (!meshRef.current || positionsRef.current.length === 0) return;
    const fleetCount = Math.min(positionsRef.current.length / 3, count);
    for (let i = 0; i < fleetCount; i++) {
      dummy.position.set(
        positionsRef.current[i * 3],
        positionsRef.current[i * 3 + 1],
        positionsRef.current[i * 3 + 2]
      );
      dummy.scale.setScalar(0.025); // Slightly larger for visibility
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </instancedMesh>
      
      {/* Labels rendered via Html */}
      {fleetSats.map((sat, i) => {
        const idx = i * 3;
        const x = positionsState[idx] || 0;
        const y = positionsState[idx + 1] || 0;
        const z = positionsState[idx + 2] || 0;
        
        // Don't render labels at the origin
        if (x === 0 && y === 0 && z === 0) return null;

        return (
          <Html
            key={sat.norad_id}
            position={[x, y + 0.05, z]}
            style={{
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              fontSize: '10px',
              color: '#3fe6d6',
              fontFamily: 'Chakra Petch',
              fontWeight: 600,
              textShadow: '0 0 8px rgba(63,230,214,0.6)',
              letterSpacing: '0.05em',
              background: 'rgba(4, 6, 15, 0.85)',
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid rgba(63, 230, 214, 0.3)'
            }}
          >
            {sat.name}
          </Html>
        );
      })}
    </>
  );
}

