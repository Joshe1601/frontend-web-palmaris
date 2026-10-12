import { describe, expect, it } from "vitest";
import { detectarEstacionamientos, paradaCercana, type Ping } from "./estacionamientos";

const T0 = Date.parse("2026-10-12T14:00:00Z");
const ping = (min: number, dLat = 0, dLng = 0): Ping => ({
  lat: -6.4 + dLat,
  lng: -76.4 + dLng,
  at: new Date(T0 + min * 60_000).toISOString(),
});
const AHORA = T0 + 3 * 3_600_000;

describe("detectarEstacionamientos", () => {
  it("detecta 10 min detenido (con ruido GPS) con umbral de 7", () => {
    const pings = [0, 1, 2, 4, 6, 8, 10].map((m, i) => ping(m, 0.00005 * (i % 2), 0.00005));
    const r = detectarEstacionamientos(pings, { umbralMin: 7, ahora: AHORA });
    expect(r).toHaveLength(1);
    expect(r[0]!.minutos).toBe(10);
    expect(r[0]!.enCurso).toBe(false);
  });

  it("no detecta si se mueve", () => {
    const pings = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((m) => ping(m, m * 0.002));
    expect(detectarEstacionamientos(pings, { umbralMin: 7, ahora: AHORA })).toEqual([]);
  });

  it("no detecta si está detenido menos del umbral", () => {
    const pings = [0, 1, 2, 3, 5].map((m) => ping(m));
    expect(detectarEstacionamientos(pings, { umbralMin: 7, ahora: AHORA })).toEqual([]);
  });

  it("separa dos estacionamientos", () => {
    const a = [0, 4, 8].map((m) => ping(m));
    const b = [10, 11, 20, 28].map((m) => ping(m, 0.05));
    const r = detectarEstacionamientos([...a, ...b], { umbralMin: 7, ahora: AHORA });
    expect(r).toHaveLength(2);
  });

  it("un hueco sin señal largo corta el periodo", () => {
    const pings = [ping(0), ping(2), ping(40), ping(42)];
    expect(detectarEstacionamientos(pings, { umbralMin: 7, maxHuecoMin: 15, ahora: AHORA })).toEqual([]);
  });

  it("marca en curso si sigue detenido y el último ping es reciente", () => {
    const pings = [0, 4, 8].map((m) => ping(m));
    const ahora = T0 + 9 * 60_000;
    const r = detectarEstacionamientos(pings, { umbralMin: 7, ahora });
    expect(r[0]!.enCurso).toBe(true);
    expect(r[0]!.minutos).toBe(9);
  });

  it("sin pings", () => {
    expect(detectarEstacionamientos([], { umbralMin: 7 })).toEqual([]);
  });
});

describe("paradaCercana", () => {
  const paradas = [
    { id: "a", lat: -6.4, lng: -76.4 },
    { id: "b", lat: -6.4, lng: -76.3995 },
  ];
  it("elige la más cercana dentro del radio", () => {
    expect(paradaCercana({ lat: -6.4, lng: -76.39951 }, paradas, 100)!.id).toBe("b");
  });
  it("null si está lejos", () => {
    expect(paradaCercana({ lat: -6.5, lng: -76.4 }, paradas, 100)).toBeNull();
  });
});
