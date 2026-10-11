import { haversineKm, type Coord } from "./haversine";

export type Stop = Coord & { id: string };

export type OptimizedRoute<T extends Stop> = {
  /** Paradas en el orden de visita (el almacén queda implícito al inicio y al final). */
  order: T[];
  /** Largo total del circuito almacén -> paradas -> almacén, en km. */
  distanceKm: number;
};

const EPS = 1e-9;
const MAX_2OPT_PASSES = 1000;

/** Matriz de distancias: índice 0 = almacén, 1..n = paradas. */
function distanceMatrix(depot: Coord, stops: Coord[]): number[][] {
  const pts = [depot, ...stops];
  return pts.map((a) => pts.map((b) => haversineKm(a, b)));
}

/** Largo de un circuito dado como lista de índices que empieza y termina en 0. */
function tourLength(tour: number[], d: number[][]): number {
  let total = 0;
  for (let i = 1; i < tour.length; i++) total += d[tour[i - 1]!]![tour[i]!]!;
  return total;
}

/** Vecino más cercano desde el almacén. Empates: gana el índice menor (determinista). */
function nearestNeighbor(d: number[][]): number[] {
  const n = d.length - 1;
  const visited = new Array<boolean>(n + 1).fill(false);
  const tour = [0];
  let current = 0;
  for (let step = 0; step < n; step++) {
    let best = -1;
    for (let j = 1; j <= n; j++) {
      if (!visited[j] && (best === -1 || d[current]![j]! < d[current]![best]!)) best = j;
    }
    visited[best] = true;
    tour.push(best);
    current = best;
  }
  tour.push(0);
  return tour;
}

/** Mejora 2-opt: invierte tramos mientras reduzcan el circuito. El almacén no se mueve. */
function twoOpt(tour: number[], d: number[][]): number[] {
  const t = [...tour];
  const n = t.length - 2; // paradas
  let improved = true;
  for (let pass = 0; improved && pass < MAX_2OPT_PASSES; pass++) {
    improved = false;
    for (let i = 1; i < n; i++) {
      for (let j = i + 1; j <= n; j++) {
        const delta =
          d[t[i - 1]!]![t[j]!]! +
          d[t[i]!]![t[j + 1]!]! -
          d[t[i - 1]!]![t[i]!]! -
          d[t[j]!]![t[j + 1]!]!;
        if (delta < -EPS) {
          for (let a = i, b = j; a < b; a++, b--) [t[a], t[b]] = [t[b]!, t[a]!];
          improved = true;
        }
      }
    }
  }
  return t;
}

/**
 * Ordena las paradas con vecino más cercano + 2-opt sobre distancia Haversine.
 * La ruta parte y termina en el almacén. Módulo puro: sin dependencias de Next ni de red.
 */
export function optimizeRoute<T extends Stop>(depot: Coord, stops: T[]): OptimizedRoute<T> {
  if (stops.length === 0) return { order: [], distanceKm: 0 };
  const d = distanceMatrix(depot, stops);
  if (stops.length === 1) return { order: [...stops], distanceKm: tourLength([0, 1, 0], d) };

  const tour = twoOpt(nearestNeighbor(d), d);
  return {
    order: tour.slice(1, -1).map((i) => stops[i - 1]!),
    distanceKm: tourLength(tour, d),
  };
}

/** Largo del circuito si se visitara en el orden recibido (para comparar). */
export function circuitLengthKm(depot: Coord, ordered: Coord[]): number {
  const pts = [depot, ...ordered, depot];
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += haversineKm(pts[i - 1]!, pts[i]!);
  return total;
}
