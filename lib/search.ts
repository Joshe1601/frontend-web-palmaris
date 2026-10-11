/** Escapa % y _ para usarlos literalmente dentro de un ILIKE. */
export function likeTerm(q: string): string {
  return `%${q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
