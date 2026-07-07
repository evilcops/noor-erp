"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { mainBranches } from "@/lib/branch-utils";
import {
  arcLabel,
  COMPASS_DIRECTION_OPTIONS,
  directionLabel,
  regionKey,
  regionsEqual,
  validateExpandedRegionsNoOverlap,
  type CompassDirection,
  type DeliveryExpandedRegion,
} from "@/lib/compass-directions";
import { useAuth, useBranch } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { clusterApi, type DeliveryCluster } from "@/lib/api/clusters";
import { branchApi } from "@/lib/api/branches";
import { clusterZoneSummary } from "@/components/features/clusters/ClusterZonesLayer";
import {
  DEFAULT_CLUSTER_SECTOR_COUNT,
  MAX_CLUSTER_SECTOR_COUNT,
  MIN_CLUSTER_SECTOR_COUNT,
  MIN_EXPANDED_REGION_CLUSTER_COUNT,
  sectorLabelFromCluster,
} from "@/lib/cluster-slots";

const ClusterMapView = dynamic(
  () => import("@/components/features/clusters/ClusterMapView").then((m) => m.ClusterMapView),
  { ssr: false, loading: () => <Skeleton className="h-[420px] w-full rounded-xl" /> }
);

const DEFAULT_DELIVERY_RADIUS_KM = 10;

interface RegionFormRow {
  id: string;
  fromDirection: CompassDirection;
  toDirection: CompassDirection;
  radiusKm: string;
  clusterCount: string;
}

function newRegionRow(partial?: Partial<RegionFormRow>): RegionFormRow {
  return {
    id: crypto.randomUUID(),
    fromDirection: "north",
    toDirection: "west",
    radiusKm: "20",
    clusterCount: "10",
    ...partial,
  };
}

function branchSectorCount(branch: { deliveryClusterCount?: number } | undefined, clusters: DeliveryCluster[]) {
  if (branch?.deliveryClusterCount) return branch.deliveryClusterCount;
  if (clusters[0]?.sectorCount) return clusters[0].sectorCount;
  return DEFAULT_CLUSTER_SECTOR_COUNT;
}

function branchRadiusKm(branch: { deliveryRadiusKm?: number } | undefined, clusters: DeliveryCluster[]) {
  if (branch?.deliveryRadiusKm) return branch.deliveryRadiusKm;
  if (clusters[0]?.mainRadiusKm) return clusters[0].mainRadiusKm;
  return DEFAULT_DELIVERY_RADIUS_KM;
}

function storedRegions(branch: { deliveryExpandedRegions?: DeliveryExpandedRegion[] | null } | undefined) {
  return branch?.deliveryExpandedRegions ?? [];
}

function parseRegionRows(rows: RegionFormRow[]): DeliveryExpandedRegion[] {
  return rows.map((row) => ({
    fromDirection: row.fromDirection,
    toDirection: row.toDirection,
    radiusKm: Math.min(100, Math.max(1, Number(row.radiusKm) || DEFAULT_DELIVERY_RADIUS_KM)),
    clusterCount: Math.min(
      MAX_CLUSTER_SECTOR_COUNT,
      Math.max(MIN_EXPANDED_REGION_CLUSTER_COUNT, Number(row.clusterCount) || MIN_EXPANDED_REGION_CLUSTER_COUNT)
    ),
  }));
}

function rowsFromStored(regions: DeliveryExpandedRegion[]): RegionFormRow[] {
  return regions.map((r) =>
    newRegionRow({
      id: regionKey(r),
      fromDirection: r.fromDirection,
      toDirection: r.toDirection,
      radiusKm: String(r.radiusKm),
      clusterCount: String(r.clusterCount),
    })
  );
}

function loadFormFromBranch(
  branch: {
    deliveryClusterCount?: number;
    deliveryRadiusKm?: number;
    deliveryExpandedRegions?: DeliveryExpandedRegion[] | null;
  } | undefined,
  clusters: DeliveryCluster[]
) {
  return {
    count: String(branchSectorCount(branch, clusters)),
    radius: String(branchRadiusKm(branch, clusters)),
    regions: rowsFromStored(storedRegions(branch)),
  };
}

