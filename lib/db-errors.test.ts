import { describe, expect, it } from "vitest";
import { describeDbError } from "./db-errors";

describe("describeDbError", () => {
  it("coordenadas fuera de Perú", () => {
    const msg = describeDbError({
      code: "23514",
      message: 'new row for relation "clientes" violates check constraint "clientes_check1"',
    });
    expect(msg).toMatch(/fuera de Perú/);
  });

  it("ventana inválida", () => {
    const msg = describeDbError({
      code: "23514",
      message: 'new row for relation "clientes" violates check constraint "clientes_check3"',
    });
    expect(msg).toMatch(/posterior/);
  });

  it("check desconocido cae al mensaje por tabla", () => {
    const msg = describeDbError({
      code: "23514",
      message: 'new row for relation "clientes" violates check constraint "otro"',
    });
    expect(msg).toMatch(/cliente/);
  });

  it("DNI duplicado", () => {
    const msg = describeDbError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "choferes_usuario_key"',
    });
    expect(msg).toBe("Ya existe un chofer con ese DNI.");
  });

  it("RLS", () => {
    expect(describeDbError({ code: "42501", message: "x" })).toMatch(/permisos/);
  });
});
