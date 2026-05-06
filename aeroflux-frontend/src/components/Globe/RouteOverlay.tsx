import { useMemo } from 'react';
import * as THREE from 'three';
import { latLngToVec3 } from '../../utils/geo';
import type { Waypoint } from '../../types/flight';

interface RouteOverlayProps {
  activeRoute:          Waypoint[];
  alternateRoute:       Waypoint[];
  recommendedRoute:     Waypoint[] | null; // amber dashed overlay before user accepts
  usingAlternateRoute:  boolean;
}

// Build a tube geometry from an array of waypoints using great-circle SLERP
function buildRouteGeometry(route: Waypoint[], radius = 1.012): THREE.TubeGeometry | null {
  if (route.length < 2) return null;

  const points: THREE.Vector3[] = [];

  for (let i = 0; i < route.length - 1; i++) {
    const start = latLngToVec3(route[i].lat,     route[i].lng,     radius);
    const end   = latLngToVec3(route[i + 1].lat, route[i + 1].lng, radius);

    // Great-circle SLERP: 30 segments per leg for smooth curvature
    const SEGS = 30;
    for (let j = i === 0 ? 0 : 1; j <= SEGS; j++) {
      const t = j / SEGS;
      const point = new THREE.Vector3()
        .copy(start)
        .multiplyScalar(1 - t)
        .add(new THREE.Vector3().copy(end).multiplyScalar(t))
        .normalize()
        .multiplyScalar(radius);
      points.push(point);
    }
  }

  if (points.length < 2) return null;
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.1);
  return new THREE.TubeGeometry(curve, points.length * 2, 0.0025, 6, false);
}

export function RouteOverlay({
  activeRoute,
  alternateRoute,
  recommendedRoute,
  usingAlternateRoute,
}: RouteOverlayProps) {
  const activeGeometry = useMemo(
    () => buildRouteGeometry(activeRoute),
    [activeRoute],
  );

  // Only build alternate geometry when it differs from active
  const alternateGeometry = useMemo(
    () => (alternateRoute.length >= 2 ? buildRouteGeometry(alternateRoute) : null),
    [alternateRoute],
  );

  // Recommended route (pre-accept): amber dashed overlay
  const recommendedGeometry = useMemo(
    () => (recommendedRoute ? buildRouteGeometry(recommendedRoute, 1.0135) : null),
    [recommendedRoute],
  );

  return (
    <group>
      {/* ── Active route ──────────────────────────────────────────────────── */}
      {activeGeometry && (
        <mesh geometry={activeGeometry}>
          <meshBasicMaterial
            color={usingAlternateRoute ? 0x22c55e : 0x06b6d4}
            transparent
            opacity={usingAlternateRoute ? 0.85 : 0.65}
          />
        </mesh>
      )}

      {/* ── Alternate route (dim background reference) ────────────────────── */}
      {alternateGeometry && !usingAlternateRoute && !recommendedRoute && (
        <mesh geometry={alternateGeometry}>
          <meshBasicMaterial color={0xf97316} transparent opacity={0.18} />
        </mesh>
      )}

      {/* ── Recommended route overlay (amber, pre-accept) ─────────────────── */}
      {recommendedGeometry && (
        <mesh geometry={recommendedGeometry}>
          <meshBasicMaterial color={0xeab308} transparent opacity={0.72} />
        </mesh>
      )}

      {/* Glow halo on recommended path */}
      {recommendedGeometry && (
        <mesh geometry={recommendedGeometry} scale={[1.004, 1.004, 1.004]}>
          <meshBasicMaterial color={0xeab308} transparent opacity={0.18} />
        </mesh>
      )}

      {/* Route start dot */}
      {activeRoute.length > 0 && (
        <mesh position={latLngToVec3(activeRoute[0].lat, activeRoute[0].lng, 1.014)}>
          <sphereGeometry args={[0.005, 16, 16]} />
          <meshStandardMaterial
            color={0x06b6d4}
            emissive={0x06b6d4}
            emissiveIntensity={0.9}
          />
        </mesh>
      )}
    </group>
  );
}
