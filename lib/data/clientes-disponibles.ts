import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";
import { fetchAll } from "./fetch-all";

export type ClienteDisponible = Pick<
  Tables<"clientes">,
  "id" | "nombre" | "direccion" | "zona" | "ventana_horario_inicio" | "ventana_horario_fin"
> & {
  lat: number;
  lng: number;
  /** Pedidos pendientes del cliente que todavía no están en una parada abierta. */
  pedidos: { id: string; peso_kg: number | null }[];
};

/**
 * Clientes que pueden entrar a una ruta: activos, con coordenadas y con al menos un pedido
 * pendiente. Sus pedidos pendientes se consolidan en UNA parada.
 *
 * Se excluyen los pedidos que ya están en una parada pendiente de una ruta pendiente/en curso:
 * el esquema no tiene un estado "asignado", y sin este filtro un segundo "Optimizar" repetiría
 * los mismos pedidos en otra ruta.
 */
export async function getClientesDisponibles(
  supabase: SupabaseClient<Database>,
): Promise<ClienteDisponible[]> {
  const [pedidos, asignados] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("pedidos")
        .select(
          "id, peso_kg, cliente_id, clientes!inner(id, nombre, direccion, zona, lat, lng, ventana_horario_inicio, ventana_horario_fin)",
        )
        .eq("estado", "pendiente")
        .eq("clientes.activo", true)
        .not("clientes.lat", "is", null)
        .not("clientes.lng", "is", null)
        .order("id")
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabase
        .from("parada_pedidos")
        .select("pedido_id, paradas!inner(estado, rutas!inner(estado))")
        .eq("paradas.estado", "pendiente")
        .in("paradas.rutas.estado", ["pendiente", "en_curso"])
        .order("pedido_id")
        .range(from, to),
    ),
  ]);

  const yaAsignados = new Set(asignados.map((a) => a.pedido_id));
  const porCliente = new Map<string, ClienteDisponible>();
  for (const p of pedidos) {
    if (yaAsignados.has(p.id)) continue;
    const c = p.clientes;
    if (c.lat == null || c.lng == null) continue;
    let entry = porCliente.get(c.id);
    if (!entry) {
      entry = { ...c, lat: c.lat, lng: c.lng, pedidos: [] };
      porCliente.set(c.id, entry);
    }
    entry.pedidos.push({ id: p.id, peso_kg: p.peso_kg });
  }
  return [...porCliente.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
