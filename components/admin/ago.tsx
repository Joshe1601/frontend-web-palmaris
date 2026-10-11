"use client";

import { useNow } from "@/hooks/use-now";

export function Ago({ at }: { at: string | null | undefined }) {
  const now = useNow();
  if (!at) return <>Sin señal GPS</>;
  const s = Math.max(0, Math.round((now - new Date(at).getTime()) / 1000));
  if (s < 60) return <>Actualizado hace {s} s</>;
  if (s < 3600) return <>Actualizado hace {Math.floor(s / 60)} min</>;
  return <>Actualizado hace {Math.floor(s / 3600)} h</>;
}
