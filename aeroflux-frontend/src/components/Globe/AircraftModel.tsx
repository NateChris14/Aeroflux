import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { latLngToVec3 } from '../../utils/geo';

interface AircraftModelProps {
  lat: number;
  lng: number;
  heading: number;
  altitude: number;
}

export function AircraftModel({ lat, lng, heading, altitude: _altitude }: AircraftModelProps) {
  const aircraftRef = useRef<THREE.Group>(null);
  const trailRef = useRef<THREE.Vector3[]>([]);
  
  // Calculate position on sphere
  const position = useMemo(() => latLngToVec3(lat, lng, 1.012), [lat, lng]);
  
  // Build aircraft geometry
  const aircraftGeometry = useMemo(() => {
    const group = new THREE.Group();
    
    // Fuselage
    const fuselageGeom = new THREE.CylinderGeometry(0.004, 0.003, 0.045, 8);
    const fuselageMat = new THREE.MeshPhongMaterial({ 
      color: 0xf97316, 
      shininess: 80 
    });
    const fuselage = new THREE.Mesh(fuselageGeom, fuselageMat);
    fuselage.rotation.z = Math.PI / 2;
    group.add(fuselage);
    
    // Wings
    const wingsGeom = new THREE.BoxGeometry(0.08, 0.003, 0.012);
    const wingsMat = new THREE.MeshPhongMaterial({ 
      color: 0xf97316, 
      shininess: 80 
    });
    const wings = new THREE.Mesh(wingsGeom, wingsMat);
    group.add(wings);
    
    // Tail (vertical stabilizer)
    const tailGeom = new THREE.BoxGeometry(0.025, 0.012, 0.003);
    const tailMat = new THREE.MeshPhongMaterial({ 
      color: 0xf97316, 
      shininess: 80 
    });
    const tail = new THREE.Mesh(tailGeom, tailMat);
    tail.position.set(-0.02, 0.006, 0);
    group.add(tail);
    
    return group;
  }, []);

  // Trail geometry
  const trailGeometry = useMemo(() => {
    if (trailRef.current.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(trailRef.current);
    return new THREE.TubeGeometry(curve, 8, 0.002, 4, false);
  }, []);

  useFrame(() => {
    if (aircraftRef.current) {
      aircraftRef.current.position.copy(position);
      
      // Orient aircraft: tangent to sphere surface + heading
      const up = position.clone().normalize();
      const forward = new THREE.Vector3(0, 0, 1);
      forward.applyAxisAngle(up, (heading - 90) * Math.PI / 180);
      
      const right = new THREE.Vector3().crossVectors(up, forward).normalize();
      const actualForward = new THREE.Vector3().crossVectors(right, up).normalize();
      
      aircraftRef.current.lookAt(
        aircraftRef.current.position.clone().add(actualForward)
      );
      
      // Update trail
      trailRef.current.push(position.clone());
      if (trailRef.current.length > 8) {
        trailRef.current.shift();
      }
    }
  });

  return (
    <group ref={aircraftRef}>
      <primitive object={aircraftGeometry} />
      
      {/* Aircraft glow light */}
      <pointLight 
        color={0xf97316} 
        intensity={0.8} 
        distance={0.3}
        position={[0, -0.02, 0]}
      />
      
      {/* Trail */}
      {trailGeometry && (
        <mesh geometry={trailGeometry}>
          <meshBasicMaterial 
            color={0x06b6d4} 
            transparent 
            opacity={0.4}
          />
        </mesh>
      )}
    </group>
  );
}
