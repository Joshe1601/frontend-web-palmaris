/** Validaciones de formulario que replican los CHECK de la BD (la BD sigue siendo la barrera final). */

export const PERU = { latMin: -18.5, latMax: 0.1, lngMin: -81.5, lngMax: -68.5 } as const;

export type CoordResult = {
  lat: number | null;
  lng: number | null;
  errors: { lat?: string; lng?: string };
};

function parseNum(v: string): number | null {
  const t = v.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/** Latitud/longitud como texto de formulario: ambas o ninguna, dentro de Perú. */
export function validarCoordenadas(latStr: string, lngStr: string): CoordResult {
  const lat = parseNum(latStr);
  const lng = parseNum(lngStr);
  const errors: CoordResult["errors"] = {};

  if (Number.isNaN(lat)) errors.lat = "Latitud no válida.";
  if (Number.isNaN(lng)) errors.lng = "Longitud no válida.";
  if (!errors.lat && !errors.lng) {
    if (lat === null && lng !== null) errors.lat = "Falta la latitud (o deja ambas vacías).";
    else if (lng === null && lat !== null) errors.lng = "Falta la longitud (o deja ambas vacías).";
    else if (lat !== null && lng !== null) {
      if (lat < PERU.latMin || lat > PERU.latMax) {
        errors.lat = `Fuera de Perú: debe estar entre ${PERU.latMin} y ${PERU.latMax}. En Tarapoto ronda -6.5.`;
      }
      if (lng < PERU.lngMin || lng > PERU.lngMax) {
        errors.lng = `Fuera de Perú: debe estar entre ${PERU.lngMin} y ${PERU.lngMax}. En Tarapoto ronda -76.4.`;
      }
    }
  }
  return { lat: Number.isNaN(lat) ? null : lat, lng: Number.isNaN(lng) ? null : lng, errors };
}

/** Ventana horaria "HH:MM": ambas o ninguna, fin posterior al inicio. */
export function validarVentana(inicio: string, fin: string): string | null {
  if (!inicio && !fin) return null;
  if (!inicio || !fin) return "Indica hora de inicio y de fin, o deja ambas vacías.";
  if (fin <= inicio) return "La hora de fin debe ser posterior a la de inicio.";
  return null;
}

export function parseOpcionalNumero(v: string): number | null {
  const n = parseNum(v);
  return n === null || Number.isNaN(n) ? null : n;
}
