import { haversineKm, type Coord } from "../routing/haversine";

export type Ping = { lat: number; lng: number; at: string };

export type Estacionamiento = {
  inicio: string;
  fin: string;
  minutos: number;
  lat: number;
  lng: number;
  /** El camión sigue detenido en el último ping recibido. */
  enCurso: boolean;
};

const MIN = 60_000;
const distM = (a: Coord, b: Coord) => haversineKm(a, b) * 1000;

/**
 * Detecta periodos en los que el camión estuvo detenido (todos los pings dentro de `radioM` del
 * primero) durante al menos `umbralMin` minutos. Un hueco sin señal mayor a `maxHuecoMin` corta el periodo.
 */
export function detectarEstacionamientos(
  pings: Ping[],
  opts: { umbralMin: number; radioM?: number; maxHuecoMin?: number; ahora?: number },
): Estacionamiento[] {
  const radioM = opts.radioM ?? 50;
  const maxHueco = (opts.maxHuecoMin ?? 15) * MIN;
  const ahora = opts.ahora ?? Date.now();
  const sorted = [...pings].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const out: Estacionamiento[] = [];

  let i = 0;
  while (i < sorted.length) {
    const anchor = sorted[i]!;
    let j = i;
    while (
      j + 1 < sorted.length &&
      distM(anchor, sorted[j + 1]!) <= radioM &&
      Date.parse(sorted[j + 1]!.at) - Date.parse(sorted[j]!.at) <= maxHueco
    ) {
      j++;
    }
    const last = sorted[j]!;
    const enCurso = j === sorted.length - 1 && ahora - Date.parse(last.at) <= maxHueco;
    const fin = enCurso ? Math.max(ahora, Date.parse(last.at)) : Date.parse(last.at);
    const minutos = (fin - Date.parse(anchor.at)) / MIN;
    if (j > i && minutos >= opts.umbralMin) {
      out.push({
        inicio: anchor.at,
        fin: new Date(fin).toISOString(),
        minutos: Math.round(minutos * 10) / 10,
        lat: anchor.lat,
        lng: anchor.lng,
        enCurso,
      });
    }
    i = j + 1;
  }
  return out;
}

/** Parada más cercana (dentro de `radioM`) a un punto; null si ninguna está cerca. */
export function paradaCercana<T extends Coord>(punto: Coord, paradas: T[], radioM: number): T | null {
  let best: T | null = null;
  let bestD = Infinity;
  for (const p of paradas) {
    const d = distM(punto, p);
    if (d <= radioM && d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}
