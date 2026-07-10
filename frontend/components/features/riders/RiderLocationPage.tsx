"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Play, RefreshCw, Square } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { useBranch } from "@/hooks";
import { devApi } from "@/lib/api/dev";
import { riderApi } from "@/lib/api/riders";
import { ROUTE_COLORS } from "@/components/features/riders/RiderLocationMap";
import type { RiderLocationSnapshot } from "@/types/rider";

const IS_DEV = process.env.NODE_ENV === "development";

const RiderLocationMap = dynamic(
  () => import("@/components/features/riders/RiderLocationMap").then((m) => m.RiderLocationMap),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[520px] w-full rounded-lg" />,
  }
);

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDisplayDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateRange(from: string, to: string) {
  if (from === to) return formatDisplayDate(from);
  return `${formatDisplayDate(from)} – ${formatDisplayDate(to)}`;
}

function rangeIncludesToday(from: string, to: string) {
  const today = todayIso();
  return from <= today && today <= to;
}

function rangeKind(from: string, to: string): "today" | "past" | "future" | "range" {
  const today = todayIso();
  if (from === to && from === today) return "today";
  if (to < today) return "past";
  if (from > today) return "future";
  return "range";
}

function riderName(r: RiderLocationSnapshot) {
  const emp = r.employeeId;
  if (typeof emp === "object") return `${emp.firstName} ${emp.lastName}`;
  return r.riderCode;
}

