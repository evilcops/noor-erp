"use client";

import { useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DEFAULT_MAP_CENTER } from "@/lib/geocoding";
import type { DeliveryCluster } from "@/lib/api/clusters";
import { ClusterZonesLayer } from "@/components/features/clusters/ClusterZonesLayer";

const warehouseIcon = L.divIcon({
  className: "",
  html: `<div style="background:#10B981;color:white;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35)">WH</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

export interface ClusterMapViewProps {
  warehouse?: { lat: number; lng: number; name?: string } | null;
  clusters: DeliveryCluster[];
  height?: string;
  className?: string;
}

export function ClusterMapView({
  warehouse,
  clusters,
  height = "420px",
  className,
}: ClusterMapViewProps) {
  const center = useMemo(() => {
    if (warehouse?.lat != null && warehouse?.lng != null) {
      return { lat: warehouse.lat, lng: warehouse.lng };
    }
    if (clusters[0]?.center) {
      return clusters[0].center;
    }
    return DEFAULT_MAP_CENTER;
  }, [warehouse, clusters]);

  const boundsPoints = useMemo(() => {
    const pts: [number, number][] = [];
    if (warehouse?.lat != null) pts.push([warehouse.lat, warehouse.lng]);
    for (const c of clusters) {
      pts.push([c.center.lat, c.center.lng]);
    }
    return pts;
  }, [warehouse, clusters]);

  const zoom = boundsPoints.length > 1 ? 11 : 12;

  return (
    <div
      className={`overflow-hidden rounded-xl border border-border ${className ?? ""}`}
      style={{ height }}
    >
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {warehouse?.lat != null && warehouse?.lng != null ? (
          <Marker position={[warehouse.lat, warehouse.lng]} icon={warehouseIcon}>
            <Popup>
              <strong>{warehouse.name ?? "Warehouse"}</strong>
              <br />
              Branch / warehouse location
            </Popup>
          </Marker>
        ) : null}

        <ClusterZonesLayer clusters={clusters} warehouse={warehouse} />
      </MapContainer>
    </div>
  );
}
