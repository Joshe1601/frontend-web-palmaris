import Link from "next/link";
import { cn } from "@/lib/cn";

const wrap = "flex w-max gap-0.5 rounded-[11px] bg-tab p-1";
const item = "rounded-lg px-5 py-2 text-sm font-semibold transition-colors";
const on = "bg-forest text-white";
const off = "text-ink-soft hover:bg-white/60";

/** Pestañas como enlaces (navegación por ruta). */
export function LinkTabs({
  items,
  active,
}: {
  items: { href: string; label: string }[];
  active: string;
}) {
  return (
    <div className={wrap}>
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={cn(item, active === i.href ? on : off)}>
          {i.label}
        </Link>
      ))}
    </div>
  );
}

/** Pestañas controladas por estado. */
export function StateTabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className={wrap}>
      {items.map((i) => (
        <button
          key={i.value}
          type="button"
          onClick={() => onChange(i.value)}
          className={cn(item, value === i.value ? on : off)}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}
