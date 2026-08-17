"use client";

import { useEffect } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const pinIcon = L.divIcon({
  className: "",
  html: `<div style="background:#0F9F6E;color:white;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:bold;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35)">P</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const branchIcon = L.divIcon({
  className: "",
  html: `<div style="background:#111827;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)">B</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function MapClickHandler({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapViewSync({
  lat,
  lng,
  zoom,
  focusKey,
}: {
  lat: number;
  lng: number;
  zoom: number;
  focusKey?: string;
}) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom);
  }, [lat, lng, zoom, map, focusKey]);
  return null;
}

export type LocationPinMapProps = {
  lat?: number | null;
  lng?: number | null;
  branchCenter?: { lat: number; lng: number } | null;
  deliveryRadiusKm?: number;
  onChange: (lat: number, lng: number) => void;
  height?: string;
};

export function LocationPinMap({
  lat,
  lng,
  branchCenter,
  deliveryRadiusKm,
  onChange,
  height = "280px",
}: LocationPinMapProps) {
  const hasPin = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng);
  const center = hasPin
    ? { lat: lat!, lng: lng! }
    : branchCenter ?? { lat: 31.5204, lng: 74.3587 };
  const focusKey = branchCenter
    ? `${branchCenter.lat.toFixed(4)},${branchCenter.lng.toFixed(4)}`
    : "default";

  return (
    <div
      className="relative isolate overflow-hidden rounded-2xl border border-black/10"
      style={{ height }}
    >
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={hasPin ? 14 : 12}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <MapViewSync
          lat={center.lat}
          lng={center.lng}
          zoom={hasPin ? 14 : 12}
          focusKey={focusKey}
        />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onSelect={onChange} />

        {branchCenter ? (
          <>
            <Marker position={[branchCenter.lat, branchCenter.lng]} icon={branchIcon} />
            {deliveryRadiusKm && deliveryRadiusKm > 0 ? (
              <Circle
                center={[branchCenter.lat, branchCenter.lng]}
                radius={deliveryRadiusKm * 1000}
                pathOptions={{
                  color: "#0F9F6E",
                  fillColor: "#0F9F6E",
                  fillOpacity: 0.08,
                  weight: 1.5,
                }}
              />
            ) : null}
          </>
        ) : null}

        {hasPin ? (
          <Marker
            position={[lat!, lng!]}
            icon={pinIcon}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const pos = e.target.getLatLng();
                onChange(pos.lat, pos.lng);
              },
            }}
          />
        ) : null}
      </MapContainer>
    </div>
  );
}
