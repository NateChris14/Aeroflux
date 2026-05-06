import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { latLngToVec3 } from '../../utils/geo';
import type { SigmetData } from '../../types/flight';

interface HazardZoneProps {
  sigmets: SigmetData[];
}

export function HazardZone({ sigmets }: HazardZoneProps) {
  const zoneRef = useRef<THREE.Group>(null);
  const pulseRef = useRef(0);

  // Build hazard zone geometry from SIGMET polygon
  const zoneGeometry = useMemo(() => {
    if (!sigmets.length) return null;
    
    const points: THREE.Vector3[] = [];
    const sigmet = sigmets[0];
    const coords = sigmet.geometry?.coordinates?.[0] || [];
    
    for (const coord of coords) {
      if (Array.isArray(coord) && coord.length >= 2) {
        const point = latLngToVec3(coord[1], coord[0], 1.012);
        points.push(point);
      }
    }
    
    if (points.length < 3) return null;
    
    // Create line loop
    const curve = new THREE.CatmullRomCurve3([...points, points[0]], true);
    return new THREE.TubeGeometry(curve, points.length * 2, 0.005, 4, true);
  }, [sigmets]);

  // Calculate center for glow
  const centerPosition = useMemo(() => {
    if (!sigmets.length) return new THREE.Vector3();
    const sigmet = sigmets[0];
    const coords = sigmet.geometry?.coordinates?.[0] || [];
    
    let latSum = 0, lngSum = 0, count = 0;
    for (const coord of coords) {
      if (Array.isArray(coord) && coord.length >= 2) {
        latSum += coord[1];
        lngSum += coord[0];
        count++;
      }
    }
    
    if (count === 0) return new THREE.Vector3();
    return latLngToVec3(latSum / count, lngSum / count, 1.05);
  }, [sigmets]);

  useFrame((_, delta) => {
    pulseRef.current += delta;
    if (zoneRef.current) {
      const opacity = 0.2 + Math.sin(pulseRef.current * 2) * 0.1;
      zoneRef.current.children.forEach(child => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.Material) {
          child.material.opacity = opacity;
        }
      });
    }
  });

  if (!zoneGeometry) return null;

  return (
    <group ref={zoneRef}>
      {/* Hazard perimeter line */}
      <mesh geometry={zoneGeometry}>
        <meshBasicMaterial 
          color={0xef4444} 
          transparent 
          opacity={0.6}
        />
      </mesh>
      
      {/* Hazard glow light */}
      <pointLight 
        color={0xef4444} 
        intensity={1.2}
        distance={0.5}
        position={centerPosition}
      />
      
      {/* Hazard fill (simplified as a sphere at center) */}
      <mesh position={centerPosition}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial 
          color={0xef4444}
          transparent
          opacity={0.15}
        />
      </mesh>
    </group>
  );
}
