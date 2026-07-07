"use client";

import { useEffect, useMemo } from "react";
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DEFAULT_MAP_CENTER } from "@/lib/geocoding";

const warehouseIcon = L.divIcon({
  className: "",
  html: `<div style="background:#10B981;color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:bold;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35)">W</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
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
  zoom?: number;
  focusKey?: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom ?? Math.max(map.getZoom(), 14));
  }, [lat, lng, zoom, map, focusKey]);
  return null;
}

export interface MapLocationPickerProps {
  lat?: number | null;
  lng?: number | null;
  onChange: (lat: number, lng: number) => void;
  /** Attendance / geofence radius shown on map */
  radiusMeters?: number;
  height?: string;
  className?: string;
  /** Increment to pan map after geocoding */
  focusKey?: number;
}

export function MapLocationPicker({
  lat,
  lng,
  onChange,
  radiusMeters,
  height = "280px",
  className,
  focusKey,
}: MapLocationPickerProps) {
  const hasPin = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng);

  const center = useMemo(
    () => (hasPin ? { lat: lat!, lng: lng! } : DEFAULT_MAP_CENTER),
    [hasPin, lat, lng]
  );

  return (
    <div
      className={`overflow-hidden rounded-lg border border-border ${className ?? ""}`}
      style={{ height }}
    >
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={hasPin ? 15 : 11}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapClickHandler onSelect={onChange} />

        {hasPin ? (
          <>
            <MapViewSync lat={lat!} lng={lng!} focusKey={focusKey} />
            <Marker
              position={[lat!, lng!]}
              icon={warehouseIcon}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const pos = e.target.getLatLng();
                  onChange(pos.lat, pos.lng);
                },
              }}
            />
            {radiusMeters && radiusMeters > 0 ? (
              <Circle
                center={[lat!, lng!]}
                radius={radiusMeters}
                pathOptions={{
                  color: "#10B981",
                  fillColor: "#10B981",
                  fillOpacity: 0.12,
                  weight: 2,
                }}
              />
            ) : null}
          </>
        ) : null}
      </MapContainer>
    </div>
  );
}
