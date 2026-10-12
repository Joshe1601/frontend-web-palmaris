"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@/hooks/use-query";
import { useSupabase } from "@/hooks/use-supabase";
import { cn } from "@/lib/cn";
import { getClientesDisponibles } from "@/lib/data/clientes-disponibles";
import { choferesOcupados } from "@/lib/disponibilidad";
import { hoyLima, kmATexto, minutosATexto } from "@/lib/format";
import { optimizeRoute } from "@/lib/routing/optimize";
import { buildSchedule } from "@/lib/routing/schedule";
import { unwrap } from "@/lib/supabase/unwrap";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { MapView } from "@/components/map/map-view";
import type { MapLine, MapMarker } from "@/components/map/types";
import { RutasTabs } from "./rutas-tabs";

export function GenerarRuta() {
  const supabase = useSupabase();
  const router = useRouter();
  const toast = useToast();

  const [fecha, setFecha] = useState(hoyLima);
  const [zona, setZona] = useState("");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<ReadonlySet<string>>(new Set());
  const [choferId, setChoferId] = useState("");
  const [vehiculoId, setVehiculoId] = useState("");
  const [horaSalida, setHoraSalida] = useState("08:00");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = useQuery(async () => {
    const [config, clientes, choferes, vehiculos, abiertas] = await Promise.all([
      supabase.from("configuracion").select("*").eq("id", true).maybeSingle(),
      getClientesDisponibles(supabase),
      supabase.from("choferes").select("id, nombre").eq("activo", true).order("nombre"),
      supabase.from("vehiculos").select("id, placa, alias").eq("activo", true).order("placa"),
      supabase.from("rutas").select("chofer_id, fecha, estado").in("estado", ["pendiente", "en_curso"]),
    ]);
    return {
      config: unwrap(config),
      clientes,
      choferes: unwrap(choferes) ?? [],
      vehiculos: unwrap(vehiculos) ?? [],
      abiertas: (unwrap(abiertas) ?? []) as { chofer_id: string; fecha: string; estado: "pendiente" | "en_curso" }[],
    };
  }, []);

  // Choferes que ya tienen ruta ese día (o una en curso) no se ofrecen para otra.
  const ocupados = useMemo(() => choferesOcupados(base.data?.abiertas ?? [], fecha), [base.data, fecha]);
  const choferesLibres = useMemo(
    () => (base.data?.choferes ?? []).filter((c) => !ocupados.has(c.id)),
    [base.data, ocupados],
  );
  const choferSel = choferesLibres.some((c) => c.id === choferId) ? choferId : "";

  const config = base.data?.config ?? null;
  const clientes = useMemo(() => base.data?.clientes ?? [], [base.data]);
  const depot = useMemo(
    () =>
      config && config.almacen_lat != null && config.almacen_lng != null
        ? { lat: Number(config.almacen_lat), lng: Number(config.almacen_lng) }
        : null,
    [config],
  );

  const zonas = useMemo(
    () => [...new Set(clientes.map((c) => c.zona).filter((z): z is string => !!z))].sort(),
    [clientes],
  );
  const visibles = useMemo(() => {
    const term = q.trim().toLowerCase();
    return clientes.filter(
      (c) => (!zona || c.zona === zona) && (!term || c.nombre.toLowerCase().includes(term)),
    );
  }, [clientes, zona, q]);
  const seleccionados = useMemo(() => clientes.filter((c) => sel.has(c.id)), [clientes, sel]);

  // Vista previa local con el mismo módulo puro que usa el servidor (sin red).
  const preview = useMemo(() => {
    if (!depot || !config || seleccionados.length === 0) return null;
    const { order } = optimizeRoute(
      depot,
      seleccionados.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng, c })),
    );
    const schedule = buildSchedule({
      depot,
      orderedStops: order.map((s) => ({
        id: s.id,
        lat: s.lat,
        lng: s.lng,
        ventanaInicio: s.c.ventana_horario_inicio,
        ventanaFin: s.c.ventana_horario_fin,
      })),
      speedKmh: Number(config.velocidad_promedio_kmh),
      serviceMin: config.tiempo_atencion_min,
      departure: horaSalida || "08:00",
    });
    return { order, schedule };
  }, [depot, config, seleccionados, horaSalida]);

  const toggle = useCallback((id: string) => {
    setSel((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);
  const todosVisiblesMarcados = visibles.length > 0 && visibles.every((c) => sel.has(c.id));
  function toggleVisibles() {
    setSel((prev) => {
      const next = new Set(prev);
      for (const c of visibles) {
        if (todosVisiblesMarcados) next.delete(c.id);
        else next.add(c.id);
      }
      return next;
    });
  }

  const ordenPorId = useMemo(
    () => new Map((preview?.order ?? []).map((s, i) => [s.id, i + 1])),
    [preview],
  );
  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = visibles.map((c) => {
      const on = sel.has(c.id);
      return {
        id: c.id,
        lat: c.lat,
        lng: c.lng,
        kind: "client",
        tone: on ? "forest" : "stone",
        dim: !on,
        label: on ? String(ordenPorId.get(c.id) ?? "") : undefined,
        title: c.nombre,
        onClick: () => toggle(c.id),
      };
    });
    if (depot) list.unshift({ id: "depot", ...depot, kind: "depot", tone: "forest", title: "Almacén" });
    return list;
  }, [visibles, sel, ordenPorId, depot, toggle]);
  const lines = useMemo<MapLine[]>(() => {
    if (!depot || !preview) return [];
    const pts: [number, number][] = [
      [depot.lat, depot.lng],
      ...preview.order.map((s): [number, number] => [s.lat, s.lng]),
      [depot.lat, depot.lng],
    ];
    return [{ id: "preview", points: pts, tone: "forest", weight: 4 }];
  }, [depot, preview]);

  const chofer = choferesLibres.find((c) => c.id === choferSel);
  const puedeOptimizar = !!depot && seleccionados.length > 0 && !!choferSel && !!vehiculoId && !!fecha;

  async function optimizar() {
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/routes/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_ids: seleccionados.map((c) => c.id),
          chofer_id: choferSel,
          vehiculo_id: vehiculoId,
          fecha,
          zona: zona || null,
          hora_salida: horaSalida || "08:00",
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; ruta_id?: string; ruteo?: "vial" | "lineal" };
      if (!res.ok || !json.ruta_id) {
        setError(json.error ?? "No se pudo generar la ruta.");
        if (res.status === 409) base.reload();
        return;
      }
      toast(
        json.ruteo === "vial"
          ? "Ruta creada y asignada al chofer"
          : "Ruta creada con distancias en línea recta (el servicio de ruteo por calles no estuvo disponible)",
      );
      router.push(`/admin/rutas/${json.ruta_id}`);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="absolute inset-0 flex flex-col gap-3.5 overflow-auto px-5 pb-5 pt-4">
      <div className="flex flex-none items-center gap-3">
        <RutasTabs />
        <div className="flex-1" />
        <Input
          type="date"
          aria-label="Fecha de la ruta"
          className="w-auto"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
        <Select aria-label="Zona" className="w-auto" value={zona} onChange={(e) => setZona(e.target.value)}>
          <option value="">Todas las zonas</option>
          {zonas.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </Select>
      </div>

      {base.error && <FormError message={base.error} />}

      <div className="grid min-h-[640px] flex-1 grid-cols-[392px_minmax(0,1fr)_360px] gap-3.5">
        {/* Columna izquierda: pasos 1 a 3 */}
        <div className="flex min-h-0 flex-col gap-3">
          <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-line bg-white p-4">
            <h2 className="text-[15px] font-bold">
              <span className="text-gold">1.</span> Seleccionar clientes
            </h2>
            <p className="mb-2.5 mt-0.5 text-[12.5px] text-muted">
              Clientes con pedidos pendientes. Los marcados entran en la ruta.
            </p>
            <Input
              placeholder="Buscar cliente…"
              aria-label="Buscar cliente"
              className="mb-2"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div className="min-h-[200px] flex-1 overflow-auto rounded-lg border border-line-soft">
              {base.loading && !base.data ? (
                <div className="flex items-center gap-2 p-4 text-[13px] text-muted">
                  <Spinner /> Cargando clientes…
                </div>
              ) : visibles.length === 0 ? (
                <div className="p-5 text-center text-[13px] text-muted">
                  {clientes.length === 0
                    ? "No hay clientes activos, con coordenadas y con pedidos pendientes disponibles."
                    : "Ningún cliente coincide con el filtro."}
                </div>
              ) : (
                visibles.map((c) => {
                  const on = sel.has(c.id);
                  return (
                    <label
                      key={c.id}
                      className="grid cursor-pointer grid-cols-[22px_1fr_auto] items-center gap-2.5 border-b border-row px-2.5 py-2 text-[13px] last:border-b-0 hover:bg-canvas"
                    >
                      <input
                        type="checkbox"
                        className="size-[18px] accent-forest"
                        checked={on}
                        onChange={() => toggle(c.id)}
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{c.nombre}</span>
                        <span className="block truncate text-xs text-muted">{c.direccion}</span>
                      </span>
                      <span className="text-right text-xs text-muted">
                        {c.zona ?? "Sin zona"}
                        <br />
                        {c.pedidos.length} {c.pedidos.length === 1 ? "pedido" : "pedidos"}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
            <div className="mt-2.5 flex justify-between text-[13px]">
              <span className="font-semibold">
                {seleccionados.length} {seleccionados.length === 1 ? "cliente seleccionado" : "clientes seleccionados"}
              </span>
              <button
                type="button"
                onClick={toggleVisibles}
                disabled={visibles.length === 0}
                className="font-semibold text-forest disabled:opacity-50"
              >
                {todosVisiblesMarcados ? "Quitar todos" : "Seleccionar todos"}
              </button>
            </div>
          </section>

          <section className="flex-none rounded-xl border border-line bg-white p-4">
            <h2 className="mb-2.5 text-[15px] font-bold">
              <span className="text-gold">2.</span> Asignar chofer y vehículo
            </h2>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Chofer">
                <Select value={choferSel} onChange={(e) => setChoferId(e.target.value)}>
                  <option value="">Seleccionar…</option>
                  {choferesLibres.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Vehículo">
                <Select value={vehiculoId} onChange={(e) => setVehiculoId(e.target.value)}>
                  <option value="">Seleccionar…</option>
                  {base.data?.vehiculos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.alias ? `${v.alias} (${v.placa})` : v.placa}
                    </option>
                  ))}
                </Select>
              </Field>
              {ocupados.size > 0 && (
                <p className="col-span-2 -mt-1 text-[12px] text-muted">
                  {ocupados.size} {ocupados.size === 1 ? "chofer no aparece" : "choferes no aparecen"}: ya tienen una ruta
                  asignada para esta fecha o en curso.
                </p>
              )}
              {base.data && choferesLibres.length === 0 && (
                <p className="col-span-2 text-[12px] text-bad">No hay choferes disponibles para esta fecha.</p>
              )}
              <Field label="Hora de salida" className="col-span-2">
                <Input type="time" value={horaSalida} onChange={(e) => setHoraSalida(e.target.value)} />
              </Field>
            </div>
          </section>

          <div className="flex-none space-y-2">
            {!depot && !base.loading && (
              <div className="rounded-lg bg-chip-warn px-3 py-2 text-[12.5px] text-chip-warn-ink">
                Falta la ubicación del almacén.{" "}
                <Link href="/admin/configuracion" className="font-semibold underline">
                  Configúrala
                </Link>{" "}
                para generar rutas.
              </div>
            )}
            <FormError message={error} />
            <Button
              size="lg"
              className="w-full rounded-xl"
              disabled={!puedeOptimizar}
              loading={enviando}
              onClick={optimizar}
            >
              {enviando ? "Calculando orden óptimo…" : "3. Optimizar ruta"}
            </Button>
          </div>
        </div>

        {/* Centro: mapa */}
        <MapView
          markers={markers}
          lines={lines}
          fitKey={`${zona}|${clientes.length}|${depot ? "d" : "x"}`}
          className="rounded-xl border border-line"
        >
          <div className="absolute bottom-3.5 left-3.5 z-[1000] grid gap-1.5 rounded-[10px] bg-white px-3.5 py-2.5 text-xs shadow-md">
            <div>■ Almacén (inicio y fin)</div>
            <div className="text-stone">● Cliente sin incluir</div>
            <div className="text-forest">● Cliente en ruta</div>
          </div>
        </MapView>

        {/* Derecha: resumen y orden de visita */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-white">
          <div className="flex-none border-b border-line-soft px-[18px] py-4">
            <div className="flex items-center justify-between">
              <div className="text-base font-bold">Ruta · {zona || "Todas las zonas"}</div>
              <Chip tone={preview ? "ok" : "neutral"}>{preview ? "Vista previa" : "Borrador"}</Chip>
            </div>
            <div className="mb-3.5 mt-0.5 text-[12.5px] text-muted">
              {chofer ? `Asignada a ${chofer.nombre}` : "Sin chofer asignado"}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Metric value={String(seleccionados.length)} label="clientes" />
              <Metric value={preview ? kmATexto(preview.schedule.totalKm) : "—"} label="distancia" />
              <Metric value={preview ? minutosATexto(preview.schedule.totalMin) : "—"} label="tiempo est." />
            </div>
          </div>
          {preview ? (
            <div className="min-h-0 flex-1 overflow-auto px-[18px] py-1">
              <div className="pb-1 pt-2.5 text-[13px] font-bold">Orden de visita</div>
              {preview.schedule.stops.map((s, i) => {
                const c = preview.order[i]!.c;
                return (
                  <div
                    key={s.id}
                    className="grid grid-cols-[28px_1fr_auto] items-center gap-2.5 border-b border-row py-2.5 last:border-b-0"
                  >
                    <div className="grid size-[26px] place-items-center rounded-full bg-forest text-xs font-semibold text-white">
                      {s.orden}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold">{c.nombre}</div>
                      <div className="truncate text-[11.5px] text-muted">
                        {s.horaEstimadaLlegada}
                        {s.advertenciaVentana && (
                          <span className="ml-1.5 rounded bg-chip-warn px-1.5 py-px font-semibold text-chip-warn-ink">
                            ⚠ fuera de ventana
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted">
                      {s.distanciaKm.toFixed(1)} km
                      <br />
                      {s.tiempoMin} min
                    </div>
                  </div>
                );
              })}
              <p className="py-3 text-[11.5px] leading-snug text-muted">
                Vista previa en línea recta (Haversine). Al crear la ruta se calcula el trazado por calles.
              </p>
            </div>
          ) : (
            <div className="grid flex-1 place-items-center p-8 text-center text-[13.5px] leading-normal text-muted">
              <p>
                Selecciona clientes para ver la vista previa y pulsa
                <br />
                <b className="text-ink">Optimizar ruta</b> para crearla y asignarla.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className={cn("text-[19px] font-bold leading-tight", value === "—" && "text-stone")}>{value}</div>
      <div className="text-[11.5px] text-muted">{label}</div>
    </div>
  );
}
