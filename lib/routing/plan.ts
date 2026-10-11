import type { Coord } from "./haversine";
import { optimizeRoute } from "./optimize";
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
};

/** Optimiza el orden, calcula ETAs y arma el arreglo de paradas para la RPC. Sin I/O. */
export function planificarRuta(params: {
  depot: Coord;
  clientes: ClientePlan[];
  speedKmh: number;
  serviceMin: number;
  horaSalida: string;
}): RutaPlanificada {
  const { depot, clientes } = params;
  const porId = new Map(clientes.map((c) => [c.id, c]));
  const { order } = optimizeRoute(
    depot,
    clientes.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng })),
  );
  const schedule = buildSchedule({
    depot,
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
  };
}
