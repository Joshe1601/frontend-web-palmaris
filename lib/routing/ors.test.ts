import { describe, expect, it, vi } from "vitest";
import { ORS_MAX_WAYPOINTS, fetchRoadRoute } from "./ors";
import { decodePolyline, encodePolyline } from "./polyline";

const pts = (n: number) => Array.from({ length: n }, (_, i) => ({ lat: -6.4 - i * 0.001, lng: -76.4 }));

/** Simula ORS: cada tramo mide 1000 m y la geometría une los puntos pedidos. */
function fakeOrs() {
  return vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const { coordinates } = JSON.parse(String(init!.body)) as { coordinates: [number, number][] };
    const path = coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
    return new Response(
      JSON.stringify({
        routes: [{ geometry: encodePolyline(path), segments: path.slice(1).map(() => ({ distance: 1000 })) }],
      }),
      { status: 200 },
    );
  });
}

describe("fetchRoadRoute", () => {
  it("una consulta: tramos en km y geometría", async () => {
    const f = fakeOrs();
    const r = await fetchRoadRoute(pts(4), { apiKey: "k", fetchFn: f as unknown as typeof fetch });
    expect(f).toHaveBeenCalledTimes(1);
    expect(r.legsKm).toEqual([1, 1, 1]);
    expect(r.totalKm).toBe(3);
    expect(decodePolyline(r.geometry)).toHaveLength(4);
  });

  it("envía [lng, lat], la clave y radio ilimitado", async () => {
    const f = fakeOrs();
    await fetchRoadRoute(pts(2), { apiKey: "mi-clave", fetchFn: f as unknown as typeof fetch });
    const [, init] = f.mock.calls[0]!;
    expect((init!.headers as Record<string, string>).Authorization).toBe("mi-clave");
    const body = JSON.parse(String(init!.body));
    expect(body.coordinates[0]).toEqual([-76.4, -6.4]);
    expect(body.radiuses).toEqual([-1, -1]);
  });

  it("parte en varias consultas si superan el límite y no repite el punto de unión", async () => {
    const f = fakeOrs();
    const n = ORS_MAX_WAYPOINTS + 10; // 60 puntos -> 2 consultas
    const r = await fetchRoadRoute(pts(n), { apiKey: "k", fetchFn: f as unknown as typeof fetch });
    expect(f).toHaveBeenCalledTimes(2);
    expect(r.legsKm).toHaveLength(n - 1);
    expect(decodePolyline(r.geometry)).toHaveLength(n);
  });

  it("lanza con el mensaje de ORS si responde error", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ error: { message: "Quota exceeded" } }), { status: 403 }));
    await expect(fetchRoadRoute(pts(2), { apiKey: "k", fetchFn: f as unknown as typeof fetch })).rejects.toThrow(
      /403.*Quota exceeded/,
    );
  });

  it("pide instrucciones (sin ellas ORS no devuelve los tramos)", async () => {
    const f = fakeOrs();
    await fetchRoadRoute(pts(2), { apiKey: "k", fetchFn: f as unknown as typeof fetch });
    expect(JSON.parse(String(f.mock.calls[0]![1]!.body)).instructions).toBe(true);
  });

  it("error claro si la respuesta no trae tramos", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ routes: [{ geometry: "" }] }), { status: 200 }));
    await expect(fetchRoadRoute(pts(2), { apiKey: "k", fetchFn: f as unknown as typeof fetch })).rejects.toThrow(
      /tramos/,
    );
  });

  it("exige al menos 2 puntos", async () => {
    await expect(fetchRoadRoute(pts(1), { apiKey: "k" })).rejects.toThrow();
  });
});
