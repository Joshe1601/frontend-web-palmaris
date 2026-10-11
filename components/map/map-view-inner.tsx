"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";
import { TONE_HEX, type MapLine, type MapMarker, type Tone } from "./types";

const TARAPOTO: L.LatLngExpression = [-6.4833, -76.3667];

// Clases literales para que Tailwind las detecte.
const BG: Record<Tone, string> = {
  forest: "bg-forest",
  gold: "bg-gold",
  steel: "bg-steel",
  ok: "bg-ok",
  bad: "bg-bad",
  stone: "bg-stone",
};

function markerIcon(m: MapMarker): L.DivIcon {
  const el = document.createElement("div");
  const base = "grid place-items-center border-white font-bold text-white shadow-md ";
  let size: number;
  if (m.kind === "depot") {
    size = 28;
    el.className = `${base} size-7 rounded-lg border-[3px] bg-forest text-sm`;
    el.textContent = "⌂";
  } else if (m.kind === "truck") {
    size = 34;
    el.className = `${base} relative size-[34px] rounded-full border-[3px] text-[12px] ${BG[m.tone]}`;
    const ring = document.createElement("span");
    ring.className = "absolute inset-0 -z-10 animate-ping rounded-full opacity-50 " + BG[m.tone];
    el.append(ring, document.createTextNode(m.label ?? ""));
  } else if (m.kind === "stop") {
    size = 26;
    el.className = `${base} size-[26px] rounded-full border-2 text-[11px] ${BG[m.tone]}`;
    el.textContent = m.label ?? "";
  } else {
    size = m.dim ? 12 : 18;
    el.className = `${base} rounded-full border-2 text-[9px] ${m.dim ? "size-3 opacity-70" : "size-[18px]"} ${BG[m.tone]}`;
    el.textContent = m.label ?? "";
  }
  return L.divIcon({
    html: el,
    className: "pal-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function MapViewInner({
  markers,
  lines = [],
  fitKey,
}: {
  markers: MapMarker[];
  lines?: MapLine[];
  /** Cambia este valor para re-encuadrar el mapa; mientras no cambie, el zoom del usuario se respeta. */
  fitKey: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const fitted = useRef<string | null>(null);

  useEffect(() => {
    const map = L.map(container.current!, { center: TARAPOTO, zoom: 13, zoomControl: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(container.current!);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      fitted.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    for (const l of lines) {
      if (l.points.length < 2) continue;
      L.polyline(l.points, {
        color: TONE_HEX[l.tone],
        weight: l.weight ?? 4,
        opacity: l.opacity ?? 0.85,
        lineJoin: "round",
      }).addTo(layer);
    }
    for (const m of markers) {
      const marker = L.marker([m.lat, m.lng], {
        icon: markerIcon(m),
        zIndexOffset: m.kind === "truck" ? 1000 : m.kind === "depot" ? 500 : m.dim ? 0 : 100,
        keyboard: false,
      }).addTo(layer);
      if (m.title) {
        const tip = document.createElement("span");
        tip.textContent = m.title;
        marker.bindTooltip(tip, { direction: "top", offset: [0, -8] });
      }
      if (m.onClick) marker.on("click", m.onClick);
    }

    if (fitted.current !== fitKey && markers.length) {
      const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      fitted.current = fitKey;
    }
  }, [markers, lines, fitKey]);

  return <div ref={container} className="absolute inset-0 z-0" />;
}
