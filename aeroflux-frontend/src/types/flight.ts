export interface Waypoint {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

export interface FlightState {
  callsign: string;
  origin: string;
  destination: string;
  aircraft_type: string;
  altitude_ft: number;
  speed_kts: number;
  heading_deg: number;
  current_waypoint_idx: number;
  lat: number;
  lng: number;
  phase: 'GROUND' | 'CLIMB' | 'CRUISE' | 'DESCENT' | 'DEVIATION';
  vertical_rate_fpm: number;
}

export interface FuelState {
  remaining_kg: number;
  burn_rate_kg_per_min: number;
  burn_delta_vs_planned_kg: number;
  projected_remaining_kg: number;
}

export interface AgentMessage {
  id: string;
  agent: 'WEATHER' | 'FUEL' | 'ATC' | 'COMFORT' | 'SUPERVISOR';
  timestamp: number;
  sim_elapsed: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  finding?: string;
}

export interface RecommendationMetrics {
  turbulence_avoided_min: number;
  fuel_impact_kg: number;
  eta_impact_min: number;
  ride_quality_improvement: string;
}

export interface Recommendation {
  id: string;
  T: number;
  sim_elapsed: number;
  title: string;
  description: string;
  action_type: 'ROUTE_CHANGE' | 'ALTITUDE_CHANGE' | 'SPEED_CHANGE' | 'NONE';
  action_params: Record<string, unknown>;
  metrics: RecommendationMetrics;
  confidence: number;
  status: 'pending' | 'accepted' | 'dismissed';
  agent_results: AgentResult[];
}

export interface AgentResult {
  agent: string;
  T: number;
  finding: string;
  severity: 'info' | 'warning' | 'critical';
  data: Record<string, unknown>;
}

export interface SimSnapshot {
  T: number;
  tick_count: number;
  sim_elapsed: number;
  flight_state: FlightState;
  fuel_state: FuelState;
  active_route: Waypoint[];
  alternate_route: Waypoint[];
  sigmet_active: SigmetData[];
  pireps: PirepData[];
  wind_at_waypoints: Record<string, WindData>;
}

export interface SigmetData {
  id: string;
  hazard: string;
  severity: string;
  geometry: {
    coordinates: number[][][];
  };
}

export interface PirepData {
  turbulence_intensity: string;
  latitude: number;
  longitude: number;
}

export interface WindData {
  speed_ms: number;
  direction_deg: number;
}

export interface Decision {
  id: string;
  timestamp: number;
  action_type: string;
  result: 'accepted' | 'dismissed' | 'auto';
  summary: string;
}

export interface ATCTraffic {
  callsign: string;
  lat: number;
  lng: number;
  altitude_fl: number;
  speed_kts: number;
  heading_deg: number;
}

export interface WeatherCell {
  id: string;
  type: 'turbulence' | 'storm';
  severity: 'moderate' | 'severe';
  // GeoJSON ring: [lng, lat] pairs, last point = first (closed polygon)
  bounds: [number, number][];
}
