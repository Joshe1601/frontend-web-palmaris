"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@/hooks/use-query";
import { useSupabase } from "@/hooks/use-supabase";
import { cn } from "@/lib/cn";
import { ETIQUETA_PARADA, TONO_PARADA, avance } from "@/lib/fleet";
import { fechaCorta, horaCorta, horaLima, kmATexto, minutosATexto, minutosEntre } from "@/lib/format";
import { decodePolyline } from "@/lib/routing/polyline";
import { unwrap } from "@/lib/supabase/unwrap";
import { Chip } from "@/components/ui/chip";
import { Progress } from "@/components/ui/progress";
import { ErrorBanner } from "@/components/ui/table";
import { MapView } from "@/components/map/map-view";
import type { MapLine, MapMarker } from "@/components/map/types";
import { StateTabs } from "@/components/ui/segmented";
import { EliminarRuta } from "./eliminar-ruta";
import { EstadoRutaChip } from "./estado-ruta-chip";
import { TiemposRuta } from "./tiempos-ruta";

const BG = { ok: "bg-ok", bad: "bg-bad", stone: "bg-stone", forest: "bg-forest" } as const;

export function RutaDetalle({ id }: { id: string }) {
  const supabase = useSupabase();
  const router = useRouter();
  const [panel, setPanel] = useState<"paradas" | "tiempos">("paradas");
  const { data, error, loading, reload } = useQuery(async () => {
    const [ruta, config] = await Promise.all([
      supabase
        .from("rutas")
        .select(
          "*, choferes(nombre, usuario), vehiculos(placa, alias), paradas(*, clientes(nombre, direccion, lat, lng, ventana_horario_inicio, ventana_horario_fin), parada_pedidos(pedido_id))",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("configuracion")
        .select("almacen_lat, almacen_lng, radio_llegada_m, umbral_estacionamiento_min")
        .eq("id", true)
        .maybeSingle(),
    ]);
    return { ruta: unwrap(ruta), config: unwrap(config) };
  }, [id]);

  // Si la ruta está en curso, el avance se refleja sin recargar.
  useEffect(() => {
    const channel = supabase
      .channel(`ruta-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "paradas", filter: `ruta_id=eq.${id}` }, reload)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rutas", filter: `id=eq.${id}` }, reload)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, id, reload]);

  const ruta = data?.ruta ?? null;
  const c = data?.config;
  const depot = useMemo(
    () => (c && c.almacen_lat != null && c.almacen_lng != null ? { lat: Number(c.almacen_lat), lng: Number(c.almacen_lng) } : null),
    [c],
  );
  const geometria = ruta?.geometria ?? null;
  const paradas = useMemo(() => [...(ruta?.paradas ?? [])].sort((a, b) => a.orden - b.orden), [ruta]);

  const { markers, lines } = useMemo(() => {
    const markers: MapMarker[] = [];
    if (depot) markers.push({ id: "depot", ...depot, kind: "depot", tone: "forest", title: "Almacén (inicio y fin)" });
    const pts: [number, number][] = depot ? [[depot.lat, depot.lng]] : [];
    for (const p of paradas) {
      const cl = p.clientes;
      if (cl.lat == null || cl.lng == null) continue;
      pts.push([cl.lat, cl.lng]);
      markers.push({
        id: p.id,
        lat: cl.lat,
        lng: cl.lng,
        kind: "stop",
        tone: p.estado === "pendiente" ? "forest" : TONO_PARADA[p.estado],
        label: String(p.orden),
        title: `${p.orden}. ${cl.nombre}`,
      });
    }
    if (depot) pts.push([depot.lat, depot.lng]);
    // Trazado por calles si se guardó; si no, línea recta en el orden calculado (solo referencia visual).
    const trazado = geometria ? decodePolyline(geometria) : pts;
    const lines: MapLine[] = [{ id: "ruta", points: trazado, tone: "forest", weight: 4, opacity: 0.8 }];
    return { markers, lines };
  }, [paradas, depot, geometria]);

  if (loading && !data) return <div className="p-7 text-[13.5px] text-muted">Cargando ruta…</div>;
  if (error) {
    return (
      <div className="p-7">
        <ErrorBanner message={error} onRetry={reload} />
      </div>
    );
  }
  if (!ruta) {
    return (
      <div className="p-7 text-[13.5px]">
        La ruta no existe.{" "}
        <Link href="/admin/rutas/creadas" className="font-semibold text-forest underline">
          Volver a rutas creadas
        </Link>
      </div>
    );
  }

  const a = avance(paradas);
  const entregadas = paradas.filter((p) => p.estado === "entregado").length;
  const rechazadas = paradas.filter((p) => p.estado === "rechazado").length;

  return (
    <div className="absolute inset-0 flex flex-col gap-3.5 px-5 pb-5 pt-4">
      <div className="flex flex-none items-center gap-4 rounded-xl border border-line bg-white px-5 py-3.5">
        <Link href="/admin/rutas/creadas" className="text-[13px] font-semibold text-forest">
          ← Rutas
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h2 className="truncate text-lg font-bold">Ruta · {ruta.zona ?? "Sin zona"}</h2>
            <EstadoRutaChip estado={ruta.estado} />
          </div>
          <div className="text-[12.5px] text-muted">
            {fechaCorta(ruta.fecha)} · {ruta.choferes.nombre} · {ruta.vehiculos.alias ?? ruta.vehiculos.placa} (
            {ruta.vehiculos.placa})
          </div>
        </div>
        <Stat value={String(paradas.length)} label="paradas" />
        <Stat value={kmATexto(ruta.distancia_km)} label="distancia" />
        <Stat value={minutosATexto(ruta.tiempo_estimado_min)} label="tiempo est." />
        <div className="w-40">
          <div className="mb-1 text-[12px] text-muted">
            Avance {a.hechas}/{a.total} · {entregadas} entregadas
            {rechazadas > 0 && ` · ${rechazadas} rechazadas`}
          </div>
          <Progress pct={a.pct} />
        </div>
        <EliminarRuta
          size="md"
          ruta={{
            id: ruta.id,
            fecha: ruta.fecha,
            zona: ruta.zona,
            estado: ruta.estado,
            chofer: ruta.choferes.nombre,
            paradas: paradas.length,
          }}
          onDeleted={() => router.push("/admin/rutas/creadas")}
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[460px_minmax(0,1fr)] gap-3.5">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-white">
          <div className="flex-none border-b border-line-soft px-[18px] py-2.5">
            <StateTabs
              value={panel}
              onChange={setPanel}
              items={[
                { value: "paradas", label: "Orden de visita" },
                { value: "tiempos", label: "Tiempos y pausas" },
              ]}
            />
          </div>
          {panel === "tiempos" ? (
            <TiemposRuta
              rutaId={ruta.id}
              umbralMin={c?.umbral_estacionamiento_min ?? 7}
              radioM={c?.radio_llegada_m ?? 100}
              version={`${ruta.estado}|${paradas.map((p) => `${p.llegada_at ?? ""}${p.marcada_at ?? ""}`).join(",")}`}
              paradas={paradas.map((p) => ({
                id: p.id,
                orden: p.orden,
                cliente: p.clientes.nombre,
                lat: p.clientes.lat,
                lng: p.clientes.lng,
                llegada_at: p.llegada_at,
                llegada_distancia_m: p.llegada_distancia_m,
                marcada_at: p.marcada_at,
              }))}
            />
          ) : (
          <div className="min-h-0 flex-1 overflow-auto px-[18px]">
            {paradas.map((p) => {
              const cl = p.clientes;
              const tone = p.estado === "pendiente" ? "forest" : TONO_PARADA[p.estado];
              return (
                <div
                  key={p.id}
                  className="grid grid-cols-[30px_1fr_auto] items-start gap-3 border-b border-row py-3 last:border-b-0"
                >
                  <div className={cn("grid size-[26px] place-items-center rounded-full text-xs font-semibold text-white", BG[tone])}>
                    {p.orden}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-semibold">{cl.nombre}</div>
                    <div className="truncate text-xs text-muted">{cl.direccion}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted">
                      <span>
                        {kmATexto(p.distancia_desde_anterior_km)} · {p.tiempo_estimado_min ?? "—"} min desde la anterior
                      </span>
                      <span>· {p.parada_pedidos.length} {p.parada_pedidos.length === 1 ? "pedido" : "pedidos"}</span>
                    </div>
                    {p.advertencia_ventana && (
                      <div className="mt-1.5">
                        <Chip tone="warn" className="text-[11px]">
                          ⚠ Llegada fuera de la ventana horaria
                          {cl.ventana_horario_inicio &&
                            ` (${horaCorta(cl.ventana_horario_inicio)}–${horaCorta(cl.ventana_horario_fin)})`}
                        </Chip>
                      </div>
                    )}
                    {p.estado === "rechazado" && p.motivo_rechazo && (
                      <div className="mt-1 text-[11.5px] text-bad">Motivo: {p.motivo_rechazo}</div>
                    )}
                    {p.llegada_at && (
                      <div className="mt-1 text-[11.5px] text-muted">
                        Llegó {horaLima(p.llegada_at)}
                        {p.marcada_at && ` · atención ${minutosEntre(p.llegada_at, p.marcada_at)} min`}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-[13px] font-bold">{horaCorta(p.hora_estimada_llegada)}</div>
                    <div className="text-[11.5px] font-semibold text-muted">
                      {p.estado === "pendiente" ? "ETA" : ETIQUETA_PARADA[p.estado]}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
          <p className="flex-none border-t border-line-soft px-[18px] py-2.5 text-[11.5px] text-muted">
            {ruta.geometria
              ? "Distancias y trazado por calles (OpenRouteService). Los tiempos usan la velocidad promedio configurada, sin tráfico."
              : "Esta ruta no tiene trazado por calles: distancias y línea en recta (Haversine), solo como referencia."}
          </p>
        </section>

        <MapView markers={markers} lines={lines} fitKey={id} className="rounded-xl border border-line" />
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-right">
      <div className="text-[17px] font-bold leading-tight">{value}</div>
      <div className="text-[11.5px] text-muted">{label}</div>
    </div>
  );
}
