import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import { latLngToVec3 } from '../../utils/geo';
import type { Waypoint } from '../../types/flight';

interface WaypointMarkersProps {
  route: Waypoint[];
  currentWaypointIdx: number;
}

export function WaypointMarkers({ route, currentWaypointIdx }: WaypointMarkersProps) {
  const markers = useMemo(() => {
    return route.map((wp, idx) => {
      const position = latLngToVec3(wp.lat, wp.lng, 1.015);
      const isCurrent = idx === currentWaypointIdx;
      const isPast = idx < currentWaypointIdx;
      
      return {
        id: wp.id,
        position,
        label: wp.label,
        isCurrent,
        isPast,
      };
    });
  }, [route, currentWaypointIdx]);

  return (
    <group>
      {markers.map((marker) => (
        <group key={marker.id} position={marker.position}>
          {/* Waypoint dot */}
          <mesh>
            <sphereGeometry args={[marker.isCurrent ? 0.012 : 0.008, 16, 16]} />
            <meshBasicMaterial 
              color={marker.isCurrent ? 0xf97316 : marker.isPast ? 0x22c55e : 0xffffff}
            />
          </mesh>
          
          {/* Label */}
          <Html
            distanceFactor={4}
            position={[0, 0.03, 0]}
            style={{
              color: marker.isCurrent ? '#f97316' : '#fff',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '10px',
              fontWeight: marker.isCurrent ? 600 : 400,
              textShadow: '0 1px 2px rgba(0,0,0,0.8)',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {marker.label}
          </Html>
        </group>
      ))}
    </group>
  );
}
