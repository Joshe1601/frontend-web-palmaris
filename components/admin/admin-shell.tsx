"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import { iniciales } from "@/lib/format";
import { ToastProvider } from "@/components/ui/toast";
import { SignOutButton } from "./sign-out-button";
import { LiveCountPill } from "./live-count-pill";

const NAV = [
  { href: "/admin", icon: "⌂", label: "Inicio", title: "Inicio", sub: "Resumen de la operación de hoy." },
  { href: "/admin/rutas", icon: "⇄", label: "Rutas", title: "Rutas", sub: "Genera y asigna las rutas de reparto de forma rápida y optimizada." },
  { href: "/admin/monitoreo", icon: "◉", label: "Monitoreo", title: "Monitoreo en vivo", sub: "Ubicación de cada camión transmitida por la app del chofer." },
  { href: "/admin/clientes", icon: "☰", label: "Clientes", title: "Clientes", sub: "Directorio de clientes y su ubicación de entrega." },
  { href: "/admin/pedidos", icon: "▦", label: "Pedidos", title: "Pedidos", sub: "Pedidos por cliente y estado." },
  { href: "/admin/flota", icon: "▤", label: "Choferes y vehículos", title: "Choferes y vehículos", sub: "Personal y unidades disponibles para asignar rutas." },
  { href: "/admin/configuracion", icon: "⚙", label: "Configuración", title: "Configuración", sub: "Almacén y parámetros de cálculo de rutas." },
];

function activo(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

// usePathname() es dato de la petición: va en componentes pequeños dentro de <Suspense>
// para que el resto del panel siga formando parte del shell estático.
function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="mt-2 flex flex-col gap-1">
      {NAV.map((n) => {
        const on = activo(pathname, n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "flex items-center gap-3 rounded-[9px] px-3 py-[11px] text-[14.5px] font-medium transition-colors hover:bg-white/10",
              on ? "bg-white/10 text-white shadow-[inset_3px_0_0_#c9a55e]" : "text-[#c9d3c7]",
            )}
          >
            <span className="w-[18px] text-center text-[15px]">{n.icon}</span>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

function PageTitle() {
  const pathname = usePathname();
  const current = NAV.find((n) => activo(pathname, n.href)) ?? NAV[0]!;
  return (
    <div className="flex-1">
      <div className="text-2xl font-bold tracking-tight">{current.title}</div>
      <div className="mt-0.5 text-[13.5px] text-muted">{current.sub}</div>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const [nombre, setNombre] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: perfil } = await supabase
        .from("perfiles")
        .select("nombre")
        .eq("id", data.user.id)
        .maybeSingle();
      setNombre(perfil?.nombre ?? data.user.email ?? "Administrador");
    });
  }, []);

  return (
    <ToastProvider>
      <div className="flex h-screen min-w-[1200px] overflow-hidden bg-canvas">
        <aside className="flex w-[216px] flex-none flex-col bg-forest-deep px-3 py-5 text-[#e9e4d3]">
          <div className="px-2 pb-4">
            <Image
              src="/brand/logo.png"
              alt="Grupo Palmaris"
              width={1280}
              height={853}
              priority
              className="block w-full mix-blend-screen grayscale invert"
            />
          </div>
          <Suspense fallback={<nav className="mt-2" />}>
            <NavLinks />
          </Suspense>
          <div className="mt-auto border-t border-white/10 p-3 text-[11.5px] leading-normal text-[#b9c4b8]">
            Grupo Palmaris
            <br />
            Tarapoto, San Martín
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex flex-none items-center gap-4 border-b border-line bg-panel px-7 py-4">
            <Suspense fallback={<div className="flex-1" />}>
              <PageTitle />
            </Suspense>
            <LiveCountPill />
            <div className="flex items-center gap-2.5 border-l border-line pl-4">
              <div className="grid size-[38px] place-items-center rounded-full bg-forest text-sm font-semibold text-white">
                {nombre ? iniciales(nombre) : "…"}
              </div>
              <div>
                <div className="text-[13.5px] font-semibold">{nombre ?? "Cargando…"}</div>
                <div className="text-xs text-muted">Administrador</div>
              </div>
              <SignOutButton />
            </div>
          </header>
          <div className="relative min-h-0 flex-1">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
