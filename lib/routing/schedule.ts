import { haversineKm, type Coord } from "./haversine";

export type ScheduleStopInput = Coord & {
  id: string;
  /** "HH:MM" o "HH:MM:SS"; ambas o ninguna. */
  ventanaInicio?: string | null;
  ventanaFin?: string | null;
};

export type ScheduledStop = {
  id: string;
  orden: number;
  /** Distancia desde la parada anterior (o el almacén), km con 2 decimales. */
  distanciaKm: number;
  /** Tiempo de viaje desde la anterior, minutos. */
  tiempoMin: number;
  /** Hora estimada de llegada "HH:MM". */
  horaEstimadaLlegada: string;
  advertenciaVentana: boolean;
};

export type Schedule = {
  stops: ScheduledStop[];
  /** Km totales del circuito, incluido el regreso al almacén. */
  totalKm: number;
  /** Minutos totales: viaje + atención en cada parada + regreso. */
  totalMin: number;
  /** Hora estimada de regreso al almacén "HH:MM". */
  horaRegreso: string;
};

const DAY_MIN = 24 * 60;

/** "08:30" | "08:30:00" -> minutos desde medianoche; null si es inválida. */
export function parseHora(hora: string | null | undefined): number | null {
  if (!hora) return null;
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(hora.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

export function formatHora(minutos: number): string {
  const m = ((Math.round(minutos) % DAY_MIN) + DAY_MIN) % DAY_MIN;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * ETA acumulado por parada: salida + viaje (distancia / velocidad) + minutos de atención
 * en cada parada anterior. Salir de la ventana horaria del cliente NO bloquea: solo marca
 * `advertenciaVentana`.
 */
export function buildSchedule(params: {
  depot: Coord;
  orderedStops: ScheduleStopInput[];
  speedKmh: number;
  serviceMin: number;
  /** Hora de salida "HH:MM". */
  departure: string;
  /**
   * Distancia (km) de cada tramo almacén -> p1 -> ... -> pn -> almacén (n + 1 valores), p. ej. por calles.
   * Si no se pasa, se usa la distancia en línea recta (Haversine).
   */
  legsKm?: number[];
}): Schedule {
  const { depot, orderedStops, speedKmh, serviceMin, legsKm } = params;
  if (legsKm && legsKm.length !== orderedStops.length + 1) {
    throw new Error("legsKm debe tener un tramo por parada más el regreso");
  }
  const start = parseHora(params.departure);
  if (start === null) throw new Error("Hora de salida inválida");
  if (!(speedKmh > 0)) throw new Error("La velocidad promedio debe ser mayor que 0");

  let clock = start;
  let prev: Coord = depot;
  let totalKm = 0;
  const stops: ScheduledStop[] = orderedStops.map((s, i) => {
    const km = legsKm ? legsKm[i]! : haversineKm(prev, s);
    const travel = (km / speedKmh) * 60;
    const arrive = clock + travel;
    const eta = Math.round(arrive);

    const ini = parseHora(s.ventanaInicio);
    const fin = parseHora(s.ventanaFin);
    const fueraDeVentana = ini !== null && fin !== null && (eta < ini || eta > fin);

    totalKm += km;
    clock = arrive + serviceMin;
    prev = s;
    return {
      id: s.id,
      orden: i + 1,
      distanciaKm: round2(km),
      tiempoMin: Math.round(travel),
      horaEstimadaLlegada: formatHora(eta),
      // Pasada la medianoche la hora ya no es comparable con la ventana del día.
      advertenciaVentana: fueraDeVentana || eta >= DAY_MIN,
    };
  });

  const backKm = legsKm ? legsKm[orderedStops.length]! : haversineKm(prev, depot);
  const back = (backKm / speedKmh) * 60;
  totalKm += backKm;
  const end = clock + back;

  return {
    stops,
    totalKm: round2(totalKm),
    totalMin: orderedStops.length ? Math.round(end - start) : 0,
    horaRegreso: formatHora(end),
  };
}
