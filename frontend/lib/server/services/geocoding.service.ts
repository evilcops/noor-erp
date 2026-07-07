const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const USER_AGENT = "NOOR-ERP/1.0";

export interface GeoCoordinates {
  lat: number;
  lng: number;
}

async function searchNominatim(q: string, countrycodes?: string): Promise<GeoCoordinates | null> {
  const params = new URLSearchParams({
    q,
    format: "json",
    limit: "1",
  });
  if (countrycodes) params.set("countrycodes", countrycodes);

  const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as { lat: string; lon: string }[];
  if (!data.length) return null;

  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

export async function geocodeAddress(address: string): Promise<GeoCoordinates | null> {
  if (!address.trim()) return null;

  const trimmed = address.trim();
  const withCountry = /oman|muscat|salalah|sohar/i.test(trimmed) ? trimmed : `${trimmed}, Oman`;

  const attempts = [
    { q: withCountry, country: "om" },
    { q: withCountry, country: undefined },
    { q: trimmed, country: undefined },
  ];

  for (const { q, country } of attempts) {
    const result = await searchNominatim(q, country);
    if (result) return result;
  }

  return null;
}

export function haversineDistanceMeters(
  a: GeoCoordinates,
  b: GeoCoordinates
): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
