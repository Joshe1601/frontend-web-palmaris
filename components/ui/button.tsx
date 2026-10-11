import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

const variants = {
  primary: "bg-forest text-white hover:bg-forest-deep",
  gold: "bg-gold text-ink hover:bg-gold-light",
  outline: "border border-field bg-white text-ink hover:bg-canvas",
  ghost: "text-forest hover:bg-tab",
  danger: "bg-bad text-white hover:opacity-90",
} as const;

const sizes = {
  md: "px-4 py-2.5 text-sm",
  lg: "px-4 py-3.5 text-[15px]",
  sm: "px-3 py-1.5 text-[13px]",
} as const;

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: Props) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[10px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading && <Spinner className="size-4 text-current" />}
      {children}
    </button>
  );
}
