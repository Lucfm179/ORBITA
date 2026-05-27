import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import * as satellite from 'satellite.js';

interface SatData {
  satrec: satellite.SatRec;
  norad_id: number;
  name: string;
  isFleet: boolean;
  object_type: string;
}

interface Props {
  positions: Float32Array;
  colors: Float32Array;
  catalogSatsRef: React.MutableRefObject<SatData[]>;
  simTimeRef: React.MutableRefObject<number>;
}

export function CatalogCloud({ positions, colors, catalogSatsRef, simTimeRef }: Props) {
  const geoRef = useRef<THREE.BufferGeometry>(null!);

  useEffect(() => {
    if (geoRef.current && positions.length > 0 && colors.length > 0) {
      geoRef.current.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3));
      geoRef.current.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geoRef.current.computeBoundingSphere();
    }
  }, [positions, colors]);

  useFrame(() => {
    if (!geoRef.current || !catalogSatsRef.current.length || !simTimeRef || !simTimeRef.current) return;

    const attr = geoRef.current.getAttribute('position') as THREE.BufferAttribute;
    if (!attr) return;

    const array = attr.array as Float32Array;
    const sats = catalogSatsRef.current;

    for (let i = 0; i < sats.length; i++) {
      const sat = sats[i];
      const satrec = sat.satrec;
      
      // Calculate elapsed time in minutes since the satellite's epoch
      // satrec.jdsatepoch is Julian Date of epoch. Unix epoch is JD 2440587.5.
      const epochMs = (satrec.jdsatepoch - 2440587.5) * 86400000;
      const elapsedMinutes = (simTimeRef.current - epochMs) / 60000;

      // Keplerian circular orbit angle
      const a = satrec.mo + satrec.no * elapsedMinutes;
      const r = satrec.a; // Semi-major axis in Earth radii

      // Position in orbital plane
      const x = r * Math.cos(a);
      const z = r * Math.sin(a);

      // Rotate by inclination around X axis
      const ci = Math.cos(satrec.inclo);
      const si = Math.sin(satrec.inclo);
      const y2 = -z * si;
      const z2 = z * ci;

      // Rotate by RAAN around Y axis
      const cr = Math.cos(satrec.nodeo);
      const sr = Math.sin(satrec.nodeo);

      if (i * 3 + 2 < array.length) {
        array[i * 3] = x * cr + z2 * sr;
        array[i * 3 + 1] = y2;
        array[i * 3 + 2] = -x * sr + z2 * cr;
      }
    }

    attr.needsUpdate = true;
  });

  if (positions.length === 0) return null;

  return (
    <points>
      <bufferGeometry ref={geoRef} />
      <pointsMaterial vertexColors size={2} sizeAttenuation={false} transparent opacity={0.6} />
    </points>
  );
}


