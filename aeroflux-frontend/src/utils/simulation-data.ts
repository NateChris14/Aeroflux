import type {
  Waypoint, FlightState, FuelState, SigmetData,
  AgentMessage, Recommendation, ATCTraffic, WeatherCell,
} from '../types/flight';

// ─── LHR → DEL great-circle route ────────────────────────────────────────────
export const PLANNED_ROUTE: Waypoint[] = [
  { id: 'LHR', label: 'London Heathrow', lat: 51.4775,  lng: -0.4614 },
  { id: 'AMS', label: 'Amsterdam',        lat: 52.3,     lng:  4.9    },
  { id: 'FRA', label: 'Frankfurt',         lat: 50.0,     lng:  8.5    },
  { id: 'VIE', label: 'Vienna',            lat: 48.1,     lng: 16.6    },
  { id: 'IST', label: 'Istanbul',          lat: 41.0,     lng: 29.0    },
  { id: 'TBS', label: 'Tbilisi',           lat: 41.7,     lng: 44.8    },
  { id: 'THR', label: 'Tehran',            lat: 35.7,     lng: 51.3    },
  { id: 'KHI', label: 'Karachi',           lat: 24.9,     lng: 67.1    },
  { id: 'DEL', label: 'New Delhi',         lat: 28.5562,  lng: 77.1    },
];

// Southern alternate — avoids Eastern Europe SIGMET (via Venice/Athens)
export const ALTERNATE_ROUTE: Waypoint[] = [
  { id: 'LHR', label: 'London Heathrow', lat: 51.4775,  lng: -0.4614 },
  { id: 'AMS', label: 'Amsterdam',        lat: 52.3,     lng:  4.9    },
  { id: 'MUC', label: 'Munich',           lat: 48.3,     lng: 11.8    },
  { id: 'VCE', label: 'Venice',           lat: 45.5,     lng: 12.3    },
  { id: 'ATH', label: 'Athens',           lat: 37.9,     lng: 23.7    },
  { id: 'ANK', label: 'Ankara',           lat: 39.9,     lng: 32.9    },
  { id: 'THR', label: 'Tehran',           lat: 35.7,     lng: 51.3    },
  { id: 'KHI', label: 'Karachi',          lat: 24.9,     lng: 67.1    },
  { id: 'DEL', label: 'New Delhi',        lat: 28.5562,  lng: 77.1    },
];

// SIGMET zone over Eastern Europe (VIE-IST corridor)
export const HAZARD_POLYGON: [number, number][] = [
  [47, 20], [47, 27], [50, 27], [50, 20],
];

export const INITIAL_FLIGHT_STATE: FlightState = {
  callsign:             'BA008',
  origin:               'LHR',
  destination:          'DEL',
  aircraft_type:        'Boeing 777-300ER',
  altitude_ft:          5000,
  speed_kts:            260,
  heading_deg:          75,
  current_waypoint_idx: 0,
  lat:                  51.4775,
  lng:                 -0.4614,
  phase:                'CLIMB',
  vertical_rate_fpm:    2200,
};

export const INITIAL_FUEL_STATE: FuelState = {
  remaining_kg:           68500,
  burn_rate_kg_per_min:   100,
  burn_delta_vs_planned_kg: 0,
  projected_remaining_kg: 12000,
};

export const MOCK_SIGMET: SigmetData = {
  id:       'SIGMET-EU-01',
  hazard:   'MOD TURB',
  severity: 'MODERATE',
  geometry: {
    // GeoJSON polygon: [lng, lat]
    coordinates: [[[20, 47], [27, 47], [27, 50], [20, 50], [20, 47]]],
  },
};

// ─── ATC traffic — 10 aircraft along European/Asian corridors ─────────────────
export const ATC_TRAFFIC_INITIAL: ATCTraffic[] = [
  { callsign: 'BA117', lat: 49.5, lng: 12.0, altitude_fl: 370, speed_kts: 476, heading_deg: 118 },
  { callsign: 'EK521', lat: 45.8, lng: 22.0, altitude_fl: 380, speed_kts: 488, heading_deg: 112 },
  { callsign: 'LH446', lat: 51.2, lng:  6.5, altitude_fl: 350, speed_kts: 472, heading_deg:  88 },
  { callsign: 'TK073', lat: 43.5, lng: 30.0, altitude_fl: 360, speed_kts: 484, heading_deg:  92 },
  { callsign: 'AF082', lat: 47.8, lng: 16.0, altitude_fl: 390, speed_kts: 486, heading_deg:  96 },
  { callsign: 'QR007', lat: 40.2, lng: 42.5, altitude_fl: 370, speed_kts: 492, heading_deg: 108 },
  { callsign: 'SV224', lat: 38.5, lng: 48.0, altitude_fl: 360, speed_kts: 476, heading_deg: 116 },
  { callsign: 'MS766', lat: 35.2, lng: 54.0, altitude_fl: 380, speed_kts: 480, heading_deg: 102 },
  { callsign: 'PK701', lat: 28.5, lng: 64.5, altitude_fl: 370, speed_kts: 470, heading_deg:  58 },
  { callsign: 'AI108', lat: 31.8, lng: 70.5, altitude_fl: 350, speed_kts: 474, heading_deg:  52 },
];

