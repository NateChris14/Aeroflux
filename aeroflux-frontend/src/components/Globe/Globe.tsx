import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { useSimulation } from '../../context/SimulationContext';
import { EarthMesh } from './EarthMesh';
import { AircraftModel } from './AircraftModel';
import { RouteOverlay } from './RouteOverlay';
import { HazardZone } from './HazardZone';
import { WaypointMarkers } from './WaypointMarkers';

export function Globe() {
  const {
    flightState, activeRoute, alternateRoute,
    usingAlternateRoute, sigmetActive, recommendedRoute,
  } = useSimulation();

  return (
    <div className="flex-1 h-full relative">
      <Canvas
        camera={{ position: [0, 0, 2.8], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.15} />
        <directionalLight position={[5, 3, 5]} intensity={1.2} />

        <Stars radius={300} depth={60} count={8000} factor={4} saturation={0} fade />

        <EarthMesh />

        <RouteOverlay
          activeRoute={activeRoute}
          alternateRoute={alternateRoute}
          recommendedRoute={recommendedRoute}
          usingAlternateRoute={usingAlternateRoute}
        />

        {sigmetActive.length > 0 && <HazardZone sigmets={sigmetActive} />}

        <WaypointMarkers
          route={activeRoute}
          currentWaypointIdx={flightState.current_waypoint_idx}
        />

        <AircraftModel
          lat={flightState.lat}
          lng={flightState.lng}
          heading={flightState.heading_deg}
          altitude={flightState.altitude_ft}
        />

        <OrbitControls
          enablePan
          minDistance={1.2}
          maxDistance={6.0}
          autoRotate={false}
          enableZoom
          zoomSpeed={0.6}
        />
      </Canvas>
    </div>
  );
}
