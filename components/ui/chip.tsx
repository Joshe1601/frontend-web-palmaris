import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const tones = {
  warn: "bg-chip-warn text-chip-warn-ink",
  ok: "bg-chip-ok text-chip-ok-ink",
  bad: "bg-chip-bad text-chip-bad-ink",
  neutral: "bg-tab text-muted",
} as const;

export type ChipTone = keyof typeof tones;

export function Chip({
  tone = "neutral",
  className,
  children,
}: {
  tone?: ChipTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap rounded-xl px-2.5 py-1 text-xs font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
