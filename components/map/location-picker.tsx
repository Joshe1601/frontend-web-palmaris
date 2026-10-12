"use client";

import dynamic from "next/dynamic";
import type { PickerProps } from "./location-picker-inner";

// Leaflet toca `window`: solo se carga en el navegador.
const Inner = dynamic(() => import("./location-picker-inner"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 grid place-items-center bg-tab text-[13px] text-muted">Cargando mapa…</div>,
});

export function LocationPicker(props: PickerProps) {
  return (
    <div className="relative isolate h-64 overflow-hidden rounded-lg border border-field">
      <Inner {...props} />
    </div>
  );
}
