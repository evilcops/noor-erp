import { apiRequest } from "@/lib/api/client";
import type { GeoCoordinates } from "@/lib/geocoding";

export type { GeoCoordinates } from "@/lib/geocoding";
export { DEFAULT_MAP_CENTER } from "@/lib/geocoding";

/** Geocode via server proxy (Nominatim blocks direct browser requests) */
export async function geocodeAddress(address: string): Promise<GeoCoordinates | null> {
  if (!address.trim()) return null;

  try {
    return await apiRequest<GeoCoordinates>(
      `/geocode?q=${encodeURIComponent(address.trim())}`
    );
  } catch {
    return null;
  }
}
