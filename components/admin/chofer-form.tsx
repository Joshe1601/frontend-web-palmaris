"use client";

import { useState, type FormEvent } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { DNI_REGEX, PASSWORD_MIN, emailDeChofer } from "@/lib/choferes";
import { describeDbError } from "@/lib/db-errors";
import type { Tables } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

export function ChoferForm({
  chofer,
  onClose,
  onSaved,
}: {
  chofer: Tables<"choferes"> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = useSupabase();
  const toast = useToast();
  const [nombre, setNombre] = useState(chofer?.nombre ?? "");
  const [dni, setDni] = useState(chofer?.usuario ?? "");
  const [telefono, setTelefono] = useState(chofer?.telefono ?? "");
  const [password, setPassword] = useState("");
  const [activo, setActivo] = useState(chofer?.activo ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const errs: Record<string, string> = {};
    if (!nombre.trim()) errs.nombre = "El nombre es obligatorio.";
    if (!chofer) {
      if (!DNI_REGEX.test(dni.trim())) errs.dni = "El DNI debe tener 8 dígitos.";
      if (password.length < PASSWORD_MIN) errs.password = `Mínimo ${PASSWORD_MIN} caracteres.`;
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      if (chofer) {
        const { error } = await supabase
          .from("choferes")
          .update({ nombre: nombre.trim(), telefono: telefono.trim() || null, activo })
          .eq("id", chofer.id);
        if (error) return setFormError(describeDbError(error));
        toast("Chofer actualizado");
      } else {
        // El alta pasa por el servidor: allí (con service_role) se crea el usuario de Auth.
        const res = await fetch("/api/choferes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre, dni: dni.trim(), telefono, password }),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) return setFormError(json.error ?? "No se pudo crear el chofer.");
        toast("Chofer creado");
      }
      onSaved();
    } catch {
      setFormError("No se pudo conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={chofer ? "Editar chofer" : "Nuevo chofer"} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Nombre completo *" error={errors.nombre}>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="DNI (usuario) *"
            error={errors.dni}
            hint={chofer ? "No se puede cambiar." : `Inicia sesión como ${emailDeChofer(dni.trim() || "DNI")}`}
          >
            <Input
              inputMode="numeric"
              maxLength={8}
              value={dni}
              disabled={!!chofer}
              onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
          <Field label="Teléfono">
            <Input inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </Field>
        </div>
        {!chofer && (
          <Field label="Contraseña *" error={errors.password} hint="La usará el chofer en su app.">
            <Input
              type="text"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        )}
        {chofer && (
          <Checkbox label="Chofer activo" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
        )}
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
