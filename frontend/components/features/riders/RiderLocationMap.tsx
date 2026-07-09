"use client";

import { Fragment, useEffect } from "react";
import { MapContainer, Marker, Popup, Polyline, CircleMarker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RiderLocationSnapshot } from "@/types/rider";

const ROUTE_COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#EC4899", "#84CC16"];

const warehouseIcon = L.divIcon({
  className: "",
  html: `<div style="background:#10B981;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3)">W</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function riderIcon(color: string, code: string) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35)">${code.slice(-1)}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function MapViewSync({ lat, lng, zoom, focusKey }: { lat: number; lng: number; zoom: number; focusKey?: string }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom);
  }, [lat, lng, zoom, map, focusKey]);
  return null;
}

export interface RiderLocationMapProps {
  riders: RiderLocationSnapshot[];
  warehouse?: { lat: number; lng: number };
  selectedRiderId?: string | null;
  onSelectRider?: (id: string | null) => void;
  height?: string;
  focusKey?: string;
}

export function RiderLocationMap({
  riders,
  warehouse,
  selectedRiderId,
  onSelectRider,
  height = "520px",
  focusKey,
}: RiderLocationMapProps) {
  const center = warehouse ?? { lat: 23.588, lng: 58.3829 };
  const zoom = 12;

  return (
    <div className="relative isolate overflow-hidden rounded-lg border border-border" style={{ height }}>
      <MapContainer center={[center.lat, center.lng]} zoom={zoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
        <MapViewSync lat={center.lat} lng={center.lng} zoom={zoom} focusKey={focusKey} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {warehouse ? (
          <Marker position={[warehouse.lat, warehouse.lng]} icon={warehouseIcon}>
            <Popup>Warehouse</Popup>
          </Marker>
        ) : null}

        {riders.map((rider, idx) => {
          const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
          const isSelected = !selectedRiderId || selectedRiderId === rider._id;
          const opacity = isSelected ? 0.85 : 0.25;
          const points = rider.route?.points ?? [];
          const pathGeometry = rider.route?.pathGeometry ?? [];
          const polyline: [number, number][] | null =
            pathGeometry.length > 1
              ? pathGeometry.map((p) => [p.lat, p.lng] as [number, number])
              : points.length > 0 && warehouse
                ? [[warehouse.lat, warehouse.lng], ...points.map((p) => [p.lat, p.lng] as [number, number]), [warehouse.lat, warehouse.lng]]
                : null;

          const emp = rider.employeeId;
          const name = typeof emp === "object" ? `${emp.firstName} ${emp.lastName}` : rider.riderCode;
          const loc = rider.currentLocation;

          return (
            <Fragment key={rider._id}>
              {polyline ? (
                <Polyline positions={polyline} color={color} weight={isSelected ? 4 : 2} opacity={opacity} />
              ) : null}

              {points.map((stop) => (
                <CircleMarker
                  key={`${rider._id}-${stop.deliveryId ?? stop.order}`}
                  center={[stop.lat, stop.lng]}
                  radius={isSelected ? 7 : 5}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: opacity,
                    weight: 2,
                  }}
                  eventHandlers={{
                    click: () => onSelectRider?.(rider._id),
                  }}
                >
                  <Popup>
                    <strong>{name}</strong> — Stop {stop.order}
                    <br />
                    {stop.label ?? "Delivery"}
                  </Popup>
                </CircleMarker>
              ))}

              {loc?.lat != null && loc?.lng != null ? (
                <Marker
                  position={[loc.lat, loc.lng]}
                  icon={riderIcon(color, rider.riderCode)}
                  eventHandlers={{
                    click: () => onSelectRider?.(rider._id),
                  }}
                >
                  <Popup>
                    <strong>{name}</strong> ({rider.riderCode})
                    <br />
                    Status: {rider.status}
                    <br />
                    {rider.remainingStops ?? 0} stops ·{" "}
                    {rider.route
                      ? `${rider.route.roundTripDistanceKm.toFixed(1)} km round trip · Rs ${rider.route.roundTripCost.toFixed(0)}`
                      : "No route"}
                    {loc.updatedAt ? (
                      <>
                        <br />
                        Updated {new Date(loc.updatedAt).toLocaleTimeString()}
                      </>
                    ) : null}
                  </Popup>
                </Marker>
              ) : null}
            </Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}

export { ROUTE_COLORS };
