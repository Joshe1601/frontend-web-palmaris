"use client";

import { usePathname } from "next/navigation";
import { LinkTabs } from "@/components/ui/segmented";

const ITEMS = [
  { href: "/admin/rutas", label: "Generar ruta" },
  { href: "/admin/rutas/creadas", label: "Rutas creadas" },
  { href: "/admin/rutas/historial", label: "Historial" },
];

export function RutasTabs() {
  return <LinkTabs items={ITEMS} active={usePathname().replace(/\/$/, "")} />;
}
