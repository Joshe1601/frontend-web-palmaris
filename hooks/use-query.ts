"use client";

import { useCallback, useEffect, useState, type DependencyList } from "react";
import { errorMessage } from "@/lib/supabase/unwrap";

type Settled<T> = { key: string; data: T | undefined; error: string | null };

/**
 * Carga datos al montar y cuando cambian `deps` (solo valores primitivos; el
 * cliente de Supabase no va en deps). `fetcher` debe lanzar si falla (usa
 * `unwrap`). `reload()` vuelve a ejecutarlo conservando el dato anterior.
 */
export function useQuery<T>(fetcher: () => PromiseLike<T>, deps: DependencyList) {
  const [tick, setTick] = useState(0);
  const [settled, setSettled] = useState<Settled<T>>({ key: "", data: undefined, error: null });
  const key = JSON.stringify([...deps, tick]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve(fetcher()).then(
      (data) => !cancelled && setSettled({ key, data, error: null }),
      (e) => !cancelled && setSettled((s) => ({ key, data: s.data, error: errorMessage(e) })),
    );
    return () => {
      cancelled = true;
    };
    // `key` resume deps + tick; `fetcher` se recrea en cada render a propósito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data: settled.data, error: settled.error, loading: settled.key !== key, reload };
}
