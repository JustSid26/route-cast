'use client';

import { useEffect } from 'react';
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

const depotIcon = L.divIcon({
  className: '',
  html: `<div style="background:#0f172a;width:28px;height:28px;border-radius:6px;
    display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;
    font-weight:700;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)">H</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

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
  depot,
  results,
}: {
  depot: Depot | null;
  results: RouteResult[];
}) {
  const center: [number, number] = depot
    ? [depot.latitude, depot.longitude]
    : [12.9716, 77.5946];

  const allPoints: [number, number][] = [
    ...(depot ? [[depot.latitude, depot.longitude] as [number, number]] : []),
    ...results.flatMap((r) => r.geometry),
  ];

  return (
    <MapContainer center={center} zoom={11} className="h-[72vh] w-full rounded-xl">
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={allPoints} />

      {results.map((r) => (
        <Polyline key={r.id} positions={r.geometry} pathOptions={{ color: r.color, weight: 4, opacity: 0.85 }} />
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

      {depot && (
        <Marker position={[depot.latitude, depot.longitude]} icon={depotIcon}>
          <Popup><strong>{depot.name}</strong><br />Depot</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
