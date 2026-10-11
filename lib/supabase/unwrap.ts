import { describeDbError, type DbErrorLike } from "@/lib/db-errors";

/** Devuelve `data` o lanza un Error con mensaje legible si la consulta falló. */
export function unwrap<T>(res: { data: T; error: DbErrorLike | null }): T {
  if (res.error) throw new Error(describeDbError(res.error));
  return res.data;
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Ocurrió un error inesperado.";
}
