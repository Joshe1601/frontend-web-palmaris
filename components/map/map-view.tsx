"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/cn";
import type { MapLine, MapMarker } from "./types";

// Leaflet toca `window`: solo se carga en el navegador.
const Inner = dynamic(() => import("./map-view-inner"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center bg-tab text-[13px] text-muted">
      Cargando mapa…
    </div>
  ),
});

export function MapView({
  markers,
  lines,
  fitKey,
  className,
  children,
}: {
  markers: MapMarker[];
  lines?: MapLine[];
  fitKey: string;
  className?: string;
  /** Superposiciones (leyendas, tarjetas) por encima del mapa. */
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("relative isolate overflow-hidden", className)}>
      <Inner markers={markers} lines={lines} fitKey={fitKey} />
      {children}
    </div>
  );
}
