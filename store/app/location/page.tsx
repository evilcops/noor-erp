"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, MapPinned } from "lucide-react";
import { toast } from "sonner";
import { storeApi } from "@/lib/api/store";
import { AddressSearchField } from "@/components/AddressSearchField";
import { useStoreAuth } from "@/components/StoreAuthContext";
import { useStoreLocation } from "@/components/LocationContext";
import { ApiClientError } from "@/lib/api/client";

const LocationPinMap = dynamic(
  () => import("@/components/LocationPinMap").then((m) => m.LocationPinMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[280px] animate-pulse rounded-2xl bg-black/[0.04]" />
    ),
  }
);

export default function LocationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, loading: authLoading } = useStoreAuth();
  const { location, setFromBranchPin } = useStoreLocation();
  const [address, setAddress] = useState(location?.address ?? "");
  const [branchId, setBranchId] = useState(location?.branchId ?? "");
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    location?.lat != null && location?.lng != null
      ? { lat: location.lat, lng: location.lng }
      : null
  );
  const [coverageError, setCoverageError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login?from=/location");
    }
  }, [authLoading, isAuthenticated, router]);

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ["store-branches"],
    enabled: isAuthenticated,
    queryFn: () => storeApi.branches(),
  });

  useEffect(() => {
    if (!branchId && branches.length === 1) setBranchId(branches[0]._id);
  }, [branches, branchId]);

  const selectedBranch = useMemo(
    () => branches.find((b) => b._id === branchId) ?? null,
    [branches, branchId]
  );

  useEffect(() => {
    setCoverageError(null);
    if (!selectedBranch?.gpsCoordinates || pin) return;
    setPin({
      lat: selectedBranch.gpsCoordinates.lat,
      lng: selectedBranch.gpsCoordinates.lng,
    });
  }, [selectedBranch?._id]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim()) {
      toast.error("Enter your delivery address");
      return;
    }
    if (!branchId || !selectedBranch) {
      toast.error("Select a branch");
      return;
    }
    if (!pin) {
      toast.error("Tap the map to pin your delivery location");
      return;
    }

    setBusy(true);
    setCoverageError(null);
    try {
      await setFromBranchPin(selectedBranch, address.trim(), pin);
      toast.success(`Serving from ${selectedBranch.name}`);
      const from = searchParams.get("from");
      const next =
        from && from.startsWith("/") && !from.startsWith("//") ? from : "/shop";
      router.push(next);
    } catch (err) {
      const message =
        err instanceof ApiClientError || err instanceof Error
          ? err.message
          : "Could not save location";
      setCoverageError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-12 w-12 animate-pulse rounded-full bg-[var(--mint)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-6rem)] max-w-lg flex-col justify-center py-8">
      <div className="animate-float-in rounded-[1.75rem] border border-black/5 bg-white p-6 shadow-[0_24px_60px_-36px_rgba(16,35,26,0.45)] sm:p-7">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--ink)]">
          Where should we deliver?
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Choose a branch, then pin your exact location so we can check delivery coverage.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-[var(--forest)]">
              <MapPinned className="h-4 w-4" />
              Search address
            </span>
            <AddressSearchField
              value={address}
              onChange={setAddress}
              near={selectedBranch?.gpsCoordinates ?? pin}
              placeholder="Search street, area, or landmark"
              onPick={(hit) => {
                setAddress(hit.label);
                setPin({ lat: hit.lat, lng: hit.lng });
                setCoverageError(null);
              }}
            />
            <p className="mt-1.5 text-xs text-[var(--muted)]">
              Pick a result to drop the pin, then drag it if you need to fine-tune.
            </p>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-[var(--forest)]">Branch</span>
            <div className="relative">
              <select
                value={branchId}
                onChange={(e) => {
                  setBranchId(e.target.value);
                  setPin(null);
                  setCoverageError(null);
                }}
                disabled={branchesLoading}
                className="h-12 w-full appearance-none rounded-2xl border border-[var(--forest)]/35 bg-[var(--sand)] px-4 pr-10 text-sm text-[var(--ink)] outline-none ring-[var(--forest)]/25 focus:ring-2"
              >
                <option value="">{branchesLoading ? "Loading branches…" : "Select branch"}</option>
                {branches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                    {b.address ? ` — ${b.address}` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--forest)]" />
            </div>
          </label>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-[var(--forest)]">Pin on map</p>
            <p className="text-xs text-[var(--muted)]">
              Tap the map or drag the green pin. Delivery is only available inside this branch&apos;s
              cluster area.
            </p>
            <LocationPinMap
              lat={pin?.lat}
              lng={pin?.lng}
              branchCenter={selectedBranch?.gpsCoordinates ?? null}
              deliveryRadiusKm={selectedBranch?.deliveryRadiusKm}
              onChange={(lat, lng) => {
                setPin({ lat, lng });
                setCoverageError(null);
              }}
            />
            {pin ? (
              <p className="font-mono text-[11px] text-[var(--muted)]">
                {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
              </p>
            ) : (
              <p className="text-xs text-[var(--muted)]">Select a branch, then tap the map.</p>
            )}
          </div>

          {coverageError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {coverageError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy || branchesLoading}
            className="flex h-12 w-full items-center justify-center rounded-full border border-[var(--forest)] bg-white text-sm font-semibold text-[var(--forest)] transition hover:bg-[var(--mint)] disabled:opacity-60"
          >
            {busy ? "Checking coverage…" : "Confirm location"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-[var(--muted)]">
          <Link href="/shop" className="font-semibold text-[var(--forest)]">
            Skip for now · browse shop
          </Link>
        </p>
      </div>
    </div>
  );
}
