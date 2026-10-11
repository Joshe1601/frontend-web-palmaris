"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage, unwrap } from "@/lib/supabase/unwrap";
import type { Enums, Tables } from "@/types/database";
import { useSupabase } from "./use-supabase";

export type LiveParada = {
  id: string;
  orden: number;
  estado: Enums<"estado_parada">;
  cliente: string;
  lat: number | null;
  lng: number | null;
};

export type LiveTruck = {
  rutaId: string;
  choferId: string;
  chofer: string;
  placa: string;
  zona: string | null;
  /** Trazado por calles (polyline) o null. */
  geometria: string | null;
  paradas: LiveParada[];
  /** Último ping GPS del chofer en esta ruta. */
  pos: { lat: number; lng: number; at: string } | null;
};

type Change<T extends Record<string, unknown>> = RealtimePostgresChangesPayload<T>;

/**
 * Camiones con ruta en curso, actualizados por Supabase Realtime (sin polling):
 *  - `ubicaciones` INSERT  -> mueve el camión (último ping por chofer)
 *  - `paradas` UPDATE      -> refleja entregado/rechazado
 *  - `rutas` cambios       -> aparece/desaparece una ruta en curso
 * Al (re)conectar el canal se vuelve a cargar todo para no perder eventos.
 */
export function useLiveFleet() {
  const supabase = useSupabase();
  const [trucks, setTrucks] = useState<LiveTruck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  /** Aumenta con cada evento de rutas/paradas: útil para refrescar datos derivados. */
  const [changes, setChanges] = useState(0);
  const known = useRef(new Set<string>());

  const load = useCallback(async () => {
    try {
      const rutas =
        unwrap(
          await supabase
            .from("rutas")
            .select(
              "id, zona, geometria, chofer_id, choferes(nombre), vehiculos(placa, alias), paradas(id, orden, estado, clientes(nombre, lat, lng))",
            )
            .eq("estado", "en_curso"),
        ) ?? [];

      const pings = await Promise.all(
        rutas.map((r) =>
          supabase
            .from("ubicaciones")
            .select("lat, lng, registrado_at")
            .eq("ruta_id", r.id)
            .eq("chofer_id", r.chofer_id)
            .order("registrado_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ),
      );

      const next = rutas.map<LiveTruck>((r, i) => {
        const ping = pings[i]!.data;
        return {
          rutaId: r.id,
          choferId: r.chofer_id,
          chofer: r.choferes.nombre,
          placa: r.vehiculos.alias ?? r.vehiculos.placa,
          zona: r.zona,
          geometria: r.geometria,
          paradas: [...r.paradas]
            .sort((a, b) => a.orden - b.orden)
            .map((p) => ({
              id: p.id,
              orden: p.orden,
              estado: p.estado,
              cliente: p.clientes.nombre,
              lat: p.clientes.lat,
              lng: p.clientes.lng,
            })),
          pos: ping ? { lat: ping.lat, lng: ping.lng, at: ping.registrado_at } : null,
        };
      });
      // Orden estable entre recargas: así cada camión conserva su número y color.
      next.sort((a, b) => a.rutaId.localeCompare(b.rutaId));
      known.current = new Set(next.map((t) => t.rutaId));
      setTrucks(next);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    let alive = true;
    let firstSubscribe = true;
    const run = () => {
      if (alive) void load();
    };
    run();

    const channel = supabase
      .channel("live-fleet")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ubicaciones" }, (p) => {
        const u = (p as Change<Tables<"ubicaciones">>).new as Tables<"ubicaciones">;
        setTrucks((prev) =>
          prev.map((t) =>
            t.rutaId === u.ruta_id && (!t.pos || t.pos.at <= u.registrado_at)
              ? { ...t, pos: { lat: u.lat, lng: u.lng, at: u.registrado_at } }
              : t,
          ),
        );
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "paradas" }, (p) => {
        const row = (p as Change<Tables<"paradas">>).new as Tables<"paradas">;
        setTrucks((prev) =>
          prev.map((t) =>
            t.rutaId !== row.ruta_id
              ? t
              : { ...t, paradas: t.paradas.map((x) => (x.id === row.id ? { ...x, estado: row.estado } : x)) },
          ),
        );
        setChanges((n) => n + 1);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "rutas" }, (p) => {
        const row = ((p as Change<Tables<"rutas">>).new ?? {}) as Partial<Tables<"rutas">>;
        const old = ((p as Change<Tables<"rutas">>).old ?? {}) as Partial<Tables<"rutas">>;
        const id = row.id ?? old.id;
        setChanges((n) => n + 1);
        if (!id) return run();
        if (row.estado === "en_curso" && !known.current.has(id)) return run(); // ruta nueva en curso
        if (known.current.has(id) && row.estado !== "en_curso") {
          known.current.delete(id); // finalizada o eliminada
          setTrucks((prev) => prev.filter((t) => t.rutaId !== id));
        }
      })
      .subscribe((status) => {
        if (!alive) return;
        setConnected(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") {
          if (firstSubscribe) firstSubscribe = false;
          else run(); // reconexión: resincroniza lo que se haya perdido
        }
      });

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, load]);

  return { trucks, loading, error, connected, changes, reload: load };
}
