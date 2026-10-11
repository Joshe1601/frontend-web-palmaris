import type { Coord } from "./haversine";
import { optimizeRoute } from "./optimize";
import type { RoadRoute } from "./ors";
import { buildSchedule } from "./schedule";

export type ClientePlan = {
  id: string;
  lat: number;
  lng: number;
  ventana_horario_inicio?: string | null;
  ventana_horario_fin?: string | null;
  /** Pedidos pendientes del cliente: todos van en UNA sola parada. */
  pedidoIds: string[];
};

/** Un elemento de `p_paradas` en el formato que documenta `crear_ruta_con_paradas`. */
export type ParadaRpc = {
  cliente_id: string;
  orden: number;
  distancia_km: number;
  tiempo_min: number;
  hora_estimada_llegada: string;
  advertencia_ventana: boolean;
  pedido_ids: string[];
};

export type RutaPlanificada = {
  paradas: ParadaRpc[];
  totalKm: number;
  totalMin: number;
  horaRegreso: string;
  /** Trazado por calles (polyline) o null si no hubo ruteo vial. */
  geometria: string | null;
  ruteo: "vial" | "lineal";
};

/**
 * Optimiza el orden (Haversine), pide opcionalmente el trazado por calles al `roadProvider`,
 * calcula ETAs y arma el arreglo de paradas para la RPC. Si el proveedor falla, se usa línea recta.
 * Los tiempos salen siempre de la velocidad promedio configurada.
 */
export async function planificarRuta(
  params: {
    depot: Coord;
    clientes: ClientePlan[];
    speedKmh: number;
    serviceMin: number;
    horaSalida: string;
  },
  roadProvider?: (puntos: Coord[]) => Promise<RoadRoute>,
): Promise<RutaPlanificada> {
  const { depot, clientes } = params;
  const porId = new Map(clientes.map((c) => [c.id, c]));
  const { order } = optimizeRoute(
    depot,
    clientes.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng })),
  );

  let road: RoadRoute | null = null;
  if (roadProvider) {
    try {
      road = await roadProvider([depot, ...order, depot]);
    } catch {
      road = null; // sin servicio de ruteo: se sigue con línea recta
    }
  }

  const schedule = buildSchedule({
    depot,
    legsKm: road?.legsKm,
    orderedStops: order.map((s) => ({
      ...s,
      ventanaInicio: porId.get(s.id)!.ventana_horario_inicio,
      ventanaFin: porId.get(s.id)!.ventana_horario_fin,
    })),
    speedKmh: params.speedKmh,
    serviceMin: params.serviceMin,
    departure: params.horaSalida,
  });

  return {
    paradas: schedule.stops.map((s) => ({
      cliente_id: s.id,
      orden: s.orden,
      distancia_km: s.distanciaKm,
      tiempo_min: s.tiempoMin,
      hora_estimada_llegada: s.horaEstimadaLlegada,
      advertencia_ventana: s.advertenciaVentana,
      pedido_ids: porId.get(s.id)!.pedidoIds,
    })),
    totalKm: schedule.totalKm,
    totalMin: schedule.totalMin,
    horaRegreso: schedule.horaRegreso,
    geometria: road?.geometry ?? null,
    ruteo: road ? "vial" : "lineal",
  };
}