// ─── Procedural weather cells along LHR-DEL corridor ─────────────────────────
// bounds: GeoJSON ring — [lng, lat], last point closes the polygon
export const WEATHER_CELLS: WeatherCell[] = [
  {
    id: 'WX-EU-01',
    type: 'turbulence',
    severity: 'moderate',
    bounds: [[20, 47], [27, 47], [27, 50], [20, 50], [20, 47]],
  },
  {
    id: 'WX-BS-01',
    type: 'storm',
    severity: 'severe',
    bounds: [[30, 42], [36, 42], [36, 45], [30, 45], [30, 42]],
  },
  {
    id: 'WX-IR-01',
    type: 'turbulence',
    severity: 'moderate',
    bounds: [[48, 33], [55, 33], [55, 36], [48, 36], [48, 33]],
  },
];

// ─── Simulation events (by tick, 10 sim-min per tick) ────────────────────────
type AgentMessageInput = Omit<AgentMessage, 'id' | 'timestamp' | 'sim_elapsed'> & {
  sim_elapsed?: string;
};

export const SIMULATION_EVENTS: Record<number, () => AgentMessageInput | null> = {
  5: () => ({
    agent: 'WEATHER',
    severity: 'warning',
    message: 'SIGMET WX-EU-01: Moderate turbulence, Vienna–Istanbul corridor FL280–FL400',
    finding: 'Turbulence hazard ahead — intersects VIE→IST segment',
  }),
  8: () => ({
    agent: 'COMFORT',
    severity: 'warning',
    message: 'Ride quality degrading: MODERATE turbulence forecast over Balkans',
    finding: 'Passenger comfort impact: MODERATE (EDR 0.14)',
  }),
  15: () => ({
    agent: 'FUEL',
    severity: 'info',
    message: 'Headwind component +31 kts average over Iranian plateau at FL370',
    finding: 'Altitude optimisation FL370→FL400 could save ~280 kg',
  }),
  22: () => ({
    agent: 'ATC',
    severity: 'info',
    message: 'Speed restriction: max 440 kts approaching Karachi FIR boundary',
    finding: 'OPKR sector constraint: speed limit active until KHI',
  }),
};

// ─── Mock recommendations ─────────────────────────────────────────────────────
export const MOCK_RECOMMENDATION = (tick: number): Recommendation | null => {
  if (tick === 5) {
    return {
      id:          'rec-001',
      T:           Date.now(),
      sim_elapsed: tick * 600,
      title:       'Route Deviation — Eastern Europe SIGMET',
      description: 'SIGMET WX-EU-01 (Moderate turbulence) intersects Vienna–Istanbul segment. Southern alternate via Venice–Athens bypasses hazard with 18 min turbulence avoidance.',
      action_type: 'ROUTE_CHANGE',
      action_params: { new_route: 'SOUTHERN_ALT', weather_cell: 'WX-EU-01', reason: 'turbulence_avoidance' },
      metrics: {
        turbulence_avoided_min:    18,
        fuel_impact_kg:            240,
        eta_impact_min:              4,
        ride_quality_improvement: 'HIGH',
      },
      confidence:   0.87,
      status:       'pending',
      agent_results: [],
    };
  }
  if (tick === 15) {
    return {
      id:          'rec-002',
      T:           Date.now(),
      sim_elapsed: tick * 600,
      title:       'Altitude Change — Fuel Optimisation',
      description: 'Headwind 31 kts at FL370 over Iranian plateau. Jet stream at FL400 offers +12 kts tailwind. Recommend: climb FL370→FL400.',
      action_type: 'ALTITUDE_CHANGE',
      action_params: { new_altitude_ft: 40000, reason: 'fuel_optimization' },
      metrics: {
        turbulence_avoided_min:    0,
        fuel_impact_kg:          -280,
        eta_impact_min:            -3,
        ride_quality_improvement: 'MEDIUM',
      },
      confidence:   0.78,
      status:       'pending',
      agent_results: [],
    };
  }
  return null;
};
