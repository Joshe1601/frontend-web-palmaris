export type Tone = "forest" | "gold" | "steel" | "ok" | "bad" | "stone";

/** Color de las polilíneas (Leaflet los necesita como valor, no como clase). */
export const TONE_HEX: Record<Tone, string> = {
  forest: "#0f3d2a",
  gold: "#b8924a",
  steel: "#5b7c99",
  ok: "#1f8a55",
  bad: "#b3382c",
  stone: "#8a928c",
};

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  kind: "depot" | "stop" | "truck" | "client";
  tone: Tone;
  /** Texto dentro del marcador (número de parada o de camión). */
  label?: string;
  /** Texto del tooltip (se inserta como texto, nunca como HTML). */
  title?: string;
  dim?: boolean;
  onClick?: () => void;
};

export type MapLine = {
  id: string;
  points: [number, number][];
  tone: Tone;
  weight?: number;
  opacity?: number;
};
