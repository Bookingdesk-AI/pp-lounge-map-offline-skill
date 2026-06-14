export function coordinateKey(coordinates: [number, number]) {
  const [lon, lat] = coordinates;
  return `${lat.toFixed(5)}:${lon.toFixed(5)}`;
}
