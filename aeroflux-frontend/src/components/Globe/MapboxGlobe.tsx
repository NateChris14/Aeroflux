import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useSimulation } from '../../context/SimulationContext';
import { WEATHER_CELLS } from '../../utils/simulation-data';
import type { Waypoint, ATCTraffic } from '../../types/flight';
import { Plane } from 'lucide-react';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate great-circle coordinates for Mapbox LineString */
function greatCircleCoords(route: Waypoint[], segsPerLeg = 40): [number, number][] {
  const out: [number, number][] = [];

  for (let i = 0; i < route.length - 1; i++) {
    const p1 = route[i], p2 = route[i + 1];
    const φ1 = p1.lat * Math.PI / 180, λ1 = p1.lng * Math.PI / 180;
    const φ2 = p2.lat * Math.PI / 180, λ2 = p2.lng * Math.PI / 180;

    const cosD = Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
    const d    = Math.acos(Math.max(-1, Math.min(1, cosD)));

    const start = i === 0 ? 0 : 1;
    for (let j = start; j <= segsPerLeg; j++) {
      const t = j / segsPerLeg;
      if (d < 0.0001) { out.push([p1.lng, p1.lat]); continue; }
      const A  = Math.sin((1 - t) * d) / Math.sin(d);
      const B  = Math.sin(t * d) / Math.sin(d);
      const x  = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
      const y  = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
      const z  = A * Math.sin(φ1) + B * Math.sin(φ2);
      const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * 180 / Math.PI;
      const lng = Math.atan2(y, x) * 180 / Math.PI;
      out.push([lng, lat]);
    }
  }
  return out;
}

/** Haversine distance in km */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R   = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a   = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Create the aircraft SVG marker element — top-down airplane silhouette */
function makeAircraftEl(inProximity = false): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = `width:42px;height:42px;cursor:pointer;position:relative;`;
  if (inProximity) el.className = 'aircraft-proximity-alert';
  el.innerHTML = `
    <svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="21" cy="21" r="20" fill="rgba(249,115,22,0.13)" stroke="rgba(249,115,22,0.45)" stroke-width="1.5"/>
      <!-- Fuselage -->
      <ellipse cx="21" cy="21" rx="2.8" ry="12" fill="#f97316"/>
      <!-- Main wings swept back -->
      <path d="M21 18 L4 28 L21 23 L38 28 Z" fill="#f97316" opacity="0.92"/>
      <!-- Tail fins -->
      <path d="M21 31 L14 37 L21 33 L28 37 Z" fill="#f97316" opacity="0.80"/>
      <!-- Nose highlight -->
      <circle cx="21" cy="9.5" r="2.2" fill="#fff" opacity="0.85"/>
    </svg>`;
  return el;
}

/** Create an ATC secondary aircraft marker element — top-down plane silhouette */
function makeAtcEl(ac: ATCTraffic, showTag: boolean, inProximity: boolean): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = `atc-marker-wrapper${inProximity ? ' atc-proximity' : ''}`;
  wrapper.dataset.callsign = ac.callsign;
  const color = inProximity ? '#ef4444' : '#94a3b8';
  const opacity = inProximity ? 0.95 : 0.78;

  wrapper.innerHTML = `
    <div class="atc-proximity-ring"></div>
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" style="transform:rotate(${ac.heading_deg}deg);display:block;">
      <!-- Fuselage -->
      <ellipse cx="11" cy="11" rx="1.8" ry="7.5" fill="${color}" opacity="${opacity}"/>
      <!-- Wings -->
      <path d="M11 10 L2 16 L11 13 L20 16 Z" fill="${color}" opacity="${opacity}"/>
      <!-- Tail -->
      <path d="M11 17.5 L7 21 L11 19 L15 21 Z" fill="${color}" opacity="${Math.max(0, opacity - 0.15)}"/>
    </svg>
    <div class="atc-data-tag" style="display:${showTag ? 'block' : 'none'};">
      <strong>${ac.callsign}</strong><br>FL${ac.altitude_fl} · ${ac.speed_kts}kt
    </div>`;
  return wrapper;
}

