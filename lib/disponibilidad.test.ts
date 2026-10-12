import { describe, expect, it } from "vitest";
import { choferesOcupados, type RutaAbierta } from "./disponibilidad";

const r = (chofer_id: string, fecha: string, estado: RutaAbierta["estado"]): RutaAbierta => ({ chofer_id, fecha, estado });

describe("choferesOcupados", () => {
  it("ruta pendiente el mismo día ocupa al chofer", () => {
    expect([...choferesOcupados([r("a", "2026-10-12", "pendiente")], "2026-10-12")]).toEqual(["a"]);
  });
  it("ruta pendiente de otro día no lo ocupa", () => {
    expect(choferesOcupados([r("a", "2026-10-13", "pendiente")], "2026-10-12").size).toBe(0);
  });
  it("ruta en curso lo ocupa sea cual sea la fecha", () => {
    expect(choferesOcupados([r("a", "2026-10-10", "en_curso")], "2026-10-12").has("a")).toBe(true);
  });
  it("varios choferes", () => {
    const s = choferesOcupados([r("a", "2026-10-12", "pendiente"), r("b", "2026-10-12", "en_curso")], "2026-10-12");
    expect(s.size).toBe(2);
  });
});
