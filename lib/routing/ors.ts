import type { Coord } from "./haversine";
import { decodePolyline, encodePolyline, type LatLng } from "./polyline";

export type RoadRoute = {
  /** Trazado completo, polyline codificado (precisión 5). */
  geometry: string;
  /** Distancia por tramo (entre puntos consecutivos), en km. */
  legsKm: number[];
  totalKm: number;
};

type OrsResponse = {
  routes?: { geometry: string; segments?: { distance: number }[] }[];
  error?: { message?: string } | string;
};

const BASE_URL = "https://api.openrouteservice.org/v2/directions/driving-car";
/** Máximo de puntos por consulta del plan gratuito de ORS. */
export const ORS_MAX_WAYPOINTS = 50;

async function fetchChunk(
  points: Coord[],
  opts: { apiKey: string; fetchFn: typeof fetch; timeoutMs: number },
): Promise<{ path: LatLng[]; legsKm: number[] }> {
  const res = await opts.fetchFn(BASE_URL, {
    method: "POST",
    headers: { Authorization: opts.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      coordinates: points.map((p) => [p.lng, p.lat]), // ORS usa [lng, lat]
      // Con instructions:false ORS omite `segments` (la distancia por tramo); se piden y se ignoran los pasos.
      instructions: true,
      // -1 = sin límite de búsqueda: acepta clientes cuya coordenada cae algo fuera de la calle.
      radiuses: points.map(() => -1),
    }),
    signal: AbortSignal.timeout(opts.timeoutMs),
  });
  const json = (await res.json().catch(() => ({}))) as OrsResponse;
  if (!res.ok) {
    const msg = typeof json.error === "string" ? json.error : json.error?.message;
    throw new Error(`OpenRouteService respondió ${res.status}${msg ? `: ${msg}` : ""}`);
  }
  const route = json.routes?.[0];
  if (!route) throw new Error("OpenRouteService no devolvió ninguna ruta");
  if (!route.segments || route.segments.length !== points.length - 1) {
    throw new Error("OpenRouteService devolvió un número inesperado de tramos");
  }
  return {
    path: decodePolyline(route.geometry),
    legsKm: route.segments.map((s) => s.distance / 1000),
  };
}

/**
 * Trazado por calles pasando por los puntos en orden. Si hay más puntos que el límite
 * de ORS, se parte en varias consultas que comparten el punto de unión.
 */
export async function fetchRoadRoute(
  points: Coord[],
  opts: { apiKey: string; fetchFn?: typeof fetch; timeoutMs?: number },
): Promise<RoadRoute> {
  if (points.length < 2) throw new Error("Se necesitan al menos 2 puntos");
  const cfg = { apiKey: opts.apiKey, fetchFn: opts.fetchFn ?? fetch, timeoutMs: opts.timeoutMs ?? 10_000 };

  const path: LatLng[] = [];
  const legsKm: number[] = [];
  for (let i = 0; i < points.length - 1; i += ORS_MAX_WAYPOINTS - 1) {
    const chunk = await fetchChunk(points.slice(i, i + ORS_MAX_WAYPOINTS), cfg);
    path.push(...(path.length ? chunk.path.slice(1) : chunk.path)); // el punto de unión no se repite
    legsKm.push(...chunk.legsKm);
  }
  return {
    geometry: encodePolyline(path),
    legsKm,
    totalKm: legsKm.reduce((a, b) => a + b, 0),
  };
}
