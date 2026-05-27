import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { Earth } from './Earth';
import { Atmosphere } from './Atmosphere';
import { CatalogCloud } from './CatalogCloud';
import { FleetSatellites } from './FleetSatellites';
import { ConjunctionMarker } from './ConjunctionMarker';
import { useOrbits } from '../../hooks/useOrbits';
import { useStore } from '../../store/store';


const FLEET_IDS_ARR = [47699, 56215, 22490, 25504];

function Scene() {
  const { catalogPositions, catalogColors, catalogSatsRef, fleetPositionsRef, fleetPositionsState, fleetData, simTimeRef } = useOrbits();
  const selectedConjunctionId = useStore((s) => s.selectedConjunction);
  const conjunctions = useStore((s) => s.conjunctions);

  // Find position of the selected conjunction's primary satellite
  let markerPosition: [number, number, number] | null = null;
  if (selectedConjunctionId) {
    const selectedConj = conjunctions.find(c => c.id === selectedConjunctionId);
    if (selectedConj) {
      const primaryId = selectedConj.primary.norad_id;
      const idx = FLEET_IDS_ARR.indexOf(primaryId);
      if (idx !== -1 && fleetPositionsRef.current.length > idx * 3) {
        const x = fleetPositionsRef.current[idx * 3];
        const y = fleetPositionsRef.current[idx * 3 + 1];
        const z = fleetPositionsRef.current[idx * 3 + 2];
        if (x !== 0 || y !== 0 || z !== 0) {
          markerPosition = [x, y, z];
        }
      }
    }
  }

  const backgroundStyle = useStore((s) => s.backgroundStyle);
  const autoRotate = useStore((s) => s.autoRotate);

  // Background color based on style
  const bgColor = backgroundStyle === 'stars' 
    ? '#04060f' 
    : backgroundStyle === 'deep' 
      ? '#010206' 
      : '#000000';

  return (
    <>
      <color attach="background" args={[bgColor]} />
      
      {backgroundStyle === 'stars' && (
        <Stars radius={300} depth={60} count={8000} factor={4} saturation={0} fade speed={0.5} />
      )}
      {backgroundStyle === 'deep' && (
        <Stars radius={200} depth={50} count={12000} factor={6} saturation={0.5} fade speed={1.5} />
      )}
      
      <ambientLight intensity={0.25} />
      <directionalLight position={[-5, 2.5, 4]} intensity={1.5} />
      
      <group>
        <Earth simTimeRef={simTimeRef} />
        <Atmosphere />
        <CatalogCloud positions={catalogPositions} colors={catalogColors} catalogSatsRef={catalogSatsRef} simTimeRef={simTimeRef} />
        <FleetSatellites positionsRef={fleetPositionsRef} positionsState={fleetPositionsState} fleetData={fleetData} />
        {markerPosition && <ConjunctionMarker position={markerPosition} />}
      </group>
      
      <OrbitControls
        enablePan={false}
        minDistance={1.3}
        maxDistance={20}
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.5}
        autoRotate={autoRotate}
        autoRotateSpeed={0.2} // very slow camera orbit (0.2 is subtle and realistic)
      />
    </>
  );
}



export function Globe() {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas camera={{ position: [0, 0, 3.5], fov: 45 }}>
        <Scene />
      </Canvas>
    </div>
  );
}
