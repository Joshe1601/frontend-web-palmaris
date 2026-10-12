"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";

const TARAPOTO: L.LatLngExpression = [-6.4833, -76.3667];

function pinIcon() {
  const el = document.createElement("div");
  el.className =
    "grid size-8 -translate-y-0 place-items-center rounded-full border-[3px] border-white bg-bad text-sm text-white shadow-lg ring-4 ring-bad/25";
  el.textContent = "●";
  return L.divIcon({ html: el, className: "pal-marker", iconSize: [32, 32], iconAnchor: [16, 16] });
}

export type PickerProps = {
  lat: number | null;
  lng: number | null;
  /** Punto de referencia donde centrar el mapa si aún no hay coordenadas (p. ej. el almacén). */
  centro?: { lat: number; lng: number } | null;
  onChange: (lat: number, lng: number) => void;
};

/** Mapa con un pin: clic para colocarlo, arrastrar para ajustarlo. */
export default function LocationPickerInner({ lat, lng, centro, onChange }: PickerProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const start: L.LatLngExpression = centro ? [centro.lat, centro.lng] : TARAPOTO;
    const map = L.map(container.current!, { center: start, zoom: 14 });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    mapRef.current = map;

    const place = (latlng: L.LatLng) => {
      if (!markerRef.current) {
        const m = L.marker(latlng, { draggable: true, icon: pinIcon(), keyboard: false }).addTo(map);
        m.on("dragend", () => {
          const p = m.getLatLng();
          onChangeRef.current(p.lat, p.lng);
        });
        markerRef.current = m;
      } else {
        markerRef.current.setLatLng(latlng);
      }
      onChangeRef.current(latlng.lat, latlng.lng);
    };
    map.on("click", (e: L.LeafletMouseEvent) => place(e.latlng));

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(container.current!);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // El centro inicial solo se usa al crear el mapa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincroniza el pin cuando las coordenadas cambian desde los campos de texto.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (lat == null || lng == null) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const ll = L.latLng(lat, lng);
    if (!markerRef.current) {
      const m = L.marker(ll, { draggable: true, icon: pinIcon(), keyboard: false }).addTo(map);
      m.on("dragend", () => {
        const p = m.getLatLng();
        onChangeRef.current(p.lat, p.lng);
      });
      markerRef.current = m;
      map.setView(ll, Math.max(map.getZoom(), 17));
    } else if (!markerRef.current.getLatLng().equals(ll, 1e-7)) {
      markerRef.current.setLatLng(ll);
      if (!map.getBounds().contains(ll)) map.panTo(ll);
    }
  }, [lat, lng]);

  return <div ref={container} className="absolute inset-0 z-0 cursor-crosshair" />;
}
