import type { Enums } from "@/types/database";
import { Chip, type ChipTone } from "@/components/ui/chip";

const ESTADOS: Record<Enums<"estado_ruta">, { label: string; tone: ChipTone }> = {
  pendiente: { label: "Creada", tone: "ok" },
  en_curso: { label: "En curso", tone: "warn" },
  finalizada: { label: "Finalizada", tone: "neutral" },
};

export function EstadoRutaChip({ estado }: { estado: Enums<"estado_ruta"> }) {
  const e = ESTADOS[estado];
  return <Chip tone={e.tone}>{e.label}</Chip>;
}
