import { Suspense } from "react";
import { GenerarRuta } from "@/components/admin/generar-ruta";

export default function RutasPage() {
  // La fecha por defecto (hoy) depende de la hora actual: se resuelve en la petición, no en el prerender.
  return (
    <Suspense fallback={<div className="p-7 text-[13.5px] text-muted">Cargando…</div>}>
      <GenerarRuta />
    </Suspense>
  );
}