/** Update an existing ATC marker element in-place */
function updateAtcEl(
  el: HTMLDivElement,
  ac: ATCTraffic,
  showTag: boolean,
  inProximity: boolean,
): void {
  el.className = `atc-marker-wrapper${inProximity ? ' atc-proximity' : ''}`;
  const color = inProximity ? '#ef4444' : '#94a3b8';
  const opacity = inProximity ? '0.95' : '0.78';
  const svg = el.querySelector('svg');
  if (svg) {
    svg.style.transform = `rotate(${ac.heading_deg}deg)`;
    svg.querySelectorAll('ellipse, path').forEach(shape => {
      shape.setAttribute('fill', color);
      shape.setAttribute('opacity', opacity);
    });
  }
  const tag = el.querySelector('.atc-data-tag') as HTMLElement | null;
  if (tag) {
    tag.style.display = showTag ? 'block' : 'none';
    tag.innerHTML = `<strong>${ac.callsign}</strong><br>FL${ac.altitude_fl} · ${ac.speed_kts}kt`;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MapboxGlobe() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map          = useRef<mapboxgl.Map | null>(null);
  const mapLoaded    = useRef(false);

  // Markers
  const aircraftMarker  = useRef<mapboxgl.Marker | null>(null);
  const altBadgeMarker  = useRef<mapboxgl.Marker | null>(null);
  const altBadgeEl      = useRef<HTMLDivElement | null>(null);
  const atcMarkersRef   = useRef<Map<string, { marker: mapboxgl.Marker; el: HTMLDivElement }>>(new Map());

  // Weather drift
  const weatherDriftRef = useRef(0);

  const {
    flightState,
    activeRoute,
    recommendedRoute,
    usingAlternateRoute,
    atcTraffic,
    recommendations,
  } = useSimulation();

  const [showSatellite, setShowSatellite] = useState(false);
  const [showDataTags,  setShowDataTags]  = useState(true);
  const [showWeather,   setShowWeather]   = useState(true);

  // Derived: pending ROUTE_CHANGE recommendation?
  const pendingRouteRec = recommendations.find(
    r => r.action_type === 'ROUTE_CHANGE' && r.status === 'pending',
  );

  // Proximity check (150 km threshold)
  const proximityCallsigns = new Set(
    atcTraffic
      .filter(ac => haversineKm(flightState.lat, flightState.lng, ac.lat, ac.lng) < 150)
      .map(ac => ac.callsign),
  );
  const mainInProximity = proximityCallsigns.size > 0;

  // ── Map initialisation ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    if (!MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container:  mapContainer.current,
      style:      showSatellite
        ? 'mapbox://styles/mapbox/satellite-streets-v12'
        : 'mapbox://styles/mapbox/dark-v11',
      // Start centered between LHR and DEL
      center: [38, 46],
      zoom:   3.4,
      pitch:  25,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.addControl(new mapboxgl.FullscreenControl(),  'top-right');

    map.current.on('style.load', () => {
      if (!map.current) return;
      map.current.addSource('mapbox-dem', {
        type: 'raster-dem',
        url:  'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      });
      map.current.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
      mapLoaded.current = true;
    });

    return () => {
      map.current?.remove();
      map.current = null;
      mapLoaded.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSatellite]);

  // ── Follow aircraft ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!map.current) return;
    map.current.easeTo({
      center:   [flightState.lng, flightState.lat],
      bearing:  flightState.heading_deg - 90,
      duration: 2000,
      easing:   t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    });
  }, [flightState.lat, flightState.lng, flightState.heading_deg]);

  // ── Draw active route (great-circle arc) ───────────────────────────────────
  const drawActiveRoute = useCallback(() => {
    const m = map.current;
    if (!m) return;

    // Clean previous layers
    ['active-route-glow', 'active-route'].forEach(id => {
      if (m.getLayer(id))  m.removeLayer(id);
    });
    ['active-route'].forEach(id => {
      if (m.getSource(id)) m.removeSource(id);
    });

    if (activeRoute.length < 2) return;
    const coords = greatCircleCoords(activeRoute);

    m.addSource('active-route', {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } },
    });

    // Glow halo
    m.addLayer({
      id: 'active-route-glow',
      type: 'line',
      source: 'active-route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color':   usingAlternateRoute ? '#22c55e' : '#06b6d4',
        'line-width':   10,
        'line-opacity': 0.12,
        'line-blur':    4,
      },
    });

    m.addLayer({
      id: 'active-route',
      type: 'line',
      source: 'active-route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color':   usingAlternateRoute ? '#22c55e' : '#06b6d4',
        'line-width':   3,
        'line-opacity': 0.9,
      },
    });

  }, [activeRoute, usingAlternateRoute]);

  useEffect(() => {
    if (!map.current) return;
    if (map.current.isStyleLoaded()) {
      drawActiveRoute();
    } else {
      map.current.once('styledata', drawActiveRoute);
    }
  }, [drawActiveRoute]);

  // ── Recommended route overlay (amber dashed, pre-accept) ───────────────────
  useEffect(() => {
    const m = map.current;
    if (!m) return;

    const draw = () => {
      // Remove existing recommended layers
      ['rec-route-glow', 'rec-route'].forEach(id => {
        if (m.getLayer(id))  m.removeLayer(id);
      });
      if (m.getSource('rec-route')) m.removeSource('rec-route');

      // Only draw when there is a pending ROUTE_CHANGE recommendation
      if (!recommendedRoute || !pendingRouteRec) return;

      const coords = greatCircleCoords(recommendedRoute);

      m.addSource('rec-route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } },
      });

      // Glow halo
      m.addLayer({
        id: 'rec-route-glow',
        type: 'line',
        source: 'rec-route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color':   '#eab308',
          'line-width':   10,
          'line-opacity': 0.14,
          'line-blur':    5,
        },
      });

      // Amber dashed line
      m.addLayer({
        id: 'rec-route',
        type: 'line',
        source: 'rec-route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color':     '#eab308',
          'line-width':     2.5,
          'line-opacity':   0.88,
          'line-dasharray': [5, 3],
        },
      });
    };

    if (m.isStyleLoaded()) {
      draw();
    } else {
      m.once('styledata', draw);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendedRoute, pendingRouteRec]);

  // ── Weather overlays ────────────────────────────────────────────────────────
  useEffect(() => {
    const m = map.current;
    if (!m) return;

    const drawWeather = () => {
      WEATHER_CELLS.forEach(cell => {
        const fillId    = `wx-fill-${cell.id}`;
        const coreId    = `wx-core-${cell.id}`;
        const borderId  = `wx-border-${cell.id}`;

        // Clean existing layers/sources
        [fillId, coreId, borderId].forEach(id => { if (m.getLayer(id)) m.removeLayer(id); });
        if (m.getSource(cell.id)) m.removeSource(cell.id);

        m.addSource(cell.id, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Polygon', coordinates: [cell.bounds] },
          },
        });

        const isLight = cell.id.endsWith('-HALO');
        const isStorm = cell.type === 'storm';
        const baseColor = isStorm ? '#ef4444' : '#f97316';

        // Outer fill — soft ambient glow
        m.addLayer({
          id:     fillId,
          type:   'fill',
          source: cell.id,
          paint: {
            'fill-color':   baseColor,
            'fill-opacity': isLight ? 0.07 : isStorm ? 0.28 : 0.16,
          },
          layout: { visibility: showWeather ? 'visible' : 'none' },
        });

        // Inner core fill (denser center) — skip for halo cells
        if (!isLight) {
          m.addLayer({
            id:     coreId,
            type:   'fill',
            source: cell.id,
            paint: {
              'fill-color':   baseColor,
              'fill-opacity': isStorm ? 0.14 : 0.08,
            },
            layout: { visibility: showWeather ? 'visible' : 'none' },
          });
        }

        // Border — dashed for storms, solid for turbulence
        m.addLayer({
          id:     borderId,
          type:   'line',
          source: cell.id,
          paint: {
            'line-color':        baseColor,
            'line-width':        isLight ? 0.5 : isStorm ? 1.8 : 1.2,
            'line-opacity':      isLight ? 0.25 : isStorm ? 0.85 : 0.55,
            'line-blur':         isLight ? 2 : 1,
            ...(isStorm ? { 'line-dasharray': [3, 2] } : {}),
          },
          layout: { visibility: showWeather ? 'visible' : 'none' },
        });
      });

      // Slow eastward drift every 8 s
      const driftTimer = setInterval(() => {
        if (!m.isStyleLoaded()) return;
        weatherDriftRef.current += 0.015;
        const drift = weatherDriftRef.current;
        WEATHER_CELLS.forEach(cell => {
          const src = m.getSource(cell.id) as mapboxgl.GeoJSONSource | undefined;
          if (!src) return;
          src.setData({
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [cell.bounds.map(([lng, lat]) => [lng + drift, lat] as [number, number])],
            },
          });
        });
      }, 8000);

      return () => clearInterval(driftTimer);
    };

    if (m.isStyleLoaded()) {
      return drawWeather();
    } else {
      let cleanup: (() => void) | undefined;
      const onStyleData = () => { cleanup = drawWeather(); };
      m.once('styledata', onStyleData);
      return () => {
        m.off('styledata', onStyleData);
        cleanup?.();
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toggle weather layer visibility
  useEffect(() => {
    const m = map.current;
    if (!m || !m.isStyleLoaded()) return;
    WEATHER_CELLS.forEach(cell => {
      ['fill', 'core', 'border'].forEach(part => {
        const id = `wx-${part}-${cell.id}`;
        if (m.getLayer(id)) {
          m.setLayoutProperty(id, 'visibility', showWeather ? 'visible' : 'none');
        }
      });
    });
  }, [showWeather]);

  // ── Main aircraft marker + altitude badge ───────────────────────────────────
  useEffect(() => {
    const m = map.current;
    if (!m) return;

    const flightLevel = Math.floor(flightState.altitude_ft / 100);
    const vspd        = flightState.vertical_rate_fpm;
    const arrow       = vspd > 50 ? '▲' : vspd < -50 ? '▼' : '–';
    const arrowColor  = vspd > 50 ? '#22c55e' : vspd < -50 ? '#f97316' : '#94a3b8';

    if (!aircraftMarker.current) {
      const el = makeAircraftEl(mainInProximity);
      aircraftMarker.current = new mapboxgl.Marker({
        element:           el,
        anchor:            'center',
        rotation:          flightState.heading_deg,
        rotationAlignment: 'map',
      })
        .setLngLat([flightState.lng, flightState.lat])
        .addTo(m);
    } else {
      aircraftMarker.current.setLngLat([flightState.lng, flightState.lat]);
      aircraftMarker.current.setRotation(flightState.heading_deg);
      const el = aircraftMarker.current.getElement();
      if (mainInProximity) el.classList.add('aircraft-proximity-alert');
      else el.classList.remove('aircraft-proximity-alert');
    }

    // Altitude badge marker (offset above aircraft)
    if (!altBadgeMarker.current) {
      const el = document.createElement('div');
      altBadgeEl.current = el;
      el.innerHTML = `
        <div style="
          background: rgba(4,11,22,0.95);
          border: 1px solid rgba(14,165,233,0.35);
          border-radius: 0;
          padding: 4px 10px;
          pointer-events: none;
          box-shadow: 0 0 12px rgba(14,165,233,0.18);
          text-align: center;
          white-space: nowrap;
        ">
          <div style="font-family: 'JetBrains Mono',monospace; font-size: 15px; font-weight: 700; color: #0ea5e9; letter-spacing: 0.08em; text-shadow: 0 0 10px rgba(14,165,233,0.55);">
            FL<span class="fl-num">${flightLevel.toString().padStart(3, '0')}</span>
          </div>
          <div style="font-family: 'JetBrains Mono',monospace; font-size: 10px; color: rgba(255,255,255,0.40); margin-top: 1px; letter-spacing: 0.05em;">
            <span class="fl-ft">${flightState.altitude_ft.toLocaleString()}</span> ft
            <span class="fl-arrow" style="color:${arrowColor}; margin-left:3px;">${arrow}</span>
          </div>
        </div>`;

      altBadgeMarker.current = new mapboxgl.Marker({
        element: el,
        anchor:  'bottom',
        offset:  [0, -22],
      })
        .setLngLat([flightState.lng, flightState.lat])
        .addTo(m);
    } else {
      altBadgeMarker.current.setLngLat([flightState.lng, flightState.lat]);
      if (altBadgeEl.current) {
        const flNum = altBadgeEl.current.querySelector('.fl-num') as HTMLElement | null;
        const flFt  = altBadgeEl.current.querySelector('.fl-ft')  as HTMLElement | null;
        const flAr  = altBadgeEl.current.querySelector('.fl-arrow') as HTMLElement | null;
        if (flNum) flNum.textContent = flightLevel.toString().padStart(3, '0');
        if (flFt)  flFt.textContent  = flightState.altitude_ft.toLocaleString();
        if (flAr)  { flAr.textContent = arrow; flAr.style.color = arrowColor; }
      }
    }
  }, [
    flightState.lat, flightState.lng, flightState.heading_deg,
    flightState.altitude_ft, flightState.vertical_rate_fpm, mainInProximity,
  ]);

  // ── ATC traffic markers ─────────────────────────────────────────────────────
  useEffect(() => {
    const m = map.current;
    if (!m) return;

    atcTraffic.forEach(ac => {
      const inProx = proximityCallsigns.has(ac.callsign);
      const existing = atcMarkersRef.current.get(ac.callsign);

      if (!existing) {
        const el     = makeAtcEl(ac, showDataTags, inProx);
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([ac.lng, ac.lat])
          .addTo(m);
        atcMarkersRef.current.set(ac.callsign, { marker, el });
      } else {
        existing.marker.setLngLat([ac.lng, ac.lat]);
        updateAtcEl(existing.el, ac, showDataTags, inProx);
      }
    });
  }, [atcTraffic, showDataTags, proximityCallsigns]);

  // ── No-token fallback ───────────────────────────────────────────────────────
  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex-1 h-full bg-af-dark flex items-center justify-center">
        <div className="text-center p-6">
          <Plane className="w-12 h-12 text-af-cyan mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Mapbox Token Required</h3>
          <p className="text-sm text-white/60 max-w-md">
            Add your Mapbox token to <code className="bg-af-card px-1 rounded">.env</code>:
          </p>
          <code className="block mt-2 p-2 bg-af-card rounded text-xs text-af-cyan">
            VITE_MAPBOX_TOKEN=pk.eyJ1...
          </code>
          <p className="text-xs text-white/40 mt-4">
            Get a free token at{' '}
            <a href="https://account.mapbox.com" className="text-af-cyan underline">
              account.mapbox.com
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full relative overflow-hidden">
      <div ref={mapContainer} className="w-full h-full" />

      {/* ── Map controls overlay ─────────────────────────────────────────── */}
      <div className="absolute top-3 left-3 flex flex-col gap-1 z-10">
        {/* Satellite toggle */}
        <button
          onClick={() => setShowSatellite(s => !s)}
          className={`px-3 py-1.5 border text-[11px] font-mono tracking-widest transition-colors ${
            showSatellite
              ? 'bg-af-cyan/10 border-af-cyan/40 text-af-cyan atc-glow-cyan'
              : 'bg-af-card/90 border-white/[0.12] text-white/55 hover:text-white/80 hover:border-white/25'
          }`}
        >
          {showSatellite ? '◆ SAT' : '◇ SAT'}
        </button>

        {/* Data tags toggle */}
        <button
          onClick={() => setShowDataTags(t => !t)}
          className={`px-3 py-1.5 border text-[11px] font-mono tracking-widest transition-colors ${
            showDataTags
              ? 'bg-af-cyan/10 border-af-cyan/40 text-af-cyan atc-glow-cyan'
              : 'bg-af-card/90 border-white/[0.12] text-white/55 hover:text-white/80 hover:border-white/25'
          }`}
        >
          {showDataTags ? '◆ TAGS' : '◇ TAGS'}
        </button>

        {/* Weather toggle */}
        <button
          onClick={() => setShowWeather(w => !w)}
          className={`px-3 py-1.5 border text-[11px] font-mono tracking-widest transition-colors ${
            showWeather
              ? 'bg-af-orange/10 border-af-orange/40 text-af-orange atc-glow-orange'
              : 'bg-af-card/90 border-white/[0.12] text-white/55 hover:text-white/80 hover:border-white/25'
          }`}
        >
          {showWeather ? '◆ WX' : '◇ WX'}
        </button>
      </div>

      {/* ── Proximity alert banner ───────────────────────────────────────── */}
      {mainInProximity && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div
            className="bg-af-header/95 px-4 py-1.5 border border-af-red/70 text-[11px] font-mono font-bold tracking-widest text-af-red flex items-center gap-2 atc-glow-red"
            style={{ animation: 'pulse 1s ease-in-out infinite' }}
          >
            <span className="animate-pulse">■</span>
            PROXIMITY ALERT — {[...proximityCallsigns].join(' · ')}
          </div>
        </div>
      )}

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <div className="absolute bottom-3 left-3 bg-af-header/92 border border-white/[0.10] z-10">
        <div className="px-2 py-1 border-b border-white/[0.08]">
          <span className="section-label">Legend</span>
        </div>
        <div className="flex flex-col gap-1 px-3 py-2 text-[10px] font-mono">
          <div className="flex items-center gap-2">
            <span className="w-5 h-px bg-af-cyan inline-block" />
            <span className="text-white/50 tracking-wider uppercase">{usingAlternateRoute ? 'Alt-S Active' : 'Planned'}</span>
          </div>
          {pendingRouteRec && (
            <div className="flex items-center gap-2">
              <span className="w-5 inline-block" style={{ borderBottom: '1.5px dashed #f59e0b', height: 0 }} />
              <span className="text-af-yellow tracking-wider uppercase">Recommended</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 inline-block bg-af-orange/30 border border-af-orange/50" />
            <span className="text-white/50 tracking-wider uppercase">Turbulence</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 inline-block bg-af-red/30 border border-af-red/50" />
            <span className="text-white/50 tracking-wider uppercase">Storm cell</span>
          </div>
        </div>
      </div>

      {/* ── Route status badge ───────────────────────────────────────────── */}
      <div className="absolute bottom-3 right-3 bg-af-header/92 border border-white/[0.10] px-3 py-1.5 z-10">
        <span className={`font-mono text-[11px] tracking-widest uppercase ${usingAlternateRoute ? 'text-af-green atc-glow-green' : 'text-af-cyan atc-glow-cyan'}`}>
          {usingAlternateRoute ? '● ALT-S ACTIVE' : '● LHR ▸ DEL VIA VIE'}
        </span>
      </div>
    </div>
  );
}
