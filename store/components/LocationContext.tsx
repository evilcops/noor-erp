"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getStoredLocation, setStoredLocation, type StoredLocation } from "@/lib/location";
import { storeApi, type StoreBranch } from "@/lib/api/store";
import { useStoreAuth } from "@/components/StoreAuthContext";

type LocationContextValue = {
  location: StoredLocation | null;
  ready: boolean;
  setFromBranchPin: (
    branch: StoreBranch,
    address: string,
    pin: { lat: number; lng: number }
  ) => Promise<StoredLocation>;
  selectBranch: (branch: StoreBranch) => Promise<StoredLocation>;
  setFromGps: () => Promise<StoredLocation>;
  setFromAddress: (address: string) => Promise<StoredLocation>;
  clear: () => void;
};

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useStoreAuth();
  const [location, setLocation] = useState<StoredLocation | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setLocation(getStoredLocation());
    sync();
    setReady(true);
    window.addEventListener("noor-store-location", sync);
    return () => window.removeEventListener("noor-store-location", sync);
  }, []);

  const persist = useCallback(
    async (next: StoredLocation) => {
      setStoredLocation(next);
      setLocation(next);
      if (isAuthenticated) {
        await storeApi.updateLocation({
          address: next.address,
          branchId: next.branchId,
          coordinates:
            next.lat != null && next.lng != null
              ? { lat: next.lat, lng: next.lng }
              : undefined,
        });
      }
      return next;
    },
    [isAuthenticated]
  );

  const setFromBranchPin = useCallback(
    async (branch: StoreBranch, address: string, pin: { lat: number; lng: number }) => {
      const result = await storeApi.resolveLocation({
        address: address.trim(),
        branchId: branch._id,
        coordinates: pin,
      });
      if (!result.inService) {
        throw new Error(result.message || "We don't deliver in that area");
      }
      return persist({
        branchId: branch._id,
        branchName: branch.name,
        branchCode: branch.code,
        branchAddress: branch.address,
        address: address.trim(),
        lat: result.coordinates.lat,
        lng: result.coordinates.lng,
        distanceKm: result.distanceKm ?? result.branch.distanceKm,
        inService: true,
        updatedAt: new Date().toISOString(),
      });
    },
    [persist]
  );

  const selectBranch = useCallback(
    async (branch: StoreBranch) => {
      const existingPin =
        location?.lat != null && location?.lng != null
          ? { lat: location.lat, lng: location.lng }
          : null;

      if (existingPin) {
        try {
          const result = await storeApi.resolveLocation({
            address: location?.address || branch.address || branch.name,
            branchId: branch._id,
            coordinates: existingPin,
          });
          if (result.inService) {
            return persist({
              branchId: branch._id,
              branchName: branch.name,
              branchCode: branch.code,
              branchAddress: branch.address,
              address: location?.address || result.address || branch.address,
              lat: result.coordinates.lat,
              lng: result.coordinates.lng,
              distanceKm: result.distanceKm ?? result.branch.distanceKm,
              inService: true,
              updatedAt: new Date().toISOString(),
            });
          }
        } catch {
          // Keep going — switch branch even if current pin is outside coverage.
        }
      }

      return persist({
        branchId: branch._id,
        branchName: branch.name,
        branchCode: branch.code,
        branchAddress: branch.address,
        address: location?.address,
        lat: existingPin?.lat ?? branch.gpsCoordinates?.lat,
        lng: existingPin?.lng ?? branch.gpsCoordinates?.lng,
        distanceKm: undefined,
        inService: false,
        updatedAt: new Date().toISOString(),
      });
    },
    [location, persist]
  );

  const applyResult = useCallback(
    async (result: Awaited<ReturnType<typeof storeApi.resolveLocation>>, address?: string) => {
      if (!result.inService) {
        throw new Error(result.message || "We don't deliver in that area");
      }
      return persist({
        branchId: result.branch._id,
        branchName: result.branch.name,
        branchCode: result.branch.code,
        branchAddress: result.branch.address,
        address: address || result.address,
        lat: result.coordinates.lat,
        lng: result.coordinates.lng,
        distanceKm: result.distanceKm ?? result.branch.distanceKm,
        inService: true,
        updatedAt: new Date().toISOString(),
      });
    },
    [persist]
  );

  const setFromGps = useCallback(async () => {
    const coords = await new Promise<GeolocationCoordinates>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported on this device"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos.coords),
        () => reject(new Error("Could not read your GPS. Allow location access or pin on the map.")),
        { enableHighAccuracy: true, timeout: 15000 }
      );
    });
    const result = await storeApi.resolveLocation({
      lat: coords.latitude,
      lng: coords.longitude,
    });
    return applyResult(result);
  }, [applyResult]);

  const setFromAddress = useCallback(
    async (address: string) => {
      const result = await storeApi.resolveLocation({ address });
      return applyResult(result, address);
    },
    [applyResult]
  );

  const clear = useCallback(() => {
    localStorage.removeItem("noor_store_location");
    setLocation(null);
    window.dispatchEvent(new Event("noor-store-location"));
  }, []);

  const value = useMemo(
    () => ({
      location,
      ready,
      setFromBranchPin,
      selectBranch,
      setFromGps,
      setFromAddress,
      clear,
    }),
    [location, ready, setFromBranchPin, selectBranch, setFromGps, setFromAddress, clear]
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useStoreLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useStoreLocation must be used within LocationProvider");
  return ctx;
}
