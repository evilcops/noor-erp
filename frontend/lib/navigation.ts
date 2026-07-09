/** Open Google Maps driving directions through ordered waypoints (warehouse → stops → warehouse). */
export function googleMapsRoundTripUrl(
  warehouse: { lat: number; lng: number },
  stops: { lat: number; lng: number }[]
): string | null {
  if (!stops.length) return null;
  const path = [
    `${warehouse.lat},${warehouse.lng}`,
    ...stops.map((s) => `${s.lat},${s.lng}`),
    `${warehouse.lat},${warehouse.lng}`,
  ];
  return `https://www.google.com/maps/dir/${path.map((p) => encodeURIComponent(p)).join("/")}`;
}

export function googleMapsToStopUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}
