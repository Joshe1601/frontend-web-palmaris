import type { Tone } from "@/components/map/types";
import type { Enums } from "@/types/database";

const PALETA: Tone[] = ["forest", "gold", "steel", "ok", "bad"];
export const toneDeCamion = (i: number): Tone => PALETA[i % PALETA.length]!;

export const TONO_PARADA: Record<Enums<"estado_parada">, "ok" | "bad" | "stone"> = {
  entregado: "ok",
  rechazado: "bad",
  pendiente: "stone",
};

export const ETIQUETA_PARADA: Record<Enums<"estado_parada">, string> = {
  entregado: "Entregado",
  rechazado: "Rechazado",
  pendiente: "Pendiente",
};

export function avance(paradas: { estado: Enums<"estado_parada"> }[]) {
  const hechas = paradas.filter((p) => p.estado !== "pendiente").length;
  return { hechas, total: paradas.length, pct: paradas.length ? Math.round((hechas / paradas.length) * 100) : 0 };
}
