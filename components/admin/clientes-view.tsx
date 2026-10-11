"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@/hooks/use-query";
import { useSupabase } from "@/hooks/use-supabase";
import { horaCorta } from "@/lib/format";
import { likeTerm } from "@/lib/search";
import { unwrap } from "@/lib/supabase/unwrap";
import type { Tables } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input, Select } from "@/components/ui/form";
import { ErrorBanner, Pager, Row, Table } from "@/components/ui/table";
import { ClienteForm } from "./cliente-form";

const PAGE_SIZE = 50;
const COLS = "grid-cols-[2fr_1fr_1.3fr_1fr_90px_70px]";

export function ClientesView() {
  const supabase = useSupabase();
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [zona, setZona] = useState("");
  const [sinCoords, setSinCoords] = useState(false);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Tables<"clientes"> | "nuevo" | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const lista = useQuery(async () => {
    let query = supabase
      .from("clientes")
      .select("*", { count: "exact" })
      .order("nombre")
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (q.trim()) query = query.ilike("nombre", likeTerm(q));
    if (zona) query = query.eq("zona", zona);
    if (sinCoords) query = query.is("lat", null);
    const res = await query;
    return { rows: unwrap(res) ?? [], total: res.count ?? 0 };
  }, [q, zona, sinCoords, page]);

  // Zonas existentes y cuántos clientes activos no tienen coordenadas (no pueden entrar a una ruta).
  const meta = useQuery(async () => {
    const zonas = unwrap(await supabase.from("clientes").select("zona").not("zona", "is", null)) ?? [];
    const sin = await supabase
      .from("clientes")
      .select("id", { count: "exact", head: true })
      .eq("activo", true)
      .is("lat", null);
    return {
      zonas: [...new Set(zonas.map((z) => z.zona!))].sort((a, b) => a.localeCompare(b)),
      sinCoordenadas: sin.count ?? 0,
    };
  }, []);

  function onSaved() {
    setEditing(null);
    lista.reload();
    meta.reload();
  }

  const rows = lista.data?.rows ?? [];
  const zonas = meta.data?.zonas ?? [];

  return (
    <div className="space-y-4">
      {(meta.data?.sinCoordenadas ?? 0) > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-gold/40 bg-chip-warn px-4 py-3 text-[13.5px] text-chip-warn-ink">
          <span>
            <b>{meta.data!.sinCoordenadas}</b> cliente(s) activo(s) no tienen coordenadas: no pueden
            entrar a una ruta hasta que las completes.
          </span>
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => {
              setSinCoords((v) => !v);
              setPage(0);
            }}
          >
            {sinCoords ? "Ver todos" : "Ver solo estos"}
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="max-w-xs"
          placeholder="Buscar por nombre…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          aria-label="Buscar por nombre"
        />
        <Select
          className="max-w-[200px]"
          value={zona}
          aria-label="Filtrar por zona"
          onChange={(e) => {
            setZona(e.target.value);
            setPage(0);
          }}
        >
          <option value="">Todas las zonas</option>
          {zonas.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </Select>
        <div className="flex-1" />
        <Button onClick={() => setEditing("nuevo")}>+ Nuevo cliente</Button>
      </div>

      {lista.error && <ErrorBanner message={lista.error} onRetry={lista.reload} />}

      <Table
        cols={COLS}
        headers={["Cliente", "Zona", "Coordenadas", "Ventana horaria", "Estado", ""]}
        empty={lista.loading ? "Cargando…" : rows.length === 0 ? "No hay clientes con esos filtros." : null}
      >
        {rows.map((c) => (
          <Row key={c.id} cols={COLS}>
            <div className="min-w-0">
              <div className="truncate font-semibold">{c.nombre}</div>
              <div className="truncate text-xs text-muted">{c.direccion}</div>
            </div>
            <div className="text-muted">{c.zona ?? "—"}</div>
            <div>
              {c.lat == null ? (
                <Chip tone="warn">Sin coordenadas</Chip>
              ) : (
                <span className="text-[12.5px] text-muted">
                  {c.lat.toFixed(5)}, {c.lng!.toFixed(5)}
                </span>
              )}
            </div>
            <div className="text-muted">
              {c.ventana_horario_inicio
                ? `${horaCorta(c.ventana_horario_inicio)} – ${horaCorta(c.ventana_horario_fin)}`
                : "—"}
            </div>
            <div>
              <Chip tone={c.activo ? "ok" : "neutral"}>{c.activo ? "Activo" : "Inactivo"}</Chip>
            </div>
            <div className="text-right">
              <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>
                Editar
              </Button>
            </div>
          </Row>
        ))}
      </Table>
      <Pager page={page} pageSize={PAGE_SIZE} total={lista.data?.total ?? 0} onChange={setPage} />

      {editing && (
        <ClienteForm
          cliente={editing === "nuevo" ? null : editing}
          zonas={zonas}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
