/** Traduce errores de Postgres/PostgREST (CHECK, UNIQUE, RLS...) a mensajes legibles. */

export type DbErrorLike = { code?: string; message?: string; details?: string | null };

const CHECKS: Record<string, string> = {
  clientes_check: "Indica latitud y longitud juntas, o deja ambas vacías.",
  clientes_check1:
    "Las coordenadas están fuera de Perú. La latitud debe estar entre -18.5 y 0.1 y la longitud entre -81.5 y -68.5 (revisa que no estén invertidas ni sin el signo negativo).",
  clientes_check2: "Indica la hora de inicio y la de fin de la ventana horaria, o deja ambas vacías.",
  clientes_check3: "La hora de fin de la ventana horaria debe ser posterior a la de inicio.",
  configuracion_check: "Indica latitud y longitud del almacén juntas, o deja ambas vacías.",
  configuracion_velocidad_promedio_kmh_check: "La velocidad promedio debe ser mayor que 0.",
  configuracion_tiempo_atencion_min_check: "Los minutos de atención no pueden ser negativos.",
  vehiculos_capacidad_kg_check: "La capacidad debe ser mayor que 0.",
  pedidos_peso_kg_check: "El peso no puede ser negativo.",
};

const UNIQUES: Record<string, string> = {
  choferes_usuario_key: "Ya existe un chofer con ese DNI.",
  vehiculos_placa_key: "Ya existe un vehículo con esa placa.",
  choferes_auth_user_id_key: "Ese usuario ya está asociado a otro chofer.",
};

const CHECK_POR_TABLA: Record<string, string> = {
  clientes:
    "Los datos no cumplen las reglas del cliente: coordenadas dentro de Perú (ambas o ninguna) y ventana horaria con fin posterior al inicio.",
  configuracion: "Los datos de configuración no son válidos.",
  vehiculos: "Los datos del vehículo no son válidos.",
  pedidos: "Los datos del pedido no son válidos.",
};

export function describeDbError(error: DbErrorLike): string {
  const text = `${error.message ?? ""} ${error.details ?? ""}`;
  const constraint = /constraint "([^"]+)"/.exec(text)?.[1];
  const relation = /relation "([^"]+)"/.exec(text)?.[1];

  if (error.code === "23514") {
    if (constraint && CHECKS[constraint]) return CHECKS[constraint];
    if (relation && CHECK_POR_TABLA[relation]) return CHECK_POR_TABLA[relation];
    return "Algún dato no cumple las reglas de validación.";
  }
  if (error.code === "23505") {
    return (constraint && UNIQUES[constraint]) || "Ya existe un registro con esos datos.";
  }
  if (error.code === "23503") return "El registro está relacionado con otros datos o no existe.";
  if (error.code === "23502") return "Falta completar un campo obligatorio.";
  if (error.code === "22003") return "Un valor numérico está fuera del rango permitido.";
  if (error.code === "22007" || error.code === "22008") return "Fecha u hora con formato inválido.";
  if (error.code === "42501" || /row-level security/i.test(text)) {
    return "No tienes permisos para realizar esta operación.";
  }
  return error.message || "Ocurrió un error inesperado.";
}
