"use client";

import { useEffect } from "react";
import { MapContainer, Marker, Popup, Polyline, CircleMarker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LiveRider } from "@/types/rider";
import type { Delivery } from "@/types/delivery";
import type { DeliveryCluster } from "@/lib/api/clusters";
import { ClusterZonesLayer } from "@/components/features/clusters/ClusterZonesLayer";

const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const warehouseIcon = L.divIcon({
  className: "",
  html: `<div style="background:#10B981;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3)">W</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const riderIcon = L.divIcon({
  className: "",
  html: `<div style="background:#6366F1;color:white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3)">R</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

export interface MapPoint {
  lat: number;
  lng: number;
  label?: string;
}

interface DeliveryMapProps {
  center?: MapPoint;
  warehouse?: MapPoint;
  clusters?: DeliveryCluster[];
  riders?: LiveRider[];
  deliveries?: Delivery[];
  routePoints?: MapPoint[];
  height?: string;
  /** Recenter map when branch changes */
  focusKey?: string;
}

function MapViewSync({ lat, lng, zoom, focusKey }: { lat: number; lng: number; zoom: number; focusKey?: string }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom);
  }, [lat, lng, zoom, map, focusKey]);
  return null;
}

export function DeliveryMap({
  center = { lat: 23.588, lng: 58.3829 },
  warehouse,
  clusters = [],
  riders = [],
  deliveries = [],
  routePoints = [],
  height = "420px",
  focusKey,
}: DeliveryMapProps) {
  useEffect(() => {
    L.Marker.prototype.options.icon = defaultIcon;
  }, []);

  const polyline =
    routePoints.length > 1
      ? routePoints.map((p) => [p.lat, p.lng] as [number, number])
      : null;

  const mapCenter = warehouse ?? center;
  const zoom = clusters.length > 0 ? 11 : 12;

  return (
    <div className="relative isolate overflow-hidden rounded-lg border border-border" style={{ height }}>
      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <MapViewSync lat={mapCenter.lat} lng={mapCenter.lng} zoom={zoom} focusKey={focusKey} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {warehouse ? (
          <Marker position={[warehouse.lat, warehouse.lng]} icon={warehouseIcon}>
            <Popup>{warehouse.label ?? "Warehouse"}</Popup>
          </Marker>
        ) : null}

        <ClusterZonesLayer clusters={clusters} warehouse={warehouse ?? mapCenter} />

        {riders.map((rider) => {
          const loc = rider.currentLocation;
          if (!loc?.lat) return null;
          const emp = rider.employeeId;
          const name =
            typeof emp === "object" ? `${emp.firstName} ${emp.lastName}` : rider.riderCode;
          return (
            <Marker key={rider._id} position={[loc.lat, loc.lng]} icon={riderIcon}>
              <Popup>
                <strong>{name}</strong>
                <br />
                {rider.isOnJourney ? "On journey" : "Idle"} · {rider.remainingStops ?? 0} stops left
              </Popup>
            </Marker>
          );
        })}

        {deliveries.map((d) => {
          if (!d.coordinates?.lat) return null;
          const customer = typeof d.customerId === "object" ? d.customerId.name ?? d.customerId.phone : "—";
          return (
            <CircleMarker
              key={d._id}
              center={[d.coordinates.lat, d.coordinates.lng]}
              radius={8}
              pathOptions={{
                color: d.status === "pending_assignment" ? "#f59e0b" : "#10B981",
                fillColor: d.status === "pending_assignment" ? "#fbbf24" : "#34d399",
                fillOpacity: 0.8,
              }}
            >
              <Popup>
                {d.deliveryNumber} — {customer}
                <br />
                {d.area ?? d.deliveryAddress ?? "No address"}
              </Popup>
            </CircleMarker>
          );
        })}

        {polyline ? <Polyline positions={polyline} color="#6366F1" weight={3} opacity={0.7} /> : null}
      </MapContainer>
    </div>
  );
}
