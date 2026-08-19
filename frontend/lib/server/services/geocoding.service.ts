const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const USER_AGENT = "NOOR-ERP/1.0";

export interface GeoCoordinates {
  lat: number;
  lng: number;
}

export interface AddressSuggestion {
  label: string;
  lat: number;
  lng: number;
}

type NominatimHit = {
  lat: string;
  lon: string;
  display_name?: string;
};

async function nominatimSearch(
  q: string,
  options: { countrycodes?: string; limit?: number; viewbox?: string } = {}
): Promise<NominatimHit[]> {
  const params = new URLSearchParams({
    q,
    format: "json",
    limit: String(options.limit ?? 1),
    addressdetails: "0",
  });
  if (options.countrycodes) params.set("countrycodes", options.countrycodes);
  if (options.viewbox) {
    params.set("viewbox", options.viewbox);
    params.set("bounded", "0");
  }

  const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as NominatimHit[];
  return Array.isArray(data) ? data : [];
}

async function searchNominatim(q: string, countrycodes?: string): Promise<GeoCoordinates | null> {
  const data = await nominatimSearch(q, { countrycodes, limit: 1 });
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

function inferCountry(query: string) {
  const envCountry = (process.env.GEOCODE_COUNTRY || "").toLowerCase();
  const isOman = /oman|muscat|salalah|sohar/i.test(query) || envCountry === "om";
  const isPakistan =
    /pakistan|lahore|karachi|islamabad|rawalpindi|faisalabad|multan|raya/i.test(query) ||
    envCountry === "pk" ||
    (!isOman && envCountry !== "om");
  return {
    label: isOman ? "Oman" : isPakistan ? "Pakistan" : "",
    code: isOman ? "om" : isPakistan ? "pk" : undefined,
  };
}

export async function searchAddresses(
  query: string,
  near?: { lat: number; lng: number } | null
): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const country = inferCountry(trimmed);
  const withCountry =
    country.label && !new RegExp(country.label, "i").test(trimmed)
      ? `${trimmed}, ${country.label}`
      : trimmed;

  const viewbox =
    near?.lat != null && near?.lng != null
      ? `${near.lng - 0.18},${near.lat + 0.18},${near.lng + 0.18},${near.lat - 0.18}`
      : undefined;

  const hits = await nominatimSearch(withCountry, {
    countrycodes: country.code,
    limit: 6,
    viewbox,
  });
  const fallback =
    hits.length > 0 ? hits : await nominatimSearch(trimmed, { limit: 6, viewbox });

  const seen = new Set<string>();
  const results: AddressSuggestion[] = [];
  for (const hit of fallback) {
    const lat = parseFloat(hit.lat);
    const lng = parseFloat(hit.lon);
    const label = (hit.display_name || trimmed).trim();
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || seen.has(key)) continue;
    seen.add(key);
    results.push({ label, lat, lng });
  }
  return results;
}

export async function geocodeAddress(address: string): Promise<GeoCoordinates | null> {
  if (!address.trim()) return null;

  const trimmed = address.trim();
  const envCountry = (process.env.GEOCODE_COUNTRY || "").toLowerCase();
  const isOman = /oman|muscat|salalah|sohar/i.test(trimmed) || envCountry === "om";
  const isPakistan =
    /pakistan|lahore|karachi|islamabad|rawalpindi|faisalabad|multan|raya/i.test(trimmed) ||
    envCountry === "pk" ||
    (!isOman && envCountry !== "om");

  const countryLabel = isOman ? "Oman" : isPakistan ? "Pakistan" : "";
  const countryCode = isOman ? "om" : isPakistan ? "pk" : undefined;
  const withCountry =
    countryLabel && !new RegExp(countryLabel, "i").test(trimmed)
      ? `${trimmed}, ${countryLabel}`
      : trimmed;

  const attempts = [
    { q: withCountry, country: countryCode },
    { q: withCountry, country: undefined },
    { q: trimmed, country: countryCode },
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
