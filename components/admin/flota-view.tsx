"use client";

import { useState } from "react";
import { useQuery } from "@/hooks/use-query";
import { useSupabase } from "@/hooks/use-supabase";
import { hoyLima } from "@/lib/format";
import { unwrap } from "@/lib/supabase/unwrap";
import type { Tables } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { StateTabs } from "@/components/ui/segmented";
import { ErrorBanner, Row, Table } from "@/components/ui/table";
import { ChoferForm } from "./chofer-form";
import { VehiculoForm } from "./vehiculo-form";

type Tab = "choferes" | "vehiculos";
const COLS_CHOFERES = "grid-cols-[1.6fr_1fr_1.1fr_1.2fr_120px_70px]";
const COLS_VEHICULOS = "grid-cols-[1.4fr_1fr_1fr_1.2fr_120px_70px]";

function estadoAsignacion(
  activo: boolean,
  rutas: { estado: string }[],
): { label: string; tone: ChipTone } {
  if (!activo) return { label: "Inactivo", tone: "neutral" };
  if (rutas.some((r) => r.estado === "en_curso")) return { label: "En ruta", tone: "warn" };
  if (rutas.some((r) => r.estado === "pendiente")) return { label: "Asignado", tone: "ok" };
  return { label: "Disponible", tone: "ok" };
}

export function FlotaView() {
  const supabase = useSupabase();
  const [tab, setTab] = useState<Tab>("choferes");
  const [chofer, setChofer] = useState<Tables<"choferes"> | "nuevo" | null>(null);
  const [vehiculo, setVehiculo] = useState<Tables<"vehiculos"> | "nuevo" | null>(null);

  const data = useQuery(async () => {
    const hoy = hoyLima();
    const [choferes, vehiculos, rutas] = await Promise.all([
      supabase.from("choferes").select("*").order("nombre"),
      supabase.from("vehiculos").select("*").order("placa"),
      supabase
        .from("rutas")
        .select("chofer_id, vehiculo_id, estado")
        .eq("fecha", hoy)
        .in("estado", ["pendiente", "en_curso"]),
    ]);
    return {
      choferes: unwrap(choferes) ?? [],
      vehiculos: unwrap(vehiculos) ?? [],
      rutas: unwrap(rutas) ?? [],
    };
  }, []);

  const onSaved = () => {
    setChofer(null);
    setVehiculo(null);
    data.reload();
  };
  const rutas = data.data?.rutas ?? [];
  const vehiculosPorId = new Map((data.data?.vehiculos ?? []).map((v) => [v.id, v]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <StateTabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "choferes", label: "Choferes" },
            { value: "vehiculos", label: "Vehículos" },
          ]}
        />
        <Button onClick={() => (tab === "choferes" ? setChofer("nuevo") : setVehiculo("nuevo"))}>
          {tab === "choferes" ? "+ Nuevo chofer" : "+ Nuevo vehículo"}
        </Button>
      </div>

      {data.error && <ErrorBanner message={data.error} onRetry={data.reload} />}

      {tab === "choferes" ? (
        <Table
          cols={COLS_CHOFERES}
          headers={["Chofer", "DNI (usuario)", "Teléfono", "Vehículo hoy", "Estado", ""]}
          empty={data.loading ? "Cargando…" : data.data?.choferes.length === 0 ? "Aún no hay choferes." : null}
        >
          {(data.data?.choferes ?? []).map((c) => {
            const suyas = rutas.filter((r) => r.chofer_id === c.id);
            const est = estadoAsignacion(c.activo, suyas);
            const placa = suyas[0] && vehiculosPorId.get(suyas[0].vehiculo_id)?.placa;
            return (
              <Row key={c.id} cols={COLS_CHOFERES}>
                <div className="font-semibold">{c.nombre}</div>
                <div className="text-muted">{c.usuario}</div>
                <div className="text-muted">{c.telefono ?? "—"}</div>
                <div className="text-muted">{placa ?? "—"}</div>
                <div>
                  <Chip tone={est.tone}>{est.label}</Chip>
                </div>
                <div className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => setChofer(c)}>
                    Editar
                  </Button>
                </div>
              </Row>
            );
          })}
        </Table>
      ) : (
        <Table
          cols={COLS_VEHICULOS}
          headers={["Vehículo", "Placa", "Capacidad", "Chofer hoy", "Estado", ""]}
          empty={data.loading ? "Cargando…" : data.data?.vehiculos.length === 0 ? "Aún no hay vehículos." : null}
        >
          {(data.data?.vehiculos ?? []).map((v) => {
            const suyas = rutas.filter((r) => r.vehiculo_id === v.id);
            const est = estadoAsignacion(v.activo, suyas);
            const quien = suyas[0] && data.data?.choferes.find((c) => c.id === suyas[0]!.chofer_id)?.nombre;
            return (
              <Row key={v.id} cols={COLS_VEHICULOS}>
                <div className="font-semibold">{v.alias ?? v.placa}</div>
                <div className="text-muted">{v.placa}</div>
                <div className="text-muted">
                  {v.capacidad_kg != null ? `${Number(v.capacidad_kg).toLocaleString("es-PE")} kg` : "—"}
                </div>
                <div className="text-muted">{quien ?? "—"}</div>
                <div>
                  <Chip tone={est.tone}>{est.label}</Chip>
                </div>
                <div className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => setVehiculo(v)}>
                    Editar
                  </Button>
                </div>
              </Row>
            );
          })}
        </Table>
      )}

      {chofer && (
        <ChoferForm
          chofer={chofer === "nuevo" ? null : chofer}
          onClose={() => setChofer(null)}
          onSaved={onSaved}
        />
      )}
      {vehiculo && (
        <VehiculoForm
          vehiculo={vehiculo === "nuevo" ? null : vehiculo}
          onClose={() => setVehiculo(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
