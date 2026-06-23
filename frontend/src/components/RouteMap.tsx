'use client';

import { Fragment, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Depot, RouteResult } from '@/lib/types';

// Use lightweight divIcons to avoid Leaflet's bundler marker-image issue.
function dot(color: string, label: string) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};width:22px;height:22px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;
      font-weight:600;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)">${label}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

// Depot marker: dark rounded square. Label is a short initials badge so multiple
// depots on one map stay distinguishable; full name shown in the popup.
function depotMarker(label: string) {
  return L.divIcon({
    className: '',
    html: `<div style="background:#0f172a;min-width:28px;height:28px;padding:0 5px;border-radius:6px;
      display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;
      font-weight:700;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

/** Short, readable badge for a depot name (first two word-initials, else 'H'). */
function depotInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'H';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    }
  }, [map, points]);
  return null;
}

export default function RouteMap({
  depots,
  results,
  baselineGeometry,
}: {
  depots: Depot[]; // every depot in play (multi-depot jobs span several)
  results: RouteResult[];
  baselineGeometry?: [number, number][]; // usual route overlay (dashed)
}) {
  const center: [number, number] = depots[0]
    ? [depots[0].latitude, depots[0].longitude]
    : [12.9716, 77.5946];

  const allPoints: [number, number][] = [
    ...depots.map((d) => [d.latitude, d.longitude] as [number, number]),
    ...results.flatMap((r) => r.geometry),
  ];

  return (
    <MapContainer center={center} zoom={11} className="h-[72vh] w-full rounded-xl">
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={allPoints} />

      {/* Usual route overlay — dark dashed with a light casing, drawn beneath. */}
      {baselineGeometry && baselineGeometry.length > 1 && (
        <>
          <Polyline positions={baselineGeometry} pathOptions={{ color: '#ffffff', weight: 6, opacity: 0.8 }} />
          <Polyline
            positions={baselineGeometry}
            pathOptions={{ color: '#1e293b', weight: 3, opacity: 0.95, dashArray: '4 9' }}
          />
        </>
      )}

      {/* Each optimized route: white casing underneath + bold colour on top, so
          it stays legible over parks, water, roads — any basemap feature. */}
      {results.map((r) => (
        <Fragment key={r.id}>
          <Polyline positions={r.geometry} pathOptions={{ color: '#ffffff', weight: 8, opacity: 0.9 }} />
          <Polyline positions={r.geometry} pathOptions={{ color: r.color, weight: 4.5, opacity: 1 }} />
        </Fragment>
      ))}

      {results.flatMap((r) =>
        r.stop_sequence.map((s) => (
          <Marker key={s.delivery_id} position={[s.latitude, s.longitude]} icon={dot(r.color, String(s.sequence))}>
            <Popup>
              <strong>{s.customer_name}</strong>
              <br />Stop #{s.sequence} · {r.vehicle_name}
              <br />{s.weight} kg
            </Popup>
          </Marker>
        ))
      )}

      {depots.map((d) => (
        <Marker key={d.id} position={[d.latitude, d.longitude]} icon={depotMarker(depotInitials(d.name))}>
          <Popup><strong>{d.name}</strong><br />Depot</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
