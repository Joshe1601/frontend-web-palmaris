"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@/hooks/use-query";
import { useSupabase } from "@/hooks/use-supabase";
import { avance } from "@/lib/fleet";
import { fechaCorta, kmATexto } from "@/lib/format";
import { unwrap } from "@/lib/supabase/unwrap";
import type { Enums } from "@/types/database";
import { Input, Select } from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { ErrorBanner, Pager, Row, Table } from "@/components/ui/table";
import { EliminarRuta } from "./eliminar-ruta";
import { EstadoRutaChip } from "./estado-ruta-chip";
import { RutasTabs } from "./rutas-tabs";

const PAGE_SIZE = 25;
const COLS = "grid-cols-[1.5fr_1.2fr_1.3fr_80px_90px_1.2fr_110px_90px]";

type Filtro = "activas" | Enums<"estado_ruta"> | "todas";
const FILTROS: { value: Filtro; label: string }[] = [
  { value: "activas", label: "Pendientes y en curso" },
  { value: "pendiente", label: "Pendiente" },
  { value: "en_curso", label: "En curso" },
  { value: "finalizada", label: "Finalizada" },
  { value: "todas", label: "Todos los estados" },
];

/** "Rutas creadas" (activas) e "Historial" (finalizadas): misma tabla, distinto filtro inicial. */
export function RutasLista({ modo }: { modo: "creadas" | "historial" }) {
  const supabase = useSupabase();
  const router = useRouter();
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [choferId, setChoferId] = useState("");
  const [estado, setEstado] = useState<Filtro>(modo === "creadas" ? "activas" : "finalizada");
  const [page, setPage] = useState(0);

  const choferes = useQuery(
    async () => unwrap(await supabase.from("choferes").select("id, nombre").order("nombre")) ?? [],
    [],
  ).data;

  const lista = useQuery(async () => {
    let q = supabase
      .from("rutas")
      .select("*, choferes(nombre), vehiculos(placa, alias), paradas(estado)", { count: "exact" })
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (desde) q = q.gte("fecha", desde);
    if (hasta) q = q.lte("fecha", hasta);
    if (choferId) q = q.eq("chofer_id", choferId);
    if (estado === "activas") q = q.in("estado", ["pendiente", "en_curso"]);
    else if (estado !== "todas") q = q.eq("estado", estado);
    const res = await q;
    return { rows: unwrap(res) ?? [], total: res.count ?? 0 };
  }, [desde, hasta, choferId, estado, page]);

  const rows = lista.data?.rows ?? [];
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(0);
  };

  return (
    <div className="absolute inset-0 flex flex-col gap-3.5 overflow-auto px-5 pb-5 pt-4">
      <div className="flex flex-none flex-wrap items-center gap-3">
        <RutasTabs />
        <div className="flex-1" />
        <label className="flex items-center gap-2 text-[13px] text-muted">
          Desde
          <Input type="date" className="w-auto" value={desde} onChange={(e) => reset(setDesde)(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-[13px] text-muted">
          Hasta
          <Input type="date" className="w-auto" value={hasta} onChange={(e) => reset(setHasta)(e.target.value)} />
        </label>
        <Select
          aria-label="Chofer"
          className="w-auto"
          value={choferId}
          onChange={(e) => reset(setChoferId)(e.target.value)}
        >
          <option value="">Todos los choferes</option>
          {choferes?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Estado"
          className="w-auto"
          value={estado}
          onChange={(e) => reset(setEstado)(e.target.value as Filtro)}
        >
          {FILTROS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>

      {lista.error && <ErrorBanner message={lista.error} onRetry={lista.reload} />}

      <div className="flex-none">
        <Table
          cols={COLS}
          headers={["Ruta", "Chofer", "Vehículo", "Clientes", "Distancia", "Avance", "Estado", ""]}
          empty={lista.loading ? "Cargando…" : rows.length === 0 ? "No hay rutas con esos filtros." : null}
        >
          {rows.map((r) => {
            const a = avance(r.paradas);
            const rechazos = r.paradas.filter((p) => p.estado === "rechazado").length;
            return (
              <Row key={r.id} cols={COLS} onClick={() => router.push(`/admin/rutas/${r.id}`)}>
                <div>
                  <div className="font-semibold">{r.zona ?? "Sin zona"}</div>
                  <div className="text-xs text-muted">{fechaCorta(r.fecha)}</div>
                </div>
                <div>{r.choferes.nombre}</div>
                <div className="text-muted">
                  {r.vehiculos.alias ? `${r.vehiculos.alias} (${r.vehiculos.placa})` : r.vehiculos.placa}
                </div>
                <div>{r.paradas.length}</div>
                <div>{kmATexto(r.distancia_km)}</div>
                <div className="flex items-center gap-2">
                  <Progress pct={a.pct} className="flex-1" />
                  <span className="w-9 text-xs text-muted">{a.pct}%</span>
                  {rechazos > 0 && <span className="text-xs text-bad">{rechazos}✕</span>}
                </div>
                <div>
                  <EstadoRutaChip estado={r.estado} />
                </div>
                <div className="text-right">
                  <EliminarRuta
                    ruta={{ id: r.id, fecha: r.fecha, zona: r.zona, estado: r.estado, chofer: r.choferes.nombre, paradas: r.paradas.length }}
                    onDeleted={lista.reload}
                  />
                </div>
              </Row>
            );
          })}
        </Table>
        <Pager page={page} pageSize={PAGE_SIZE} total={lista.data?.total ?? 0} onChange={setPage} />
      </div>
    </div>
  );
}
