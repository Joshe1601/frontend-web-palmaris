import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const controlClass =
  "w-full rounded-lg border border-field bg-white px-2.5 py-2.5 text-[13px] text-ink outline-none transition-colors placeholder:text-stone focus:border-forest focus:ring-2 focus:ring-forest/15 disabled:bg-canvas disabled:text-muted";

export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-[11.5px] font-medium text-muted">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="mt-1 block text-[12px] text-bad">
          {error}
        </span>
      ) : (
        hint && <span className="mt-1 block text-[12px] text-muted">{hint}</span>
      )}
    </label>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClass, className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(controlClass, "pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2 text-[13px]", className)}>
      <input type="checkbox" className="size-4 accent-forest" {...rest} />
      {label}
    </label>
  );
}

/** Mensaje de error general de un formulario. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-bad/30 bg-chip-bad px-3 py-2.5 text-[13px] text-chip-bad-ink"
    >
      {message}
    </div>
  );
}
