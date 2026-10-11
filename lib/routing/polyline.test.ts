import { describe, expect, it } from "vitest";
import { decodePolyline, encodePolyline } from "./polyline";

describe("polyline", () => {
  it("decodifica el ejemplo oficial de Google", () => {
    const pts = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(pts).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ]);
  });

  it("ida y vuelta conserva los puntos (5 decimales)", () => {
    const pts: [number, number][] = [
      [-6.48331, -76.36672],
      [-6.35968, -76.54363],
      [-6.4851, -76.33938],
    ];
    expect(decodePolyline(encodePolyline(pts))).toEqual(pts);
  });

  it("vacío", () => {
    expect(decodePolyline("")).toEqual([]);
    expect(encodePolyline([])).toBe("");
  });
});
