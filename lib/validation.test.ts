import { describe, expect, it } from "vitest";
import { validarCoordenadas, validarVentana } from "./validation";

describe("validarCoordenadas", () => {
  it("acepta vacías", () => {
    const r = validarCoordenadas("", "");
    expect(r.errors).toEqual({});
    expect(r.lat).toBeNull();
  });
  it("acepta Tarapoto (con coma decimal)", () => {
    const r = validarCoordenadas("-6,4833", "-76.3667");
    expect(r.errors).toEqual({});
    expect(r.lat).toBe(-6.4833);
  });
  it("exige ambas", () => {
    expect(validarCoordenadas("-6.4", "").errors.lng).toBeDefined();
  });
  it("detecta lat/lng invertidas", () => {
    const r = validarCoordenadas("-76.3", "-6.4");
    expect(r.errors.lat).toBeDefined();
    expect(r.errors.lng).toBeDefined();
  });
  it("detecta signo faltante", () => {
    expect(validarCoordenadas("6.4", "-76.3").errors.lat).toBeDefined();
  });
  it("rechaza texto", () => {
    expect(validarCoordenadas("abc", "").errors.lat).toBeDefined();
  });
});

describe("validarVentana", () => {
  it("vacía es válida", () => expect(validarVentana("", "")).toBeNull());
  it("fin debe ser posterior", () => expect(validarVentana("10:00", "09:00")).not.toBeNull());
  it("exige ambas", () => expect(validarVentana("10:00", "")).not.toBeNull());
  it("válida", () => expect(validarVentana("08:00", "12:00")).toBeNull());
});
