import { cn } from "@/lib/cn";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={cn(
        "inline-block size-4 animate-spin rounded-full border-[2.5px] border-current border-t-transparent opacity-70",
        className,
      )}
    />
  );
}
