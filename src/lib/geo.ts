export interface LatLon {
  lat: number;
  lon: number;
}

export function isValidCoord({ lat, lon }: LatLon): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/** Unit-sphere position (Y up) for a latitude/longitude in degrees. Matches three.js conventions. */
export function latLonToXYZ({ lat, lon }: LatLon, radius = 1): [number, number, number] {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return [
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ];
}
