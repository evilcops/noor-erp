export type StoredLocation = {
  branchId: string;
  branchName: string;
  branchCode?: string;
  branchAddress?: string;
  address?: string;
  lat?: number;
  lng?: number;
  distanceKm?: number;
  inService: boolean;
  updatedAt: string;
};

const KEY = "noor_store_location";

export function getStoredLocation(): StoredLocation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredLocation;
    if (!parsed?.branchId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setStoredLocation(location: StoredLocation) {
  localStorage.setItem(KEY, JSON.stringify(location));
  window.dispatchEvent(new Event("noor-store-location"));
}

export function clearStoredLocation() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("noor-store-location"));
}
