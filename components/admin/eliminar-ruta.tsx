"use client";

import { useState } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { describeDbError } from "@/lib/db-errors";
import { fechaCorta } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

type RutaResumen = { id: string; fecha: string; zona: string | null; estado: string; chofer: string; paradas: number };

/** Botón + confirmación para eliminar una ruta. Solo rutas pendientes (aún no iniciadas por el chofer). */
export function EliminarRuta({
  ruta,
  onDeleted,
  size = "sm",
}: {
  ruta: RutaResumen;
  onDeleted: () => void;
  size?: "sm" | "md";
}) {
  const supabase = useSupabase();
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (ruta.estado !== "pendiente") return null;

  async function eliminar() {
    setCargando(true);
    setError(null);
    // El filtro por estado evita borrar una ruta que el chofer inició mientras se confirmaba.
    const { data, error } = await supabase
      .from("rutas")
      .delete()
      .eq("id", ruta.id)
      .eq("estado", "pendiente")
      .select("id");
    setCargando(false);
    if (error) return setError(describeDbError(error));
    if (!data?.length) return setError("La ruta ya no está pendiente (el chofer pudo haberla iniciado). Actualiza la página.");
    toast("Ruta eliminada. Sus pedidos vuelven a estar disponibles.");
    setAbierto(false);
    onDeleted();
  }

  return (
    // Los clics (también los del modal) no deben llegar a la fila clicable de la lista.
    <span onClick={(e) => e.stopPropagation()}>
      <Button
        variant="outline"
        size={size}
        className="border-bad/40 text-bad hover:bg-chip-bad"
        onClick={() => setAbierto(true)}
      >
        Eliminar
      </Button>
      {abierto && (
        <Modal title="Eliminar ruta" onClose={() => setAbierto(false)}>
          <div className="space-y-4 text-[13.5px]">
            <p>
              ¿Eliminar la ruta <b>{ruta.zona ?? "Sin zona"}</b> del {fechaCorta(ruta.fecha)} asignada a{" "}
              <b>{ruta.chofer}</b> ({ruta.paradas} {ruta.paradas === 1 ? "parada" : "paradas"})?
            </p>
            <p className="text-muted">
              Los pedidos de esas paradas siguen pendientes y vuelven a aparecer en «Generar ruta». Esta acción no se puede
              deshacer.
            </p>
            <FormError message={error} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAbierto(false)}>
                Cancelar
              </Button>
              <Button variant="danger" loading={cargando} onClick={eliminar}>
                Sí, eliminar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </span>
  );
}
