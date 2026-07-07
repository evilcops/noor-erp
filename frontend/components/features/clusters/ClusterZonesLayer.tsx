"use client";

import { Circle, Polygon, Popup, Rectangle } from "react-leaflet";
import type { DeliveryCluster } from "@/lib/api/clusters";
import {
  clusterMainRadiusKm,
  clusterMapBounds,
  clusterSectorPolygon,
  MAIN_SERVICE_RADIUS_KM,
} from "@/lib/cluster-map-utils";

const CLUSTER_COLORS = [
  "#6366F1",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#06B6D4",
  "#EC4899",
  "#84CC16",
];

interface ClusterZonesLayerProps {
  clusters: DeliveryCluster[];
  warehouse?: { lat: number; lng: number } | null;
}

export function ClusterZonesLayer({ clusters, warehouse }: ClusterZonesLayerProps) {
  const isSectorGrid = clusters.length > 0 && clusters.every((c) => c.shape === "sector");
  const mainRadiusKm =
    clusters[0] != null ? clusterMainRadiusKm(clusters[0]) : MAIN_SERVICE_RADIUS_KM;

  return (
    <>
      {warehouse && !isSectorGrid ? (
        <Circle
          center={[warehouse.lat, warehouse.lng]}
          radius={mainRadiusKm * 1000}
          pathOptions={{
            color: "#64748b",
            fillColor: "#94a3b8",
            fillOpacity: 0.04,
            weight: 2,
            dashArray: "8 6",
          }}
        >
          <Popup>
            <strong>Service area</strong>
            <br />
            {mainRadiusKm} km radius from warehouse
          </Popup>
        </Circle>
      ) : null}

      {clusters.map((cluster, index) => {
        const color = CLUSTER_COLORS[index % CLUSTER_COLORS.length];
        const sectorRing = clusterSectorPolygon(cluster, warehouse);

        if (sectorRing) {
          const sliceDeg =
          cluster.sectorEndDeg != null &&
          cluster.sectorStartDeg != null &&
          cluster.sectorCount
            ? 360 / cluster.sectorCount
            : cluster.sectorEndDeg != null && cluster.sectorStartDeg != null
              ? cluster.sectorEndDeg - cluster.sectorStartDeg
              : 72;
          return (
            <Polygon
              key={cluster._id}
              positions={sectorRing}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.2,
                weight: 2,
              }}
            >
              <Popup>
                <strong>{cluster.code}</strong> — {cluster.name}
                <br />
                {sliceDeg}° sector · {cluster.radiusKm} km radius
              </Popup>
            </Polygon>
          );
        }

        const bounds = clusterMapBounds(cluster);
        if (bounds) {
          return (
            <Rectangle
              key={cluster._id}
              bounds={bounds}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.12,
                weight: 2,
              }}
            >
              <Popup>
                <strong>{cluster.code}</strong> — {cluster.name}
              </Popup>
            </Rectangle>
          );
        }

        return (
          <Circle
            key={cluster._id}
            center={[cluster.center.lat, cluster.center.lng]}
            radius={cluster.radiusKm * 1000}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.12,
              weight: 2,
            }}
          >
            <Popup>
              <strong>{cluster.code}</strong> — {cluster.name}
              <br />
              Radius: {cluster.radiusKm} km
            </Popup>
          </Circle>
        );
      })}
    </>
  );
}

export function clusterZoneSummary(clusters: DeliveryCluster[]): string {
  if (!clusters.length) return "";
  const first = clusters[0];
  const mainKm = clusterMainRadiusKm(first);
  if (first.shape === "sector" || clusters.every((c) => c.shape === "sector")) {
    const total = first.sectorCount ?? clusters.length;
    return `${clusters.length} of ${total} zones · ${mainKm} km radius · ${total} pie slices`;
  }
  if (first.shape === "square") {
    return `${clusters.length} zones · ${first.cellSizeKm ?? 2} km cells · ${mainKm} km service area`;
  }
  return `${clusters.length} delivery zones · ${first.radiusKm} km radius each`;
}
