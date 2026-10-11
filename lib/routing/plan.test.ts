import { describe, expect, it } from "vitest";
import { planificarRuta, type ClientePlan } from "./plan";

const ALMACEN = { lat: -6.4833, lng: -76.3667 };
const base = { depot: ALMACEN, speedKmh: 30, serviceMin: 10, horaSalida: "08:00" };

const cliente = (id: string, dLat: number, pedidoIds: string[], extra: Partial<ClientePlan> = {}): ClientePlan => ({
  id,
  lat: ALMACEN.lat - dLat,
  lng: ALMACEN.lng,
  pedidoIds,
  ...extra,
});

describe("planificarRuta", () => {
  it("una parada por cliente, con todos sus pedidos consolidados", () => {
    const r = planificarRuta({
      ...base,
      clientes: [cliente("c1", 0.02, ["p1", "p2", "p3"]), cliente("c2", 0.05, ["p4"])],
    });
    expect(r.paradas).toHaveLength(2);
    expect(r.paradas.find((p) => p.cliente_id === "c1")!.pedido_ids).toEqual(["p1", "p2", "p3"]);
    expect(r.paradas.map((p) => p.orden)).toEqual([1, 2]);
  });

  it("usa exactamente las claves que documenta la RPC", () => {
    const r = planificarRuta({ ...base, clientes: [cliente("c1", 0.02, ["p1"])] });
    expect(Object.keys(r.paradas[0]!).sort()).toEqual(
      ["advertencia_ventana", "cliente_id", "distancia_km", "hora_estimada_llegada", "orden", "pedido_ids", "tiempo_min"].sort(),
    );
    expect(r.paradas[0]!.hora_estimada_llegada).toMatch(/^\d{2}:\d{2}$/);
  });

  it("marca advertencia (sin bloquear) si el ETA cae fuera de la ventana", () => {
    const r = planificarRuta({
      ...base,
      clientes: [
        cliente("c1", 0.02, ["p1"], { ventana_horario_inicio: "14:00:00", ventana_horario_fin: "16:00:00" }),
        cliente("c2", 0.05, ["p2"]),
      ],
    });
    expect(r.paradas).toHaveLength(2);
    expect(r.paradas.find((p) => p.cliente_id === "c1")!.advertencia_ventana).toBe(true);
    expect(r.paradas.find((p) => p.cliente_id === "c2")!.advertencia_ventana).toBe(false);
  });

  it("totales > 0 y regreso posterior a la salida", () => {
    const r = planificarRuta({ ...base, clientes: [cliente("c1", 0.05, ["p1"])] });
    expect(r.totalKm).toBeGreaterThan(0);
    expect(r.totalMin).toBeGreaterThan(10);
    expect(r.horaRegreso > "08:00").toBe(true);
  });
});
