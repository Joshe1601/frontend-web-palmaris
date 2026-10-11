import { Suspense } from "react";
import { RutaDetalle } from "@/components/admin/ruta-detalle";

export default function RutaPage({ params }: PageProps<"/admin/rutas/[id]">) {
  return (
    <Suspense fallback={<div className="p-7 text-[13.5px] text-muted">Cargando ruta…</div>}>
      <RutaContenido params={params} />
    </Suspense>
  );
}

async function RutaContenido({ params }: Pick<PageProps<"/admin/rutas/[id]">, "params">) {
  const { id } = await params;
  return <RutaDetalle id={id} />;
}
