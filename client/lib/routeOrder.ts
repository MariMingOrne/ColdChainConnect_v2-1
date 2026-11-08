export interface RoutePoint {
  id: string;
  latitude: number | null | undefined;
  longitude: number | null | undefined;
}

interface Coordinates {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_KM = 6371;

function hasCoordinates<T extends RoutePoint>(point: T): point is T & Coordinates {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude);
}

function distanceKm(a: Coordinates, b: Coordinates) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function pathLengthKm(points: Coordinates[]) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distanceKm(points[i - 1], points[i]);
  return total;
}

export function optimizeRouteOrder<T extends RoutePoint>(points: T[]): T[] {
  const located = points.filter(hasCoordinates);
  const unlocated = points.filter((point) => !hasCoordinates(point));
  if (located.length < 3) return [...located, ...unlocated];

  const remaining = located.slice(1);
  let route: (T & Coordinates)[] = [located[0]];
  while (remaining.length) {
    const last = route[route.length - 1];
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    remaining.forEach((point, index) => {
      const distance = distanceKm(last, point);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    route.push(remaining.splice(nearestIndex, 1)[0]);
  }

  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < route.length - 1; i++) {
      for (let j = i + 1; j < route.length; j++) {
        const candidate = [...route.slice(0, i), ...route.slice(i, j + 1).reverse(), ...route.slice(j + 1)];
        if (pathLengthKm(candidate) < pathLengthKm(route) - 1e-9) {
          route = candidate;
          improved = true;
        }
      }
    }
  }

  return [...route, ...unlocated];
}
