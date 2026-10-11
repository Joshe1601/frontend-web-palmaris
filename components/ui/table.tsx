import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

/** Tabla con grilla CSS. `cols` debe ser una clase literal, ej. "grid-cols-[2fr_1fr_80px]". */
export function Table({
  cols,
  headers,
  children,
  empty,
}: {
  cols: string;
  headers: string[];
  children: ReactNode;
  empty?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-white px-5 pb-3 pt-1">
      <div className={cn("grid gap-3 border-b border-line py-3.5 text-xs font-semibold text-muted", cols)}>
        {headers.map((h, i) => (
          <div key={`${h}-${i}`}>{h}</div>
        ))}
      </div>
      {children}
      {empty && <div className="py-10 text-center text-[13.5px] text-muted">{empty}</div>}
    </div>
  );
}

export function Row({
  cols,
  onClick,
  children,
}: {
  cols: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "grid items-center gap-3 border-b border-row py-3.5 text-[13.5px] last:border-b-0",
        onClick && "cursor-pointer hover:bg-[#faf8f2]",
        cols,
      )}
    >
      {children}
    </div>
  );
}

export function Pager({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="mt-3 flex items-center justify-end gap-3 text-[13px] text-muted">
      <span>
        Página {page + 1} de {pages} · {total} registros
      </span>
      <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onChange(page - 1)}>
        Anterior
      </Button>
      <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => onChange(page + 1)}>
        Siguiente
      </Button>
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between rounded-lg border border-bad/30 bg-chip-bad px-4 py-3 text-[13px] text-chip-bad-ink">
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="font-semibold underline">
          Reintentar
        </button>
      )}
    </div>
  );
}
