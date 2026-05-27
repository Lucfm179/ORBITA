import { useState, useRef, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as satellite from 'satellite.js';
import { useStore } from '../store/store';

const EARTH_RADIUS_KM = 6378.137;
const FLEET_IDS = new Set([47699, 56215, 22490, 25504]);

interface SatData {
  satrec: satellite.SatRec;
  norad_id: number;
  name: string;
  isFleet: boolean;
  object_type: string;
}

export function useOrbits() {
  const tles = useStore((s) => s.tles);
  const timeScale = useStore((s) => s.timeScale);
  const satDataRef = useRef<SatData[]>([]);
  const catalogSatsRef = useRef<SatData[]>([]);
  const [catalogPositions, setCatalogPositions] = useState<Float32Array>(new Float32Array(0));
  const [catalogColors, setCatalogColors] = useState<Float32Array>(new Float32Array(0));
  const fleetPosRef = useRef<Float32Array>(new Float32Array(0));
  const [fleetPositionsState, setFleetPositionsState] = useState<Float32Array>(new Float32Array(0));
  const frameCounter = useRef(0);
  const simTimeRef = useRef<number>(Date.now());

  // Reset simulation clock to real-time Date.now() when timeScale is set back to 1
  useEffect(() => {
    if (timeScale === 1) {
      simTimeRef.current = Date.now();
    }
  }, [timeScale]);

  useEffect(() => {
    if (!tles.length) return;
    const sats: SatData[] = [];
    for (const tle of tles) {
      try {
        const satrec = satellite.twoline2satrec(tle.tle_line1, tle.tle_line2);
        sats.push({
          satrec,
          norad_id: tle.norad_id,
          name: tle.name,
          isFleet: FLEET_IDS.has(tle.norad_id),
          object_type: tle.object_type || ''
        });
      } catch {
        /* skip invalid TLEs */
      }
    }
    satDataRef.current = sats;
    
    const catalogSats = sats.filter(s => !s.isFleet);
    const fleetSats = sats.filter(s => s.isFleet);
    
    // Balanced mix: up to 1500 active satellites and up to 1500 debris objects
    const activeCatalog = catalogSats.filter(s => (s.object_type || '').toLowerCase() === 'payload');
    const debrisCatalog = catalogSats.filter(s => (s.object_type || '').toLowerCase() !== 'payload');
    const limitedCatalog = [
      ...activeCatalog.slice(0, 1500),
      ...debrisCatalog.slice(0, 1500)
    ];
    catalogSatsRef.current = limitedCatalog;
    
    // Compute catalog positions ONCE at startup to avoid runtime SGP4 overhead (lag)
    const catalogCount = limitedCatalog.length;
    const catalogPos = new Float32Array(catalogCount * 3);
    const catalogCol = new Float32Array(catalogCount * 3);
    const now = new Date();
    
    let ci = 0;
    for (const sat of limitedCatalog) {
      try {
        const pv = satellite.propagate(sat.satrec, now);
        if (pv.position && typeof pv.position !== 'boolean') {
          // Use ECI coordinates directly (swap y/z for Three.js)
          catalogPos[ci * 3] = pv.position.x / EARTH_RADIUS_KM;
          catalogPos[ci * 3 + 1] = pv.position.z / EARTH_RADIUS_KM;
          catalogPos[ci * 3 + 2] = -pv.position.y / EARTH_RADIUS_KM;
          
          // Debris gets amber color, active gets cyan color (case-insensitive check)
          const nameUpper = sat.name.toUpperCase();
          const typeLower = (sat.object_type || '').toLowerCase();
          const isDebris = typeLower === 'debris' || typeLower === 'rocket body' || nameUpper.includes('DEB') || nameUpper.includes('R/B');
          if (isDebris) {
            // #f6a623 (amber) -> RGB 246, 166, 35
            catalogCol[ci * 3] = 0.965;
            catalogCol[ci * 3 + 1] = 0.651;
            catalogCol[ci * 3 + 2] = 0.137;
          } else {
            // #3fe6d6 (cyan) -> RGB 63, 230, 214
            catalogCol[ci * 3] = 0.247;
            catalogCol[ci * 3 + 1] = 0.902;
            catalogCol[ci * 3 + 2] = 0.839;
          }
          ci++;
        }
      } catch {
        /* skip errors */
      }
    }
    
    setCatalogPositions(catalogPos.subarray(0, ci * 3));
    setCatalogColors(catalogCol.subarray(0, ci * 3));
    
    const initialFleetPos = new Float32Array(fleetSats.length * 3);
    fleetPosRef.current = initialFleetPos;
    setFleetPositionsState(initialFleetPos);
  }, [tles]);

  const lastTimeRef = useRef<number>(performance.now());

  const propagateAll = useCallback((updateState: boolean) => {
    if (satDataRef.current.length === 0) return;
    
    const now = new Date(simTimeRef.current);
    const gmst = satellite.gstime(now);
    
    let fi = 0;
    for (const sat of satDataRef.current) {
      // Propagate ONLY fleet satellites in the frame loop (extremely cheap!)
      if (sat.isFleet) {
        try {
          const pv = satellite.propagate(sat.satrec, now);
          if (!pv.position || typeof pv.position === 'boolean') continue;
          const ecf = satellite.eciToEcf(pv.position, gmst);
          const x = ecf.x / EARTH_RADIUS_KM;
          const y = ecf.z / EARTH_RADIUS_KM;  // swap y/z for Three.js
          const z = -ecf.y / EARTH_RADIUS_KM;
          if (fi * 3 < fleetPosRef.current.length) {
            fleetPosRef.current[fi * 3] = x;
            fleetPosRef.current[fi * 3 + 1] = y;
            fleetPosRef.current[fi * 3 + 2] = z;
            fi++;
          }
        } catch {
          /* skip errors */
        }
      }
    }

    if (updateState) {
      setFleetPositionsState(new Float32Array(fleetPosRef.current));
    }
  }, []);

  useFrame(() => {
    frameCounter.current++;
    
    const nowTime = performance.now();
    const elapsedMs = nowTime - lastTimeRef.current;
    lastTimeRef.current = nowTime;

    // Smoothly advance simulation time
    simTimeRef.current += elapsedMs * timeScale;

    // Propagate the 4 fleet assets every 2 frames for ultra-smooth movement
    // And update state for HTML labels every 10 frames to keep React performant
    const shouldUpdateState = frameCounter.current % 10 === 0;
    if (frameCounter.current % 2 === 0) {
      propagateAll(shouldUpdateState);
    }
  });

  return {
    catalogPositions,
    catalogColors,
    catalogSatsRef,
    fleetPositionsRef: fleetPosRef,
    fleetPositionsState,
    fleetData: satDataRef,
    simTimeRef
  };
}


