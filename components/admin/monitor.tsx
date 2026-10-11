"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLiveFleet } from "@/hooks/use-live-fleet";
import { useQuery } from "@/hooks/use-query";
import { useSupabase } from "@/hooks/use-supabase";
import { cn } from "@/lib/cn";
import { ETIQUETA_PARADA, TONO_PARADA, avance, toneDeCamion } from "@/lib/fleet";
import { unwrap } from "@/lib/supabase/unwrap";
import { MapView } from "@/components/map/map-view";
import type { MapLine, MapMarker } from "@/components/map/types";
import { Progress } from "@/components/ui/progress";
import { Ago } from "./ago";

const TEXTO_TONO = {
  ok: "text-ok",
  bad: "text-bad",
  stone: "text-stone",
  forest: "text-forest",
  gold: "text-gold",
  steel: "text-steel",
} as const;
const BORDER_TONO = {
  ok: "border-ok",
  bad: "border-bad",
  stone: "border-stone",
  forest: "border-forest",
  gold: "border-gold",
  steel: "border-steel",
} as const;
const BG_TONO = {
  ok: "bg-ok",
  bad: "bg-bad",
  stone: "bg-stone",
  forest: "bg-forest",
  gold: "bg-gold",
  steel: "bg-steel",
} as const;

export function Monitor() {
  const supabase = useSupabase();
  const { trucks, loading, error, connected } = useLiveFleet();
  const [picked, setPicked] = useState<string | null>(null);

  const depot = useQuery(async () => {
    const c = unwrap(await supabase.from("configuracion").select("almacen_lat, almacen_lng").eq("id", true).maybeSingle());
    return c && c.almacen_lat != null && c.almacen_lng != null
      ? { lat: Number(c.almacen_lat), lng: Number(c.almacen_lng) }
      : null;
  }, []).data;

  const selectedId = trucks.some((t) => t.rutaId === picked) ? picked : (trucks[0]?.rutaId ?? null);
  const selected = trucks.find((t) => t.rutaId === selectedId) ?? null;

  const { markers, lines } = useMemo(() => {
    const markers: MapMarker[] = [];
    const lines: MapLine[] = [];
    if (depot) markers.push({ id: "depot", ...depot, kind: "depot", tone: "forest", title: "Almacén" });

    trucks.forEach((t, i) => {
      const tone = toneDeCamion(i);
      const esSel = t.rutaId === selectedId;
      const pts: [number, number][] = [
        ...(depot ? [[depot.lat, depot.lng] as [number, number]] : []),
        ...t.paradas.filter((p) => p.lat != null).map((p): [number, number] => [p.lat!, p.lng!]),
        ...(depot ? [[depot.lat, depot.lng] as [number, number]] : []),
      ];
      lines.push({ id: t.rutaId, points: pts, tone, weight: esSel ? 6 : 3, opacity: esSel ? 0.85 : 0.35 });
      if (esSel) {
        for (const p of t.paradas) {
          if (p.lat == null) continue;
          markers.push({
            id: p.id,
            lat: p.lat,
            lng: p.lng!,
            kind: "stop",
            tone: TONO_PARADA[p.estado],
            label: String(p.orden),
            title: `${p.orden}. ${p.cliente} · ${ETIQUETA_PARADA[p.estado]}`,
          });
        }
      }
      if (t.pos) {
        markers.push({
          id: `truck-${t.rutaId}`,
          lat: t.pos.lat,
          lng: t.pos.lng,
          kind: "truck",
          tone,
          label: String(i + 1),
          title: `${t.chofer} · ${t.placa}`,
          onClick: () => setPicked(t.rutaId),
        });
      }
    });
    return { markers, lines };
  }, [trucks, selectedId, depot]);

  return (
    <div className="absolute inset-0 grid grid-cols-[minmax(0,1fr)_400px]">
      <MapView markers={markers} lines={lines} fitKey={`${selectedId}|${trucks.length}`}>
        <div className="absolute bottom-[18px] left-[18px] z-[1000] grid gap-1 rounded-[10px] bg-white px-3.5 py-2.5 text-xs shadow-md">
          <div className="text-ok">● Entregado</div>
          <div className="text-bad">● Rechazado</div>
          <div className="text-stone">● Pendiente</div>
        </div>
        {!loading && trucks.length === 0 && (
          <div className="absolute left-1/2 top-6 z-[1000] -translate-x-1/2 rounded-xl bg-white px-5 py-3 text-[13.5px] text-muted shadow-lg">
            No hay camiones con ruta en curso en este momento.
          </div>
        )}
      </MapView>

      <aside className="flex min-h-0 flex-col border-l border-line bg-panel">
        <div className="flex flex-none items-center justify-between px-[18px] pb-1.5 pt-4">
          <h2 className="text-[15px] font-bold">Camiones en ruta</h2>
          <span className={cn("flex items-center gap-1.5 text-xs", connected ? "text-ok" : "text-bad")}>
            <span className={cn("size-2 rounded-full", connected ? "bg-ok" : "bg-bad")} />
            {connected ? "En vivo" : "Reconectando…"}
          </span>
        </div>
        {error && <p className="px-[18px] text-[12.5px] text-bad">{error}</p>}
        <div className="flex max-h-[45%] flex-none flex-col gap-2 overflow-auto px-3.5 pb-3 pt-1.5">
          {trucks.map((t, i) => {
            const tone = toneDeCamion(i);
            const a = avance(t.paradas);
            return (
              <button
                key={t.rutaId}
                type="button"
                onClick={() => setPicked(t.rutaId)}
                className={cn(
                  "rounded-[11px] border-[1.5px] bg-white px-3.5 py-3 text-left",
                  t.rutaId === selectedId ? BORDER_TONO[tone] : "border-line",
                )}
              >
                <div className="flex items-center gap-2.5">
                  <div className={cn("grid size-[26px] place-items-center rounded-full text-xs font-bold text-white", BG_TONO[tone])}>
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold">{t.chofer}</div>
                    <div className="truncate text-xs text-muted">
                      {t.zona ?? "Sin zona"} · {t.placa}
                    </div>
                  </div>
                  <div className="text-right text-sm font-bold">
                    {a.hechas}/{a.total}
                  </div>
                </div>
                <Progress pct={a.pct} tone={tone} className="my-2.5 h-[5px]" />
                <div className="text-[11.5px] text-muted">
                  <Ago at={t.pos?.at} />
                </div>
              </button>
            );
          })}
          {loading && <p className="text-[13px] text-muted">Cargando…</p>}
        </div>

        <div className="flex flex-none items-center justify-between border-t border-line px-[18px] py-2.5 text-[13px] font-bold">
          <span>Paradas · {selected ? (selected.zona ?? selected.chofer) : "—"}</span>
          {selected && (
            <Link href={`/admin/rutas/${selected.rutaId}`} className="text-xs font-semibold text-forest">
              Ver ruta →
            </Link>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-[18px] pb-3.5">
          {selected?.paradas.map((p) => {
            const tone = TONO_PARADA[p.estado];
            return (
              <div
                key={p.id}
                className="grid grid-cols-[26px_1fr_auto] items-center gap-2.5 border-b border-row py-2"
              >
                <div className={cn("grid size-[22px] place-items-center rounded-full text-[11px] font-semibold text-white", BG_TONO[tone])}>
                  {p.orden}
                </div>
                <div className="truncate text-[13px] font-semibold">{p.cliente}</div>
                <div className={cn("text-[11.5px] font-semibold", TEXTO_TONO[tone])}>{ETIQUETA_PARADA[p.estado]}</div>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
