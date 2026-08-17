"use client";

import { useEffect } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type TrackPoint = { lat: number; lng: number; label?: string };

const riderIcon = L.divIcon({
  className: "",
  html: `<div style="background:#0F9F6E;color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:bold;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35)">R</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const destinationIcon = L.divIcon({
  className: "",
  html: `<div style="background:#111827;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3)">D</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function approxKm(a: TrackPoint, b: TrackPoint) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
}

function FitBounds({
  rider,
  destination,
}: {
  rider?: TrackPoint | null;
  destination?: TrackPoint | null;
}) {
  const map = useMap();

  useEffect(() => {
    const points: [number, number][] = [];
    if (rider) points.push([rider.lat, rider.lng]);
    if (destination) points.push([destination.lat, destination.lng]);

    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 15 });
  }, [map, rider?.lat, rider?.lng, destination?.lat, destination?.lng]);

  return null;
}

export function RiderTrackMap({
  rider,
  destination,
  height = "280px",
}: {
  rider?: TrackPoint | null;
  destination?: TrackPoint | null;
  height?: string;
}) {
  // Ignore clearly bad geocoded destinations (e.g. wrong country)
  const safeDestination =
    destination && rider && approxKm(rider, destination) > 80 ? null : destination;

  const center = rider ?? safeDestination ?? { lat: 31.5204, lng: 74.3587 };

  return (
    <div
      className="relative isolate overflow-hidden rounded-2xl border border-black/5"
      style={{ height }}
    >
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={14}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <FitBounds rider={rider} destination={safeDestination} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {rider && safeDestination ? (
          <Polyline
            positions={[
              [rider.lat, rider.lng],
              [safeDestination.lat, safeDestination.lng],
            ]}
            pathOptions={{
              color: "#0F9F6E",
              weight: 3,
              opacity: 0.55,
              dashArray: "8 10",
            }}
          />
        ) : null}

        {safeDestination ? (
          <Marker
            position={[safeDestination.lat, safeDestination.lng]}
            icon={destinationIcon}
          >
            <Popup>{safeDestination.label ?? "Your delivery"}</Popup>
          </Marker>
        ) : null}

        {rider ? (
          <Marker position={[rider.lat, rider.lng]} icon={riderIcon}>
            <Popup>{rider.label ?? "Rider"}</Popup>
          </Marker>
        ) : null}
      </MapContainer>
    </div>
  );
}
