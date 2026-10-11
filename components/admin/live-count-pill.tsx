"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** "GPS en vivo · N camiones": cuenta las rutas en curso y se actualiza por Realtime. */
export function LiveCountPill() {
  const [n, setN] = useState<number | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let activo = true;
    const contar = async () => {
      const { count } = await supabase
        .from("rutas")
        .select("id", { count: "exact", head: true })
        .eq("estado", "en_curso");
      if (activo) setN(count ?? 0);
    };
    contar();
    const channel = supabase
      .channel("shell-live-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "rutas" }, contar)
      .subscribe();
    return () => {
      activo = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="flex items-center gap-2 rounded-[9px] border border-line bg-white px-3 py-2 text-[13px] text-muted">
      <span className={`size-2 rounded-full ${n ? "bg-ok" : "bg-stone"}`} />
      GPS en vivo · {n ?? "…"} {n === 1 ? "camión" : "camiones"}
    </div>
  );
}
