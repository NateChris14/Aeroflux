import { useRef, useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { TextureLoader } from 'three';
import * as THREE from 'three';

export function EarthMesh() {
  const earthRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);

  // Load textures
  const [earthMap, specularMap, cloudsMap] = useLoader(TextureLoader, [
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg',
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg',
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png',
  ]);

  // Earth material
  const earthMaterial = useMemo(() => {
    return new THREE.MeshPhongMaterial({
      map: earthMap,
      specularMap: specularMap,
      specular: new THREE.Color(0x333333),
      shininess: 15,
    });
  }, [earthMap, specularMap]);

  // Clouds material
  const cloudsMaterial = useMemo(() => {
    return new THREE.MeshPhongMaterial({
      map: cloudsMap,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
  }, [cloudsMap]);

  // Atmosphere glow material
  const atmosphereMaterial = useMemo(() => {
    return new THREE.MeshPhongMaterial({
      color: 0x0a4d8c,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
    });
  }, []);

  // Globe rotation disabled - user controls with OrbitControls

  return (
    <group rotation={[0, 0, 0.41]}>
      {/* Earth sphere */}
      <mesh ref={earthRef} material={earthMaterial}>
        <sphereGeometry args={[1, 64, 64]} />
      </mesh>
      
      {/* Cloud layer */}
      <mesh ref={cloudsRef} material={cloudsMaterial}>
        <sphereGeometry args={[1.01, 64, 64]} />
      </mesh>
      
      {/* Atmosphere glow */}
      <mesh ref={atmosphereRef} material={atmosphereMaterial}>
        <sphereGeometry args={[1.02, 64, 64]} />
      </mesh>
    </group>
  );
}
