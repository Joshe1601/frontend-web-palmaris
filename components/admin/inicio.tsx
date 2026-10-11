"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useLiveFleet } from "@/hooks/use-live-fleet";
import { useQuery } from "@/hooks/use-query";
import { useSupabase } from "@/hooks/use-supabase";
import { cn } from "@/lib/cn";
import { avance, toneDeCamion } from "@/lib/fleet";
import { hoyLima } from "@/lib/format";
import { unwrap } from "@/lib/supabase/unwrap";
import { MapView } from "@/components/map/map-view";
import type { MapMarker } from "@/components/map/types";
import { Progress } from "@/components/ui/progress";
import { ErrorBanner } from "@/components/ui/table";
import { EstadoRutaChip } from "./estado-ruta-chip";

export function Inicio() {
  const supabase = useSupabase();
  const fleet = useLiveFleet();

  // Se vuelve a consultar solo cuando Realtime avisa de un cambio (no hay polling).
  const hoy = useQuery(async () => {
    const [rutas, vehiculos] = await Promise.all([
      supabase
        .from("rutas")
        .select("id, zona, estado, choferes(nombre), vehiculos(placa, alias), paradas(estado)")
        .eq("fecha", hoyLima())
        .order("created_at"),
      supabase.from("vehiculos").select("id", { count: "exact", head: true }).eq("activo", true),
    ]);
    return { rutas: unwrap(rutas) ?? [], vehiculos: vehiculos.count ?? 0 };
  }, [fleet.changes]);

  const rutas = useMemo(() => hoy.data?.rutas ?? [], [hoy.data]);
  const kpis = useMemo(() => {
    const paradas = rutas.flatMap((r) => r.paradas);
    const entregadas = paradas.filter((p) => p.estado === "entregado").length;
    const rechazos = paradas.filter((p) => p.estado === "rechazado").length;
    const pendientes = rutas.filter((r) => r.estado === "pendiente").length;
    return [
      { l: "Camiones en ruta", v: String(rutas.filter((r) => r.estado === "en_curso").length), s: `de ${hoy.data?.vehiculos ?? 0} vehículos`, c: "text-ink" },
      { l: "Entregas completadas", v: String(entregadas), s: `de ${paradas.length} programadas`, c: "text-ok" },
      { l: "Rechazos", v: String(rechazos), s: paradas.length ? `${Math.round((rechazos / paradas.length) * 100)} % del total` : "—", c: "text-bad" },
      { l: "Rutas pendientes", v: String(pendientes), s: pendientes ? "sin iniciar" : "ninguna sin iniciar", c: "text-gold" },
    ];
  }, [rutas, hoy.data?.vehiculos]);

  const markers = useMemo<MapMarker[]>(
    () =>
      fleet.trucks.flatMap((t, i) =>
        t.pos
          ? [{ id: t.rutaId, lat: t.pos.lat, lng: t.pos.lng, kind: "truck" as const, tone: toneDeCamion(i), label: String(i + 1), title: `${t.chofer} · ${t.placa}` }]
          : [],
      ),
    [fleet.trucks],
  );

  return (
    <div className="absolute inset-0 overflow-auto px-7 py-6">
      <div className="flex flex-col gap-5">
        {(hoy.error || fleet.error) && <ErrorBanner message={(hoy.error ?? fleet.error)!} onRetry={hoy.reload} />}

        <div className="grid grid-cols-4 gap-4">
          {kpis.map((k) => (
            <div key={k.l} className="rounded-xl border border-line bg-white px-5 py-[18px]">
              <div className="text-[13px] text-muted">{k.l}</div>
              <div className={cn("mt-1.5 text-[34px] font-bold leading-none tracking-tight", k.c)}>{hoy.data ? k.v : "…"}</div>
              <div className="mt-1.5 text-[12.5px] text-muted">{k.s}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-5">
          <section className="rounded-xl border border-line bg-white p-5">
            <div className="mb-3.5 flex items-center justify-between">
              <h2 className="text-base font-bold">Rutas de hoy</h2>
              <Link href="/admin/monitoreo" className="text-[13px] font-semibold text-forest">
                Ver en vivo →
              </Link>
            </div>
            {hoy.data && rutas.length === 0 && (
              <p className="py-6 text-center text-[13.5px] text-muted">
                No hay rutas para hoy.{" "}
                <Link href="/admin/rutas" className="font-semibold text-forest underline">
                  Generar una ruta
                </Link>
              </p>
            )}
            {rutas.map((r) => {
              const a = avance(r.paradas);
              return (
                <Link
                  key={r.id}
                  href={`/admin/rutas/${r.id}`}
                  className="grid grid-cols-[1fr_auto] items-center gap-3.5 border-t border-line-soft py-3.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[14.5px] font-semibold">
                      <span className="truncate">{r.zona ?? "Sin zona"}</span>
                      <EstadoRutaChip estado={r.estado} />
                    </div>
                    <div className="mb-2 mt-0.5 text-[12.5px] text-muted">
                      {r.choferes.nombre} · {r.vehiculos.alias ?? r.vehiculos.placa}
                    </div>
                    <Progress pct={a.pct} className="h-[7px]" />
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold">
                      {a.hechas}
                      <span className="text-[13px] font-medium text-muted"> / {a.total}</span>
                    </div>
                    <div className="text-xs text-muted">entregas</div>
                  </div>
                </Link>
              );
            })}
          </section>

          <section className="relative min-h-[340px] overflow-hidden rounded-xl border border-line bg-white">
            <MapView markers={markers} fitKey={`${markers.length}`} className="absolute inset-0">
              <div className="absolute left-3.5 top-3.5 z-[1000] rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold shadow-md">
                Flota en vivo
              </div>
            </MapView>
          </section>
        </div>
      </div>
    </div>
  );
}
