import type { DbErrorLike } from "@/lib/db-errors";
import { unwrap } from "@/lib/supabase/unwrap";

const PAGE = 1000; // tope por defecto de filas de PostgREST

/** Recorre todas las páginas de una consulta (ordénala por una columna estable). */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: DbErrorLike | null }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const rows = unwrap(await page(from, from + PAGE - 1)) ?? [];
    all.push(...rows);
    if (rows.length < PAGE) return all;
  }
}
