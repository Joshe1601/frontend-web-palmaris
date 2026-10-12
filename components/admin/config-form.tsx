"use client";

import { useState, type FormEvent } from "react";
import type { Tables } from "@/types/database";
import { useQuery } from "@/hooks/use-query";
import { useSupabase } from "@/hooks/use-supabase";
import { describeDbError } from "@/lib/db-errors";
import { unwrap } from "@/lib/supabase/unwrap";
import { parseOpcionalNumero, validarCoordenadas } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";

export function ConfigForm() {
  const supabase = useSupabase();
  const { data, error, loading } = useQuery(
    async () => unwrap(await supabase.from("configuracion").select("*").eq("id", true).maybeSingle()),
    [],
  );

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 text-muted">
        <Spinner /> Cargando…
      </div>
    );
  }
  if (error) return <FormError message={error} />;
  if (!data) return <FormError message="No existe la fila de configuración en la base de datos." />;
  return <ConfigFields initial={data} />;
}

function ConfigFields({ initial }: { initial: Tables<"configuracion"> }) {
  const supabase = useSupabase();
  const toast = useToast();
  const [lat, setLat] = useState(initial.almacen_lat?.toString() ?? "");
  const [lng, setLng] = useState(initial.almacen_lng?.toString() ?? "");
  const [vel, setVel] = useState(initial.velocidad_promedio_kmh.toString());
  const [min, setMin] = useState(initial.tiempo_atencion_min.toString());
  const [radio, setRadio] = useState(initial.radio_llegada_m.toString());
  const [umbral, setUmbral] = useState(initial.umbral_estacionamiento_min.toString());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const coords = validarCoordenadas(lat, lng);
    const v = parseOpcionalNumero(vel);
    const m = parseOpcionalNumero(min);
    const errs: Record<string, string> = { ...coords.errors };
    if (v === null || v <= 0) errs.vel = "Debe ser un número mayor que 0.";
    if (m === null || m < 0 || !Number.isInteger(m)) errs.min = "Debe ser un entero de 0 o más.";
    const r = parseOpcionalNumero(radio);
    const u = parseOpcionalNumero(umbral);
    if (r === null || r < 1 || !Number.isInteger(r)) errs.radio = "Debe ser un entero de 1 o más.";
    if (u === null || u < 1 || !Number.isInteger(u)) errs.umbral = "Debe ser un entero de 1 o más.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    const { error } = await supabase
      .from("configuracion")
      .update({
        almacen_lat: coords.lat,
        almacen_lng: coords.lng,
        velocidad_promedio_kmh: v!,
        tiempo_atencion_min: m!,
        radio_llegada_m: r!,
        umbral_estacionamiento_min: u!,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    setSaving(false);
    if (error) return setFormError(describeDbError(error));
    toast("Configuración guardada");
  }

  const sinAlmacen = !lat.trim() || !lng.trim();

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5">
      {sinAlmacen && (
        <div className="rounded-lg border border-gold/40 bg-chip-warn px-4 py-3 text-[13.5px] text-chip-warn-ink">
          <b>Falta la ubicación del almacén.</b> Sin ella no se pueden generar rutas, porque cada
          ruta parte y termina en el almacén.
        </div>
      )}

      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="text-base font-bold">Almacén</h2>
        <p className="mb-4 mt-0.5 text-[12.5px] text-muted">Punto de salida y llegada de todas las rutas.</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Latitud" error={errors.lat} hint="Ej. -6.4833">
            <Input inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} />
          </Field>
          <Field label="Longitud" error={errors.lng} hint="Ej. -76.3667">
            <Input inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="text-base font-bold">Cálculo de tiempos</h2>
        <p className="mb-4 mt-0.5 text-[12.5px] text-muted">
          Se usan para estimar la hora de llegada a cada parada.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Velocidad promedio (km/h)" error={errors.vel}>
            <Input inputMode="decimal" value={vel} onChange={(e) => setVel(e.target.value)} />
          </Field>
          <Field label="Minutos de atención por parada" error={errors.min}>
            <Input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="text-base font-bold">Control de entregas</h2>
        <p className="mb-4 mt-0.5 text-[12.5px] text-muted">
          Reglas que aplica la app del chofer y que el panel usa para marcar esperas largas.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Radio para marcar «He llegado» (metros)"
            error={errors.radio}
            hint="El chofer solo puede marcar llegada a menos de esta distancia de la tienda."
          >
            <Input inputMode="numeric" value={radio} onChange={(e) => setRadio(e.target.value)} />
          </Field>
          <Field
            label="Alerta de estacionamiento (minutos)"
            error={errors.umbral}
            hint="Se destaca una permanencia o parada igual o mayor a este tiempo."
          >
            <Input inputMode="numeric" value={umbral} onChange={(e) => setUmbral(e.target.value)} />
          </Field>
        </div>
      </section>

      <FormError message={formError} />
      <Button type="submit" loading={saving}>
        Guardar cambios
      </Button>
    </form>
  );
}
