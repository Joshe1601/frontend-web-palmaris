"use client";

import { useEffect, useState } from "react";

/** Reloj local para etiquetas "hace N s" (no consulta al servidor). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