function locationAge(updatedAt?: string) {
  if (!updatedAt) return "No GPS yet";
  const mins = Math.round((Date.now() - new Date(updatedAt).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

function formatRouteTime(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function RiderLocationPage() {
  const { mainBranches, activeMainBranchId } = useBranch();
  const [mainBranchId, setMainBranchId] = useState("");
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);
  const [routeViewByRider, setRouteViewByRider] = useState<Record<string, "current" | "previous">>({});
  const [dateFrom, setDateFrom] = useState(todayIso);
  const [dateTo, setDateTo] = useState(todayIso);
  const [runtimeSimRunning, setRuntimeSimRunning] = useState(false);
  const [simMessage, setSimMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!IS_DEV) return;
    void devApi
      .simulateRiderGps({ action: "status" })
      .then((status) => setRuntimeSimRunning(status.running))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (mainBranchId) return;
    const defaultId =
      activeMainBranchId && mainBranches.some((b) => b._id === activeMainBranchId)
        ? activeMainBranchId
        : mainBranches[0]?._id ?? "";
    if (defaultId) setMainBranchId(defaultId);
  }, [activeMainBranchId, mainBranches, mainBranchId]);

  const branch = useMemo(
    () => mainBranches.find((b) => b._id === mainBranchId),
    [mainBranches, mainBranchId]
  );
  const warehouse = branch?.gpsCoordinates ?? { lat: 23.588, lng: 58.3829 };
  const kind = rangeKind(dateFrom, dateTo);
  const includesToday = rangeIncludesToday(dateFrom, dateTo);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["rider-locations", mainBranchId, dateFrom, dateTo],
    queryFn: () => riderApi.locations(mainBranchId || undefined, { dateFrom, dateTo }),
    enabled: !!mainBranchId && dateFrom <= dateTo,
    refetchInterval: runtimeSimRunning ? 2_000 : includesToday ? 15_000 : false,
  });

  const simulateMut = useMutation({
    mutationFn: (params: { action: "start" | "stop" | "reset" }) =>
      devApi.simulateRiderGps({
        branchId: mainBranchId,
        dateFrom,
        dateTo,
        riderId: selectedRiderId ?? undefined,
        ...params,
      }),
    onSuccess: (result) => {
      setRuntimeSimRunning(result.running);
      if (result.action === "reset") {
        setSimMessage(`Reset ${result.updated?.length ?? 0} rider(s) to warehouse`);
      } else if (result.action === "start") {
        setSimMessage(
          selectedRiderId
            ? "Runtime simulation started for selected rider"
            : "Runtime simulation started for all riders"
        );
      } else if (result.action === "stop") {
        setSimMessage("Runtime simulation stopped");
      }
      void refetch();
    },
    onError: (e: Error) => setSimMessage(e.message),
  });

  const list = data?.riders ?? [];
  const mapRiders = useMemo(
    () =>
      list.map((rider) => {
        const view = routeViewByRider[rider._id] ?? "current";
        const displayRoute =
          view === "previous" && rider.previousRoute ? rider.previousRoute : rider.route;
        return { ...rider, route: displayRoute };
      }),
    [list, routeViewByRider]
  );
  const withLocation = list.filter((r) => r.isOnShift && r.currentLocation?.lat != null);
  const withRoute = list.filter((r) => (r.route?.stopCount ?? 0) > 0);
  const deliveryCount = data?.deliveryCount ?? 0;
  const totalRouteCost = data?.totalRouteCost ?? 0;
  const totalRoundTripKm = data?.totalRoundTripKm ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Location"
        description={
          kind === "today"
            ? "Today's deliveries — live rider GPS, road routes, and round-trip cost (Rs 10/km)"
            : kind === "past"
              ? `Past deliveries (${formatDateRange(dateFrom, dateTo)}) — planned routes and costs`
              : kind === "future"
                ? `Upcoming deliveries (${formatDateRange(dateFrom, dateTo)}) — planned routes and costs`
                : `Deliveries (${formatDateRange(dateFrom, dateTo)}) — planned routes and costs`
        }
        actions={
          <Button variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Riders on map</p>
          <p className="text-2xl font-semibold">{list.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Live GPS</p>
          <p className="text-2xl font-semibold text-emerald-600">{withLocation.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Deliveries</p>
          <p className="text-2xl font-semibold">{deliveryCount}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{formatDateRange(dateFrom, dateTo)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Active routes</p>
          <p className="text-2xl font-semibold text-indigo-600">{withRoute.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total route cost</p>
          <p className="text-2xl font-semibold text-amber-600">Rs {totalRouteCost.toFixed(0)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {totalRoundTripKm.toFixed(1)} km round trip · Rs 10/km
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[220px]">
          <Label>Main branch</Label>
          <Select
            value={mainBranchId}
            onChange={(e) => {
              setMainBranchId(e.target.value);
              setSelectedRiderId(null);
            }}
            options={mainBranches.map((b) => ({ value: b._id, label: b.name }))}
            placeholder="Select branch"
          />
        </div>
        <div>
          <Label>Date from</Label>
          <Input
            type="date"
            value={dateFrom}
            max={dateTo}
            onChange={(e) => {
              const next = e.target.value;
              setDateFrom(next);
              if (next > dateTo) setDateTo(next);
              setSelectedRiderId(null);
            }}
            className="w-[150px]"
          />
        </div>
        <div>
          <Label>Date to</Label>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateTo}
              min={dateFrom}
              onChange={(e) => {
                const next = e.target.value;
                setDateTo(next);
                if (next < dateFrom) setDateFrom(next);
                setSelectedRiderId(null);
              }}
              className="w-[150px]"
            />
            {dateFrom !== todayIso() || dateTo !== todayIso() ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const today = todayIso();
                  setDateFrom(today);
                  setDateTo(today);
                  setSelectedRiderId(null);
                }}
              >
                Today
              </Button>
            ) : null}
          </div>
        </div>
        <p className="pb-2 text-xs text-muted-foreground">
          {runtimeSimRunning
            ? "Runtime simulation active — map refreshes every 2 seconds"
            : includesToday
              ? "Auto-refreshes every 15 seconds"
              : "Showing planned routes for selected range"}
        </p>
      </div>

      {IS_DEV ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Dev: Runtime rider GPS</p>
              <p className="text-xs text-muted-foreground">
                Server moves riders along planned routes every 2s — no manual steps or browser GPS needed.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={runtimeSimRunning ? "secondary" : "primary"}
                size="sm"
                disabled={!mainBranchId || simulateMut.isPending || runtimeSimRunning}
                onClick={() => simulateMut.mutate({ action: "start" })}
              >
                <Play className="mr-1.5 h-3.5 w-3.5" />
                {selectedRiderId ? "Start selected" : "Start all"}
              </Button>
              <Button
                type="button"
                variant={runtimeSimRunning ? "primary" : "secondary"}
                size="sm"
                disabled={!runtimeSimRunning || simulateMut.isPending}
                onClick={() => simulateMut.mutate({ action: "stop" })}
              >
                <Square className="mr-1.5 h-3.5 w-3.5" />
                Stop
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!mainBranchId || simulateMut.isPending}
                onClick={() => simulateMut.mutate({ action: "reset" })}
              >
                Reset to warehouse
              </Button>
            </div>
          </div>
          {simMessage ? <p className="mt-2 text-xs text-muted-foreground">{simMessage}</p> : null}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          {isLoading ? (
            <Skeleton className="h-[520px] w-full rounded-lg" />
          ) : (
            <RiderLocationMap
              riders={mapRiders}
              warehouse={warehouse}
              selectedRiderId={selectedRiderId}
              onSelectRider={(id) => setSelectedRiderId((prev) => (prev === id ? null : id))}
              focusKey={`${mainBranchId}-${dateFrom}-${dateTo}`}
            />
          )}
        </div>

        <div className="space-y-2 rounded-lg border border-border bg-card p-3">
          <p className="text-sm font-semibold">Riders & routes</p>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">No riders for this branch.</p>
          ) : (
            list.map((rider, idx) => {
              const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
              const selected = selectedRiderId === rider._id;
              const routeView = routeViewByRider[rider._id] ?? "current";
              const displayRoute =
                routeView === "previous" && rider.previousRoute ? rider.previousRoute : rider.route;
              return (
                <div
                  key={rider._id}
                  className={`w-full rounded-md border text-left text-sm transition-colors ${
                    selected ? "border-indigo-400 bg-indigo-500/10" : "border-border"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedRiderId((prev) => (prev === rider._id ? null : rider._id))}
                    className="w-full px-3 py-2 text-left hover:bg-muted/50"
                  >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-medium">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                      {riderName(rider)}
                    </span>
                    <StatusBadge status={rider.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{rider.riderCode}</p>
                  <p className="mt-1 text-xs">
                    GPS:{" "}
                    {rider.isOnShift
                      ? locationAge(rider.currentLocation?.updatedAt)
                      : "Off shift"}
                    {displayRoute ? (
                      <>
                        <br />
                        {routeView === "previous" ? (
                          <span className="text-muted-foreground">Previous run</span>
                        ) : rider.route?.runStatus === "planning" ? (
                          <span className="text-emerald-600">Next route</span>
                        ) : (
                          <span>Current route</span>
                        )}
                        {displayRoute.runNumber ? ` · ${displayRoute.runNumber}` : ""}
                        <br />
                        Out {displayRoute.outboundDistanceKm.toFixed(1)} km + return{" "}
                        {displayRoute.returnDistanceKm.toFixed(1)} km ={" "}
                        <span className="font-medium text-foreground">
                          {displayRoute.roundTripDistanceKm.toFixed(1)} km
                        </span>
                        <br />
                        {displayRoute.stopCount} stops
                        {displayRoute.deliveredCount != null
                          ? ` (${displayRoute.deliveredCount} delivered)`
                          : ""}{" "}
                        · ~{displayRoute.totalDurationMin} min ·{" "}
                        <span className="font-medium text-amber-600">
                          Rs {displayRoute.roundTripCost.toFixed(0)}
                        </span>{" "}
                        <span className="text-muted-foreground">(@ Rs {displayRoute.costPerKm}/km)</span>
                        <br />
                        {displayRoute.startedAt ? (
                          <>
                            Route started:{" "}
                            <span className="font-medium text-foreground">
                              {formatRouteTime(displayRoute.startedAt)}
                            </span>
                            <br />
                          </>
                        ) : displayRoute.runStatus === "planning" || displayRoute.runStatus === "loading" ? (
                          <>
                            Route started: <span className="text-muted-foreground">Not departed</span>
                            <br />
                          </>
                        ) : null}
                        {displayRoute.estimatedReturnAt ? (
                          <>
                            Est. back at warehouse:{" "}
                            <span className="font-medium text-foreground">
                              {formatRouteTime(displayRoute.estimatedReturnAt)}
                            </span>
                            {!displayRoute.startedAt &&
                            (displayRoute.runStatus === "planning" ||
                              displayRoute.runStatus === "loading") ? (
                              <span className="text-muted-foreground"> (if leaves now)</span>
                            ) : null}
                          </>
                        ) : null}
                      </>
                    ) : (
                      " · No assigned stops"
                    )}
                  </p>
                  </button>
                  {rider.previousRoute ? (
                    <div className="flex gap-1 border-t border-border px-2 py-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant={routeView === "current" ? "primary" : "secondary"}
                        className="h-7 flex-1 text-xs"
                        onClick={() =>
                          setRouteViewByRider((prev) => ({ ...prev, [rider._id]: "current" }))
                        }
                      >
                        {rider.route ? "Current / next" : "Current"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={routeView === "previous" ? "primary" : "secondary"}
                        className="h-7 flex-1 text-xs"
                        onClick={() =>
                          setRouteViewByRider((prev) => ({ ...prev, [rider._id]: "previous" }))
                        }
                      >
                        Previous
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
