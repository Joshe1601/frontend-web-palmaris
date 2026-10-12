"use client";

import { useMemo } from "react";
import { useQuery } from "@/hooks/use-query";
import { useSupabase } from "@/hooks/use-supabase";
import { fetchAll } from "@/lib/data/fetch-all";
import { horaLima, minutosEntre } from "@/lib/format";
import { unwrap } from "@/lib/supabase/unwrap";
import { detectarEstacionamientos, paradaCercana } from "@/lib/tracking/estacionamientos";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ErrorBanner } from "@/components/ui/table";

type ParadaTiempo = {
  id: string;
  orden: number;
  cliente: string;
  lat: number | null;
  lng: number | null;
  llegada_at: string | null;
  llegada_distancia_m: number | null;
  marcada_at: string | null;
};

type Item = {
  key: string;
  inicio: string;
  fin: string | null;
  minutos: number | null;
  lugar: string;
  motivo: string | null;
  detectado: boolean;
  enCurso: boolean;
};

/** Atención por parada (llegada -> entrega) y estacionamientos largos con su motivo. */
export function TiemposRuta({
  rutaId,
  paradas,
  umbralMin,
  radioM,
  version,
}: {
  rutaId: string;
  paradas: ParadaTiempo[];
  umbralMin: number;
  radioM: number;
  /** Cambia cuando la ruta se actualiza (Realtime) para recargar. */
  version: string;
}) {
  const supabase = useSupabase();
  const { data, error, loading, reload } = useQuery(async () => {
    const [pings, pausas] = await Promise.all([
      fetchAll((from, to) =>
        supabase
          .from("ubicaciones")
          .select("id, lat, lng, registrado_at")
          .eq("ruta_id", rutaId)
          .order("registrado_at")
          .order("id")
          .range(from, to),
      ),
      supabase.from("pausas").select("*").eq("ruta_id", rutaId).order("inicio_at"),
    ]);
    return { pings, pausas: unwrap(pausas) ?? [] };
  }, [rutaId, version]);

  const items = useMemo<Item[]>(() => {
    if (!data) return [];
    const coordParadas = paradas.filter((p) => p.lat != null).map((p) => ({ ...p, lat: p.lat!, lng: p.lng! }));
    const nombreDe = (lat: number | null, lng: number | null) => {
      if (lat == null || lng == null) return "Ubicación desconocida";
      const p = paradaCercana({ lat, lng }, coordParadas, radioM);
      return p ? `En ${p.cliente}` : "Fuera de una parada";
    };

    const detectados = detectarEstacionamientos(
      data.pings.map((p) => ({ lat: p.lat, lng: p.lng, at: p.registrado_at })),
      { umbralMin },
    );
    const usadas = new Set<string>();
    const out: Item[] = detectados.map((d, i) => {
      const slack = 2 * 60_000;
      const pausa = data.pausas.find(
        (x) =>
          Date.parse(x.inicio_at) <= Date.parse(d.fin) + slack &&
          Date.parse(x.fin_at ?? x.inicio_at) >= Date.parse(d.inicio) - slack,
      );
      if (pausa) usadas.add(pausa.id);
      return {
        key: `d${i}`,
        inicio: d.inicio,
        fin: d.enCurso ? null : d.fin,
        minutos: d.minutos,
        lugar: nombreDe(d.lat, d.lng),
        motivo: pausa?.motivo ?? null,
        detectado: true,
        enCurso: d.enCurso,
      };
    });
    // Pausas que el chofer registró aunque el GPS no las detectara (p. ej. pocos pings).
    for (const x of data.pausas) {
      if (usadas.has(x.id)) continue;
      out.push({
        key: x.id,
        inicio: x.inicio_at,
        fin: x.fin_at,
        minutos: x.fin_at ? minutosEntre(x.inicio_at, x.fin_at) : null,
        lugar: nombreDe(x.lat, x.lng),
        motivo: x.motivo,
        detectado: false,
        enCurso: !x.fin_at,
      });
    }
    return out.sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
  }, [data, paradas, umbralMin, radioM]);

  const conLlegada = paradas.filter((p) => p.llegada_at);

  return (
    <div className="min-h-0 flex-1 overflow-auto px-[18px] pb-3">
      <div className="flex items-center justify-between pb-1 pt-3">
        <div className="text-[13px] font-bold">Atención por parada</div>
        <Button variant="ghost" size="sm" onClick={reload} loading={loading}>
          Actualizar
        </Button>
      </div>
      {conLlegada.length === 0 ? (
        <p className="pb-2 text-[12.5px] text-muted">
          Aún no hay llegadas registradas. Se registran cuando el chofer pulsa «He llegado» a menos de {radioM} m de la tienda.
        </p>
      ) : (
        conLlegada.map((p) => {
          const min = p.marcada_at && p.llegada_at ? minutosEntre(p.llegada_at, p.marcada_at) : null;
          return (
            <div key={p.id} className="flex items-center justify-between gap-2 border-b border-row py-2 text-[13px]">
              <div className="min-w-0">
                <div className="truncate font-semibold">
                  {p.orden}. {p.cliente}
                </div>
                <div className="text-[11.5px] text-muted">
                  Llegó {horaLima(p.llegada_at)}
                  {p.llegada_distancia_m != null && ` (a ${Math.round(p.llegada_distancia_m)} m)`}
                  {p.marcada_at && ` · terminó ${horaLima(p.marcada_at)}`}
                </div>
              </div>
              <div className="text-right">
                {min == null ? (
                  <Chip tone="neutral">Atendiendo</Chip>
                ) : (
                  <Chip tone={min >= umbralMin ? "warn" : "ok"}>
                    {min >= umbralMin && "⏱ "}
                    {min} min
                  </Chip>
                )}
              </div>
            </div>
          );
        })
      )}

      <div className="pb-1 pt-4 text-[13px] font-bold">Estacionamientos de {umbralMin} min o más</div>
      {error && <ErrorBanner message={error} onRetry={reload} />}
      {!loading && items.length === 0 && (
        <p className="text-[12.5px] text-muted">No se detectaron estacionamientos largos en esta ruta.</p>
      )}
      {items.map((it) => (
        <div key={it.key} className="border-b border-row py-2.5 text-[13px]">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">
              ⏱ {it.minutos != null ? `${it.minutos} min` : "En pausa"} · {it.lugar}
            </span>
            {it.enCurso && <Chip tone="warn">En curso</Chip>}
          </div>
          <div className="text-[11.5px] text-muted">
            {horaLima(it.inicio)}
            {it.fin ? ` – ${horaLima(it.fin)}` : " – ahora"}
            {!it.detectado && " · registrada por el chofer"}
          </div>
          {it.motivo ? (
            <div className="mt-1 text-[12.5px]">Motivo: {it.motivo}</div>
          ) : (
            <div className="mt-1">
              <Chip tone="bad">Sin motivo registrado</Chip>
            </div>
          )}
        </div>
      ))}
      <p className="py-3 text-[11.5px] leading-snug text-muted">
        Un estacionamiento se detecta con los pings GPS: el camión permanece dentro de 50 m durante {umbralMin} min o más.
      </p>
    </div>
  );
}
