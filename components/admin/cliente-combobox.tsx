"use client";

import { useEffect, useState } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { likeTerm } from "@/lib/search";
import { Input } from "@/components/ui/form";

export type ClienteOpcion = { id: string; nombre: string; zona: string | null };

/** Selector de cliente con búsqueda por nombre (solo clientes activos). */
export function ClienteCombobox({
  value,
  onChange,
}: {
  value: ClienteOpcion | null;
  onChange: (c: ClienteOpcion | null) => void;
}) {
  const supabase = useSupabase();
  const [text, setText] = useState("");
  const [opciones, setOpciones] = useState<ClienteOpcion[]>([]);

  useEffect(() => {
    if (value || text.trim().length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("clientes")
        .select("id, nombre, zona")
        .eq("activo", true)
        .ilike("nombre", likeTerm(text))
        .order("nombre")
        .limit(8);
      if (!cancelled) setOpciones(data ?? []);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [text, value, supabase]);

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-field bg-white px-2.5 py-2.5 text-[13px]">
        <span className="font-semibold">
          {value.nombre} {value.zona && <span className="font-normal text-muted">· {value.zona}</span>}
        </span>
        <button
          type="button"
          className="text-[12px] font-semibold text-forest underline"
          onClick={() => {
            onChange(null);
            setText("");
            setOpciones([]);
          }}
        >
          Cambiar
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        placeholder="Escribe al menos 2 letras del nombre…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {text.trim().length >= 2 && opciones.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-line bg-white py-1 shadow-lg">
          {opciones.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-[13px] hover:bg-canvas"
                onClick={() => onChange(o)}
              >
                {o.nombre} {o.zona && <span className="text-muted">· {o.zona}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
