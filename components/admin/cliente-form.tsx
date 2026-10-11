"use client";

import { useState, type FormEvent } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { describeDbError } from "@/lib/db-errors";
import { validarCoordenadas, validarVentana } from "@/lib/validation";
import type { Tables } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

export function ClienteForm({
  cliente,
  zonas,
  onClose,
  onSaved,
}: {
  cliente: Tables<"clientes"> | null;
  zonas: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = useSupabase();
  const toast = useToast();
  const [nombre, setNombre] = useState(cliente?.nombre ?? "");
  const [direccion, setDireccion] = useState(cliente?.direccion ?? "");
  const [zona, setZona] = useState(cliente?.zona ?? "");
  const [lat, setLat] = useState(cliente?.lat?.toString() ?? "");
  const [lng, setLng] = useState(cliente?.lng?.toString() ?? "");
  const [inicio, setInicio] = useState(cliente?.ventana_horario_inicio?.slice(0, 5) ?? "");
  const [fin, setFin] = useState(cliente?.ventana_horario_fin?.slice(0, 5) ?? "");
  const [activo, setActivo] = useState(cliente?.activo ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const coords = validarCoordenadas(lat, lng);
    const errs: Record<string, string> = { ...coords.errors };
    if (!nombre.trim()) errs.nombre = "El nombre es obligatorio.";
    if (!direccion.trim()) errs.direccion = "La dirección es obligatoria.";
    const ventana = validarVentana(inicio, fin);
    if (ventana) errs.ventana = ventana;
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const values = {
      nombre: nombre.trim(),
      direccion: direccion.trim(),
      zona: zona.trim() || null,
      lat: coords.lat,
      lng: coords.lng,
      ventana_horario_inicio: inicio || null,
      ventana_horario_fin: fin || null,
      activo,
    };
    setSaving(true);
    const { error } = cliente
      ? await supabase.from("clientes").update(values).eq("id", cliente.id)
      : await supabase.from("clientes").insert(values);
    setSaving(false);
    // Los CHECK de la BD se muestran como mensajes legibles en el formulario.
    if (error) return setFormError(describeDbError(error));
    toast(cliente ? "Cliente actualizado" : "Cliente creado");
    onSaved();
  }

  return (
    <Modal title={cliente ? "Editar cliente" : "Nuevo cliente"} onClose={onClose} wide>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nombre *" error={errors.nombre}>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </Field>
          <Field label="Zona">
            <Input list="zonas-existentes" value={zona} onChange={(e) => setZona(e.target.value)} />
            <datalist id="zonas-existentes">
              {zonas.map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
          </Field>
        </div>
        <Field label="Dirección *" error={errors.direccion}>
          <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Latitud" error={errors.lat} hint="Ej. -6.4833">
            <Input inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} />
          </Field>
          <Field label="Longitud" error={errors.lng} hint="Ej. -76.3667">
            <Input inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} />
          </Field>
        </div>
        {!lat.trim() && !lng.trim() && (
          <p className="rounded-lg bg-chip-warn px-3 py-2 text-[12.5px] text-chip-warn-ink">
            Sin coordenadas este cliente no podrá entrar a una ruta.
          </p>
        )}
        <div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Ventana horaria: desde (opcional)">
              <Input type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </Field>
            <Field label="Ventana horaria: hasta (opcional)">
              <Input type="time" value={fin} onChange={(e) => setFin(e.target.value)} />
            </Field>
          </div>
          {errors.ventana && (
            <span role="alert" className="mt-1 block text-[12px] text-bad">
              {errors.ventana}
            </span>
          )}
        </div>
        <Checkbox label="Cliente activo" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
        <FormError message={formError} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
