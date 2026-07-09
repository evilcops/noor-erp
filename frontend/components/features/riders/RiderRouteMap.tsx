"use client";

import { useEffect } from "react";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RiderRoutePlan } from "@/types/rider";

const warehouseIcon = L.divIcon({
  className: "",
  html: `<div style="background:#10B981;color:white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;border:2px solid white">W</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function stopIcon(order: number) {
  return L.divIcon({
    className: "",
    html: `<div style="background:#6366F1;color:white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;border:2px solid white">${order}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function FitRoute({ route }: { route: RiderRoutePlan }) {
  const map = useMap();
  useEffect(() => {
    const points: [number, number][] = [];
    if (route.warehouse) points.push([route.warehouse.lat, route.warehouse.lng]);
    for (const s of route.stops) points.push([s.lat, s.lng]);
    if (route.pathGeometry.length) {
      for (const p of route.pathGeometry) points.push([p.lat, p.lng]);
    }
    if (points.length) {
      map.fitBounds(points, { padding: [24, 24] });
    }
  }, [map, route]);
  return null;
}

export function RiderRouteMap({ route, height = "280px" }: { route: RiderRoutePlan; height?: string }) {
  const center = route.warehouse ?? route.stops[0] ?? { lat: 23.588, lng: 58.3829 };
  const polyline: [number, number][] =
    route.pathGeometry.length > 1
      ? route.pathGeometry.map((p) => [p.lat, p.lng] as [number, number])
      : [
          [route.warehouse.lat, route.warehouse.lng],
          ...route.stops.map((s) => [s.lat, s.lng] as [number, number]),
          [route.warehouse.lat, route.warehouse.lng],
        ];

  return (
    <div className="overflow-hidden rounded-lg border border-border" style={{ height }}>
      <MapContainer center={[center.lat, center.lng]} zoom={12} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
        <FitRoute route={route} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[route.warehouse.lat, route.warehouse.lng]} icon={warehouseIcon} />
        {route.stops.map((stop) => (
          <Marker key={stop.deliveryId} position={[stop.lat, stop.lng]} icon={stopIcon(stop.order)} />
        ))}
        {polyline.length > 1 ? (
          <Polyline positions={polyline} pathOptions={{ color: "#6366F1", weight: 4, opacity: 0.85 }} />
        ) : null}
      </MapContainer>
    </div>
  );
}
