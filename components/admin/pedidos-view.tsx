"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@/hooks/use-query";
import { useSupabase } from "@/hooks/use-supabase";
import { describeDbError } from "@/lib/db-errors";
import { fechaCorta, hoyLima } from "@/lib/format";
import { likeTerm } from "@/lib/search";
import { unwrap } from "@/lib/supabase/unwrap";
import { parseOpcionalNumero } from "@/lib/validation";
import type { Enums } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { ErrorBanner, Pager, Row, Table } from "@/components/ui/table";
import { ClienteCombobox, type ClienteOpcion } from "./cliente-combobox";

const PAGE_SIZE = 50;
const COLS = "grid-cols-[2fr_1fr_1fr_1fr_1fr]";
const ESTADOS: Enums<"estado_pedido">[] = ["pendiente", "entregado", "rechazado", "pospuesto", "cancelado"];
const TONOS: Record<Enums<"estado_pedido">, ChipTone> = {
  pendiente: "warn",
  entregado: "ok",
  rechazado: "bad",
  pospuesto: "neutral",
  cancelado: "neutral",
};
const etiqueta = (e: string) => e[0]!.toUpperCase() + e.slice(1);

export function PedidosView() {
  const supabase = useSupabase();
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<"" | Enums<"estado_pedido">>("");
  const [page, setPage] = useState(0);
  const [nuevo, setNuevo] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const lista = useQuery(async () => {
    let query = supabase
      .from("pedidos")
      .select("*, clientes!inner(nombre, zona)", { count: "exact" })
      .order("fecha_pedido", { ascending: false })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (estado) query = query.eq("estado", estado);
    if (q.trim()) query = query.ilike("clientes.nombre", likeTerm(q));
    const res = await query;
    return { rows: unwrap(res) ?? [], total: res.count ?? 0 };
  }, [q, estado, page]);

  const rows = lista.data?.rows ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="max-w-xs"
          placeholder="Buscar por cliente…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          aria-label="Buscar por cliente"
        />
        <Select
          className="max-w-[200px]"
          value={estado}
          aria-label="Filtrar por estado"
          onChange={(e) => {
            setEstado(e.target.value as typeof estado);
            setPage(0);
          }}
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {etiqueta(e)}
            </option>
          ))}
        </Select>
        <div className="flex-1" />
        <Button onClick={() => setNuevo(true)}>+ Nuevo pedido</Button>
      </div>

      {lista.error && <ErrorBanner message={lista.error} onRetry={lista.reload} />}

      <Table
        cols={COLS}
        headers={["Cliente", "Zona", "Fecha del pedido", "Peso", "Estado"]}
        empty={lista.loading ? "Cargando…" : rows.length === 0 ? "No hay pedidos con esos filtros." : null}
      >
        {rows.map((p) => (
          <Row key={p.id} cols={COLS}>
            <div className="font-semibold">{p.clientes.nombre}</div>
            <div className="text-muted">{p.clientes.zona ?? "—"}</div>
            <div className="text-muted">{fechaCorta(p.fecha_pedido)}</div>
            <div className="text-muted">{p.peso_kg != null ? `${p.peso_kg} kg` : "—"}</div>
            <div>
              <Chip tone={TONOS[p.estado]}>{etiqueta(p.estado)}</Chip>
            </div>
          </Row>
        ))}
      </Table>
      <Pager page={page} pageSize={PAGE_SIZE} total={lista.data?.total ?? 0} onChange={setPage} />

      {nuevo && (
        <NuevoPedido
          onClose={() => setNuevo(false)}
          onSaved={() => {
            setNuevo(false);
            lista.reload();
          }}
        />
      )}
    </div>
  );
}

function NuevoPedido({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const supabase = useSupabase();
  const toast = useToast();
  const [cliente, setCliente] = useState<ClienteOpcion | null>(null);
  const [fecha, setFecha] = useState(hoyLima());
  const [peso, setPeso] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const kg = parseOpcionalNumero(peso);
    const errs: Record<string, string> = {};
    if (!cliente) errs.cliente = "Selecciona un cliente.";
    if (!fecha) errs.fecha = "Indica la fecha.";
    if (peso.trim() && (kg === null || kg < 0)) errs.peso = "Debe ser un número de 0 o más.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    const { error } = await supabase
      .from("pedidos")
      .insert({ cliente_id: cliente!.id, fecha_pedido: fecha, peso_kg: kg, estado: "pendiente" });
    setSaving(false);
    if (error) return setFormError(describeDbError(error));
    toast("Pedido registrado");
    onSaved();
  }

  return (
    <Modal title="Nuevo pedido" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Cliente *" error={errors.cliente}>
          <ClienteCombobox value={cliente} onChange={setCliente} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Fecha del pedido *" error={errors.fecha}>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Field>
          <Field label="Peso (kg)" error={errors.peso} hint="Opcional.">
            <Input inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} />
          </Field>
        </div>
        <FormError message={formError} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Registrar pedido
          </Button>
        </div>
      </form>
    </Modal>
  );
}
