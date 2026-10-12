export type RutaAbierta = { chofer_id: string; fecha: string; estado: "pendiente" | "en_curso" };

/**
 * Choferes que no se pueden asignar a una ruta nueva en `fecha`: los que ya tienen una ruta
 * pendiente/en curso ese día, y los que tienen una ruta en curso (solo puede haber una a la vez).
 */
export function choferesOcupados(abiertas: RutaAbierta[], fecha: string): Set<string> {
  return new Set(
    abiertas.filter((r) => r.estado === "en_curso" || r.fecha === fecha).map((r) => r.chofer_id),
  );
}
