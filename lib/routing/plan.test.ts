import { describe, expect, it } from "vitest";
import { planificarRuta, type ClientePlan } from "./plan";
import type { RoadRoute } from "./ors";

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
  it("una parada por cliente, con todos sus pedidos consolidados", async () => {
    const r = await planificarRuta({
      ...base,
      clientes: [cliente("c1", 0.02, ["p1", "p2", "p3"]), cliente("c2", 0.05, ["p4"])],
    });
    expect(r.paradas).toHaveLength(2);
    expect(r.paradas.find((p) => p.cliente_id === "c1")!.pedido_ids).toEqual(["p1", "p2", "p3"]);
    expect(r.paradas.map((p) => p.orden)).toEqual([1, 2]);
  });

  it("usa exactamente las claves que documenta la RPC", async () => {
    const r = await planificarRuta({ ...base, clientes: [cliente("c1", 0.02, ["p1"])] });
    expect(Object.keys(r.paradas[0]!).sort()).toEqual(
      ["advertencia_ventana", "cliente_id", "distancia_km", "hora_estimada_llegada", "orden", "pedido_ids", "tiempo_min"].sort(),
    );
    expect(r.paradas[0]!.hora_estimada_llegada).toMatch(/^\d{2}:\d{2}$/);
  });

  it("marca advertencia (sin bloquear) si el ETA cae fuera de la ventana", async () => {
    const r = await planificarRuta({
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

  it("totales > 0 y regreso posterior a la salida", async () => {
    const r = await planificarRuta({ ...base, clientes: [cliente("c1", 0.05, ["p1"])] });
    expect(r.totalKm).toBeGreaterThan(0);
    expect(r.totalMin).toBeGreaterThan(10);
    expect(r.horaRegreso > "08:00").toBe(true);
  });

  it("sin proveedor vial: ruteo lineal y sin geometría", async () => {
    const r = await planificarRuta({ ...base, clientes: [cliente("c1", 0.05, ["p1"])] });
    expect(r.ruteo).toBe("lineal");
    expect(r.geometria).toBeNull();
  });

  it("con proveedor vial: usa sus distancias y guarda la geometría", async () => {
    const proveedor = async (): Promise<RoadRoute> => ({ geometry: "abc", legsKm: [20, 20], totalKm: 40 });
    const r = await planificarRuta({ ...base, clientes: [cliente("c1", 0.05, ["p1"])] }, proveedor);
    expect(r.ruteo).toBe("vial");
    expect(r.geometria).toBe("abc");
    expect(r.paradas[0]!.distancia_km).toBe(20);
    expect(r.totalKm).toBe(40);
  });

  it("si el proveedor falla, cae a línea recta sin lanzar", async () => {
    const proveedor = async (): Promise<RoadRoute> => {
      throw new Error("sin cuota");
    };
    const r = await planificarRuta({ ...base, clientes: [cliente("c1", 0.05, ["p1"])] }, proveedor);
    expect(r.ruteo).toBe("lineal");
    expect(r.paradas).toHaveLength(1);
  });
});
