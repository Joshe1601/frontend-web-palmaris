/** Fecha de hoy (YYYY-MM-DD) en hora de Perú, independiente de la zona del navegador. */
export function hoyLima(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
}

/** "2026-10-07" -> "07/10/2026" */
export function fechaCorta(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** "08:35:00" -> "08:35" */
export function horaCorta(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : "—";
}

export function minutosATexto(min: number | null | undefined): string {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}

export function kmATexto(km: number | null | undefined): string {
  return km == null ? "—" : `${Number(km).toFixed(1)} km`;
}

export function iniciales(nombre: string): string {
  return (
    nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("") || "?"
  );
}

/** Hora local de Perú (HH:MM) de un instante ISO. */
export function horaLima(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** Minutos (con un decimal) entre dos instantes ISO. */
export function minutosEntre(desde: string, hasta: string): number {
  return Math.round(((Date.parse(hasta) - Date.parse(desde)) / 60_000) * 10) / 10;
}
