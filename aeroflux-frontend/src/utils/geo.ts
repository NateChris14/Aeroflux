import * as THREE from 'three';

export function latLngToVec3(lat: number, lng: number, radius = 1.012): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
     radius * Math.cos(phi),
     radius * Math.sin(phi) * Math.sin(theta)
  );
}

export function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLon = (lng2 - lng1) * (Math.PI / 180);
  const lat1Rad = lat1 * (Math.PI / 180);
  const lat2Rad = lat2 * (Math.PI / 180);
  
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  
  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
}

export function greatCircleInterpolate(
  start: THREE.Vector3, 
  end: THREE.Vector3, 
  segments: number
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const startNorm = start.clone().normalize();
  const endNorm = end.clone().normalize();
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const point = new THREE.Vector3()
      .copy(startNorm)
      .multiplyScalar(1 - t)
      .add(new THREE.Vector3().copy(endNorm).multiplyScalar(t))
      .normalize()
      .multiplyScalar(start.length());
    points.push(point);
  }
  
  return points;
}

export function formatSimElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `T+${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function formatUTC(date = new Date()): string {
  return date.toISOString().split('T')[1].split('.')[0] + 'Z';
}
