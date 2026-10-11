import { describe, expect, it } from "vitest";
import { haversineKm } from "./haversine";
import { buildSchedule, formatHora, parseHora } from "./schedule";

const ALMACEN = { lat: -6.4833, lng: -76.3667 };
// ~11.1 km al sur del almacén (0.1° de latitud)
const A = { id: "a", lat: ALMACEN.lat - 0.1, lng: ALMACEN.lng };
const B = { id: "b", lat: ALMACEN.lat - 0.2, lng: ALMACEN.lng };

describe("parseHora / formatHora", () => {
  it("parsea HH:MM y HH:MM:SS", () => {
    expect(parseHora("08:30")).toBe(510);
    expect(parseHora("08:30:00")).toBe(510);
  });
  it("rechaza inválidas", () => {
    expect(parseHora("25:00")).toBeNull();
    expect(parseHora("abc")).toBeNull();
    expect(parseHora(null)).toBeNull();
  });
  it("formatea y envuelve pasada la medianoche", () => {
    expect(formatHora(510)).toBe("08:30");
    expect(formatHora(1500)).toBe("01:00");
  });
});

describe("buildSchedule", () => {
  const base = { depot: ALMACEN, speedKmh: 30, serviceMin: 10, departure: "08:00" };

  it("acumula viaje + atención por parada", () => {
    const s = buildSchedule({ ...base, orderedStops: [A, B] });
    const kmA = haversineKm(ALMACEN, A);
    const kmAB = haversineKm(A, B);
    const t1 = (kmA / 30) * 60;
    const t2 = (kmAB / 30) * 60;
    expect(s.stops[0]!.tiempoMin).toBe(Math.round(t1));
    expect(s.stops[0]!.horaEstimadaLlegada).toBe(formatHora(480 + t1));
    // la segunda llegada incluye los 10 min de atención de la primera
    expect(s.stops[1]!.horaEstimadaLlegada).toBe(formatHora(480 + t1 + 10 + t2));
    expect(s.stops.map((x) => x.orden)).toEqual([1, 2]);
  });

  it("total = viaje ida y vuelta + atención en cada parada", () => {
    const s = buildSchedule({ ...base, orderedStops: [A, B] });
    const viaje = ((haversineKm(ALMACEN, A) + haversineKm(A, B) + haversineKm(B, ALMACEN)) / 30) * 60;
    expect(s.totalMin).toBe(Math.round(viaje + 20));
    expect(s.totalKm).toBeCloseTo(haversineKm(ALMACEN, A) + haversineKm(A, B) + haversineKm(B, ALMACEN), 1);
  });

  it("sin paradas: total 0", () => {
    const s = buildSchedule({ ...base, orderedStops: [] });
    expect(s).toMatchObject({ stops: [], totalKm: 0, totalMin: 0 });
  });

  it("ETA fuera de ventana marca advertencia pero no bloquea", () => {
    // A llega ~08:22; ventana 09:00-10:00 -> advertencia
    const s = buildSchedule({
      ...base,
      orderedStops: [{ ...A, ventanaInicio: "09:00:00", ventanaFin: "10:00:00" }, B],
    });
    expect(s.stops[0]!.advertenciaVentana).toBe(true);
    expect(s.stops[1]!.advertenciaVentana).toBe(false); // sin ventana
    expect(s.stops).toHaveLength(2);
  });

  it("ETA dentro de la ventana no advierte", () => {
    const s = buildSchedule({
      ...base,
      orderedStops: [{ ...A, ventanaInicio: "08:00", ventanaFin: "09:00" }],
    });
    expect(s.stops[0]!.advertenciaVentana).toBe(false);
  });

  it("llegar después del fin de ventana advierte", () => {
    const s = buildSchedule({
      ...base,
      departure: "11:00",
      orderedStops: [{ ...A, ventanaInicio: "08:00", ventanaFin: "10:00" }],
    });
    expect(s.stops[0]!.advertenciaVentana).toBe(true);
  });

  it("valida velocidad y hora de salida", () => {
    expect(() => buildSchedule({ ...base, speedKmh: 0, orderedStops: [A] })).toThrow();
    expect(() => buildSchedule({ ...base, departure: "xx", orderedStops: [A] })).toThrow();
  });

  it("clientes en la misma coordenada: distancia 0 entre ellos, solo suma atención", () => {
    const s = buildSchedule({ ...base, orderedStops: [A, { ...A, id: "a2" }] });
    expect(s.stops[1]!.distanciaKm).toBe(0);
    expect(s.stops[1]!.tiempoMin).toBe(0);
    const t1 = (haversineKm(ALMACEN, A) / 30) * 60;
    expect(s.stops[1]!.horaEstimadaLlegada).toBe(formatHora(480 + t1 + 10));
  });
});
