"use client";

import { useState, type FormEvent } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { describeDbError } from "@/lib/db-errors";
import { parseOpcionalNumero } from "@/lib/validation";
import type { Tables } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

export function VehiculoForm({
  vehiculo,
  onClose,
  onSaved,
}: {
  vehiculo: Tables<"vehiculos"> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = useSupabase();
  const toast = useToast();
  const [placa, setPlaca] = useState(vehiculo?.placa ?? "");
  const [alias, setAlias] = useState(vehiculo?.alias ?? "");
  const [capacidad, setCapacidad] = useState(vehiculo?.capacidad_kg?.toString() ?? "");
  const [activo, setActivo] = useState(vehiculo?.activo ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const cap = parseOpcionalNumero(capacidad);
    const errs: Record<string, string> = {};
    if (!placa.trim()) errs.placa = "La placa es obligatoria.";
    if (capacidad.trim() && (cap === null || cap <= 0)) errs.capacidad = "Debe ser un número mayor que 0.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const values = {
      placa: placa.trim().toUpperCase(),
      alias: alias.trim() || null,
      capacidad_kg: cap,
      activo,
    };
    setSaving(true);
    const { error } = vehiculo
      ? await supabase.from("vehiculos").update(values).eq("id", vehiculo.id)
      : await supabase.from("vehiculos").insert(values);
    setSaving(false);
    if (error) return setFormError(describeDbError(error));
    toast(vehiculo ? "Vehículo actualizado" : "Vehículo creado");
    onSaved();
  }

  return (
    <Modal title={vehiculo ? "Editar vehículo" : "Nuevo vehículo"} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Placa *" error={errors.placa}>
            <Input value={placa} onChange={(e) => setPlaca(e.target.value)} />
          </Field>
          <Field label="Alias" hint="Ej. Palmaris 01">
            <Input value={alias} onChange={(e) => setAlias(e.target.value)} />
          </Field>
        </div>
        <Field label="Capacidad (kg)" error={errors.capacidad} hint="Opcional; uso futuro.">
          <Input inputMode="decimal" value={capacidad} onChange={(e) => setCapacidad(e.target.value)} />
        </Field>
        <Checkbox label="Vehículo activo" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
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
