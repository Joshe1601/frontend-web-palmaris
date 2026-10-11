import { describe, expect, it } from "vitest";
import { haversineKm, type Coord } from "./haversine";
import { circuitLengthKm, optimizeRoute, type Stop } from "./optimize";

const ALMACEN: Coord = { lat: -6.4833, lng: -76.3667 }; // Tarapoto

const stop = (id: string, lat: number, lng: number): Stop => ({ id, lat, lng });

/** LCG determinista para no depender de Math.random. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function puntosAlAzar(n: number, seed: number): Stop[] {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) =>
    stop(`c${i}`, -6.5 + (r() - 0.5) * 0.1, -76.37 + (r() - 0.5) * 0.1),
  );
}

function permutaciones<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutaciones([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
}

describe("haversineKm", () => {
  it("0 para el mismo punto", () => expect(haversineKm(ALMACEN, ALMACEN)).toBe(0));
  it("~111.2 km por grado de latitud", () => {
    const d = haversineKm({ lat: -6, lng: -76 }, { lat: -7, lng: -76 });
    expect(d).toBeGreaterThan(111);
    expect(d).toBeLessThan(111.5);
  });
  it("es simétrica", () => {
    const a = stop("a", -6.49, -76.36);
    expect(haversineKm(ALMACEN, a)).toBeCloseTo(haversineKm(a, ALMACEN), 10);
  });
});

describe("optimizeRoute", () => {
  it("sin clientes", () => {
    expect(optimizeRoute(ALMACEN, [])).toEqual({ order: [], distanceKm: 0 });
  });

  it("1 cliente: ida y vuelta al almacén", () => {
    const a = stop("a", -6.49, -76.37);
    const r = optimizeRoute(ALMACEN, [a]);
    expect(r.order).toEqual([a]);
    expect(r.distanceKm).toBeCloseTo(2 * haversineKm(ALMACEN, a), 10);
  });

  it("2 clientes: el circuito es el mismo en ambos órdenes y visita ambos", () => {
    const a = stop("a", -6.49, -76.37);
    const b = stop("b", -6.5, -76.39);
    const r = optimizeRoute(ALMACEN, [a, b]);
    expect(r.order.map((s) => s.id).sort()).toEqual(["a", "b"]);
    expect(r.distanceKm).toBeCloseTo(
      haversineKm(ALMACEN, a) + haversineKm(a, b) + haversineKm(b, ALMACEN),
      10,
    );
  });

  it("clientes en la misma coordenada: no falla y no suma distancia entre ellos", () => {
    const iguales = [stop("a", -6.49, -76.37), stop("b", -6.49, -76.37), stop("c", -6.49, -76.37)];
    const r = optimizeRoute(ALMACEN, iguales);
    expect(r.order).toHaveLength(3);
    expect(new Set(r.order.map((s) => s.id)).size).toBe(3);
    expect(r.distanceKm).toBeCloseTo(2 * haversineKm(ALMACEN, iguales[0]!), 10);
    expect(r.distanceKm).not.toBeNaN();
  });

  it("clientes en el mismo punto que el almacén", () => {
    const r = optimizeRoute(ALMACEN, [stop("a", ALMACEN.lat, ALMACEN.lng), stop("b", ALMACEN.lat, ALMACEN.lng)]);
    expect(r.distanceKm).toBe(0);
    expect(r.order).toHaveLength(2);
  });

  it("30 clientes: visita a todos una sola vez y 2-opt no empeora al vecino más cercano", () => {
    const stops = puntosAlAzar(30, 42);
    const r = optimizeRoute(ALMACEN, stops);
    expect(r.order).toHaveLength(30);
    expect(new Set(r.order.map((s) => s.id))).toEqual(new Set(stops.map((s) => s.id)));
    // la distancia reportada coincide con recorrer el orden devuelto
    expect(r.distanceKm).toBeCloseTo(circuitLengthKm(ALMACEN, r.order), 9);
    // y es mucho mejor que el orden de entrada (aleatorio)
    expect(r.distanceKm).toBeLessThan(circuitLengthKm(ALMACEN, stops) * 0.6);
  });

  it("30 clientes: resultado determinista", () => {
    const stops = puntosAlAzar(30, 7);
    const a = optimizeRoute(ALMACEN, stops).order.map((s) => s.id);
    const b = optimizeRoute(ALMACEN, [...stops]).order.map((s) => s.id);
    expect(a).toEqual(b);
  });

  it("puntos sobre una línea desde el almacén: orden por cercanía", () => {
    const linea = [4, 1, 3, 2, 5].map((k) => stop(`p${k}`, ALMACEN.lat - 0.01 * k, ALMACEN.lng));
    const r = optimizeRoute(ALMACEN, linea);
    expect(r.order.map((s) => s.id)).toEqual(["p1", "p2", "p3", "p4", "p5"]);
  });

  it("2-opt corrige un cruce que el vecino más cercano deja", () => {
    // Cuadrado: el recorrido óptimo es el perímetro (sin diagonales)
    const d = 0.02;
    const cuadro = [
      stop("sw", ALMACEN.lat - d, ALMACEN.lng - d),
      stop("ne", ALMACEN.lat + d, ALMACEN.lng + d),
      stop("se", ALMACEN.lat - d, ALMACEN.lng + d),
      stop("nw", ALMACEN.lat + d, ALMACEN.lng - d),
    ];
    const r = optimizeRoute(ALMACEN, cuadro);
    const optimo = Math.min(
      ...permutaciones(cuadro).map((p) => circuitLengthKm(ALMACEN, p)),
    );
    expect(r.distanceKm).toBeCloseTo(optimo, 6);
  });

  it("cerca del óptimo en instancias pequeñas (≤ 5 % sobre fuerza bruta)", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const stops = puntosAlAzar(7, seed);
      const optimo = Math.min(...permutaciones(stops).map((p) => circuitLengthKm(ALMACEN, p)));
      const r = optimizeRoute(ALMACEN, stops);
      expect(r.distanceKm).toBeLessThanOrEqual(optimo * 1.05);
    }
  });

  it("no muta la lista de entrada", () => {
    const stops = puntosAlAzar(10, 3);
    const copia = stops.map((s) => s.id);
    optimizeRoute(ALMACEN, stops);
    expect(stops.map((s) => s.id)).toEqual(copia);
  });

  it("conserva campos extra de las paradas", () => {
    const r = optimizeRoute(ALMACEN, [{ ...stop("a", -6.49, -76.37), pedidoIds: ["p1"] }]);
    expect(r.order[0]!.pedidoIds).toEqual(["p1"]);
  });
});