export function ClustersPage() {
  const { user } = useAuth();
  const { branches, refreshBranches } = useBranch();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [mainBranchFilter, setMainBranchFilter] = useState("");
  const [updateOpen, setUpdateOpen] = useState(false);
  const [formCount, setFormCount] = useState(String(DEFAULT_CLUSTER_SECTOR_COUNT));
  const [formRadius, setFormRadius] = useState(String(DEFAULT_DELIVERY_RADIUS_KM));
  const [regionRows, setRegionRows] = useState<RegionFormRow[]>([]);

  const mains = useMemo(() => mainBranches(branches), [branches]);

  const { data, isLoading } = useQuery({
    queryKey: ["clusters", page, mainBranchFilter],
    queryFn: () => clusterApi.list({ page, limit: 50, branchId: mainBranchFilter || undefined }),
    enabled: !!user,
  });

  const { data: branchDetail, refetch: refetchBranchDetail } = useQuery({
    queryKey: ["branch", mainBranchFilter, "delivery-grid"],
    queryFn: () => branchApi.getById(mainBranchFilter),
    enabled: !!mainBranchFilter && !!user,
  });

  const selectedMainBranch = branches.find((b) => b._id === mainBranchFilter && !b.parentBranchId);
  const branchConfig = branchDetail ?? selectedMainBranch;
  const mapClusters = data?.data ?? [];
  const stored = storedRegions(branchConfig);

  const storedCount = branchSectorCount(branchConfig, mapClusters);
  const storedRadius = branchRadiusKm(branchConfig, mapClusters);

  function applyFormFromBranch() {
    const loaded = loadFormFromBranch(branchConfig, mapClusters);
    setFormCount(loaded.count);
    setFormRadius(loaded.radius);
    setRegionRows(loaded.regions);
  }

  function openUpdateModal() {
    applyFormFromBranch();
    setUpdateOpen(true);
  }

  useEffect(() => {
    if (!updateOpen) return;
    applyFormFromBranch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync form when saved branch config loads
  }, [updateOpen, branchConfig, mapClusters.length]);

  const warehouseForMap = useMemo(() => {
    if (!mainBranchFilter) return null;
    const branch = branches.find((b) => b._id === mainBranchFilter);
    if (!branch?.gpsCoordinates?.lat) return null;
    return {
      lat: branch.gpsCoordinates.lat,
      lng: branch.gpsCoordinates.lng,
      name: branch.name,
    };
  }, [mainBranchFilter, branches]);

  const parsedCount = Math.min(
    MAX_CLUSTER_SECTOR_COUNT,
    Math.max(MIN_CLUSTER_SECTOR_COUNT, Number(formCount) || DEFAULT_CLUSTER_SECTOR_COUNT)
  );
  const parsedRadius = Math.min(100, Math.max(1, Number(formRadius) || DEFAULT_DELIVERY_RADIUS_KM));
  const parsedRegions = parseRegionRows(regionRows);

  const gridChanged =
    parsedCount !== storedCount ||
    parsedRadius !== storedRadius ||
    !regionsEqual(parsedRegions, stored);
  const canSave = gridChanged || mapClusters.length === 0;

  const regenerateMut = useMutation({
    mutationFn: () => {
      if (parsedRegions.length) validateExpandedRegionsNoOverlap(parsedRegions);
      return branchApi.regenerateClusters(mainBranchFilter, {
        sectorCount: parsedCount,
        deliveryRadiusKm: parsedRadius,
        expandedRegions: parsedRegions.length ? parsedRegions : null,
      });
    },
    onSuccess: async (res) => {
      toast.success(`Updated delivery grid: ${res.count} clusters`);
      setUpdateOpen(false);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["clusters"] }),
        qc.invalidateQueries({ queryKey: ["branches"] }),
        refetchBranchDetail(),
        refreshBranches(),
      ]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function updateRegionRow(id: string, patch: Partial<RegionFormRow>) {
    setRegionRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRegionRow(id: string) {
    setRegionRows((rows) => rows.filter((r) => r.id !== id));
  }

  const columns: Column<DeliveryCluster>[] = [
    { key: "code", header: "Code", cell: (r) => <span className="font-mono font-medium">{r.code}</span> },
    { key: "name", header: "Name", cell: (r) => r.name },
    {
      key: "slot",
      header: "Slice",
      cell: (r) => sectorLabelFromCluster(r.sectorStartDeg, r.sectorCount) ?? "—",
    },
    {
      key: "radius",
      header: "Radius",
      cell: (r) => (r.radiusKm != null ? `${r.radiusKm} km` : "—"),
    },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Delivery Clusters"
        description="Configure multiple directional expansions. Each area keeps its own radius and cluster count."
        actions={
          can("delivery:assign") && selectedMainBranch ? (
            <Button onClick={openUpdateModal}>
              <Pencil className="mr-2 h-4 w-4" />
              Update delivery grid
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[220px]">
          <Label>Main branch</Label>
          <Select
            value={mainBranchFilter}
            onChange={(e) => setMainBranchFilter(e.target.value)}
            options={mains.map((b) => ({ value: b._id, label: b.name }))}
            placeholder="Select main branch"
          />
        </div>
        {branchConfig ? (
          <p className="pb-2 text-sm text-muted-foreground">
            Base: {storedCount} clusters · {storedRadius} km
          </p>
        ) : null}
      </div>

      {mainBranchFilter && branchConfig ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-foreground">Saved directional expansions</p>
              <p className="text-xs text-muted-foreground">
                These load automatically when you open Update delivery grid.
              </p>
            </div>
            {can("delivery:assign") ? (
              <Button variant="secondary" onClick={openUpdateModal}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit all
              </Button>
            ) : null}
          </div>
          {stored.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No directional expansions yet. Click <strong>Update delivery grid</strong> →{" "}
              <strong>Add direction</strong>.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {stored.map((r) => (
                <div
                  key={regionKey(r)}
                  className="flex items-start justify-between gap-3 rounded-md border border-border bg-muted/30 p-3"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {directionLabel(r.fromDirection)} &amp; {directionLabel(r.toDirection)}
                    </p>
                    <p className="text-xs text-muted-foreground">{arcLabel(r.fromDirection, r.toDirection)}</p>
                    <p className="text-xs text-foreground">
                      {r.clusterCount} clusters · {r.radiusKm} km radius
                    </p>
                  </div>
                  {can("delivery:assign") ? (
                    <Button variant="secondary" onClick={openUpdateModal}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {mainBranchFilter && mapClusters.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Cluster map</p>
          <p className="text-xs text-muted-foreground">{clusterZoneSummary(mapClusters)}</p>
          <ClusterMapView warehouse={warehouseForMap} clusters={mapClusters} />
        </div>
      ) : mainBranchFilter ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No clusters yet. Use <strong>Update delivery grid</strong> to configure the delivery area.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Select a main branch to view its delivery cluster map.</p>
      )}

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        page={page}
        totalPages={data?.meta?.totalPages ?? 1}
        onPageChange={setPage}
      />

      <Modal
        open={updateOpen}
        onOpenChange={setUpdateOpen}
        title="Update delivery grid"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setUpdateOpen(false)} disabled={regenerateMut.isPending}>
              Cancel
            </Button>
            <Button
              disabled={regenerateMut.isPending || !canSave}
              loading={regenerateMut.isPending}
              onClick={() => regenerateMut.mutate()}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {selectedMainBranch ? (
            <p className="text-sm text-muted-foreground">
              Branch: <span className="font-medium text-foreground">{selectedMainBranch.name}</span>
              {stored.length > 0 ? (
                <span className="block text-xs">
                  {stored.length} saved expansion{stored.length === 1 ? "" : "s"} loaded — edit below or add more.
                </span>
              ) : null}
            </p>
          ) : null}

          <div className="space-y-4 rounded-lg border border-border p-4">
            <p className="text-sm font-medium">Default (remaining directions)</p>
            <div>
              <Label>Number of clusters</Label>
              <Input
                type="number"
                min={MIN_CLUSTER_SECTOR_COUNT}
                max={MAX_CLUSTER_SECTOR_COUNT}
                value={formCount}
                onChange={(e) => setFormCount(e.target.value)}
              />
            </div>
            <div>
              <Label>Radius (km)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={formRadius}
                onChange={(e) => setFormRadius(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Directional expansions</p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setRegionRows((rows) => [...rows, newRegionRow()])}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add direction
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Add one row per area. Example: North &amp; West → 20 km, 10 clusters; then North &amp; East → 5 km, 2
              clusters. Both are kept when you save.
            </p>

            {regionRows.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                No expansions in this form yet. Your saved expansions appear here when you open this dialog.
                Click <strong>Add direction</strong> for a new area.
              </p>
            ) : (
              regionRows.map((row, index) => (
                <div key={row.id} className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">Expansion {index + 1}</p>
                    <Button type="button" variant="secondary" onClick={() => removeRegionRow(row.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>From</Label>
                      <Select
                        value={row.fromDirection}
                        onChange={(e) =>
                          updateRegionRow(row.id, { fromDirection: e.target.value as CompassDirection })
                        }
                        options={COMPASS_DIRECTION_OPTIONS}
                      />
                    </div>
                    <div>
                      <Label>To</Label>
                      <Select
                        value={row.toDirection}
                        onChange={(e) =>
                          updateRegionRow(row.id, { toDirection: e.target.value as CompassDirection })
                        }
                        options={COMPASS_DIRECTION_OPTIONS}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {arcLabel(row.fromDirection, row.toDirection)}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Clusters</Label>
                      <Input
                        type="number"
                        min={MIN_EXPANDED_REGION_CLUSTER_COUNT}
                        max={MAX_CLUSTER_SECTOR_COUNT}
                        value={row.clusterCount}
                        onChange={(e) => updateRegionRow(row.id, { clusterCount: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Radius (km)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={row.radiusKm}
                        onChange={(e) => updateRegionRow(row.id, { radiusKm: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {gridChanged ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Saving rebuilds all clusters: {parsedRegions.length} expanded area
              {parsedRegions.length === 1 ? "" : "s"} plus base coverage for the rest at {parsedRadius} km.
            </p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
