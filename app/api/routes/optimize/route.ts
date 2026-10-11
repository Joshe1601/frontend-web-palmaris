import { NextResponse } from "next/server";
import { getClientesDisponibles } from "@/lib/data/clientes-disponibles";
import { describeDbError } from "@/lib/db-errors";
import { fetchRoadRoute } from "@/lib/routing/ors";
import { planificarRuta } from "@/lib/routing/plan";
import { parseHora } from "@/lib/routing/schedule";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CLIENTES = 300;

const fail = (message: string, status: number) => NextResponse.json({ error: message }, { status });

/**
 * Genera y guarda una ruta: vecino más cercano + 2-opt (Haversine, sin APIs externas),
 * ETA por parada y persistencia atómica con la RPC `crear_ruta_con_paradas`,
 * ejecutada con la sesión del admin (nunca con service_role).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("No autenticado", 401);
  const { data: esAdmin } = await supabase.rpc("es_admin");
  if (!esAdmin) return fail("Acceso denegado", 403);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail("Cuerpo de la solicitud inválido", 400);
  }

  // --- validación de entrada -------------------------------------------------
  const clienteIds = Array.isArray(body.cliente_ids)
    ? [...new Set(body.cliente_ids.filter((x): x is string => typeof x === "string"))]
    : [];
  const choferId = body.chofer_id;
  const vehiculoId = body.vehiculo_id;
  const fecha = body.fecha;
  const zona = typeof body.zona === "string" && body.zona.trim() ? body.zona.trim() : null;
  const horaSalida = typeof body.hora_salida === "string" && body.hora_salida ? body.hora_salida : "08:00";

  if (clienteIds.length === 0) return fail("Selecciona al menos un cliente.", 422);
  if (clienteIds.length > MAX_CLIENTES) return fail(`Máximo ${MAX_CLIENTES} clientes por ruta.`, 422);
  if (!clienteIds.every((id) => UUID.test(id))) return fail("Identificador de cliente inválido.", 422);
  if (typeof choferId !== "string" || !UUID.test(choferId)) return fail("Selecciona un chofer.", 422);
  if (typeof vehiculoId !== "string" || !UUID.test(vehiculoId)) return fail("Selecciona un vehículo.", 422);
  if (typeof fecha !== "string" || !FECHA.test(fecha) || Number.isNaN(Date.parse(fecha))) {
    return fail("La fecha no es válida.", 422);
  }
  if (parseHora(horaSalida) === null) return fail("La hora de salida no es válida (HH:MM).", 422);

  // --- parámetros y datos ------------------------------------------------------
  const { data: config, error: configError } = await supabase
    .from("configuracion")
    .select("almacen_lat, almacen_lng, velocidad_promedio_kmh, tiempo_atencion_min")
    .eq("id", true)
    .maybeSingle();
  if (configError) return fail(describeDbError(configError), 500);
  if (!config || config.almacen_lat == null || config.almacen_lng == null) {
    return fail("Configura las coordenadas del almacén antes de generar rutas.", 422);
  }

  const [{ data: chofer }, { data: vehiculo }] = await Promise.all([
    supabase.from("choferes").select("id, activo").eq("id", choferId).maybeSingle(),
    supabase.from("vehiculos").select("id, activo").eq("id", vehiculoId).maybeSingle(),
  ]);
  if (!chofer?.activo) return fail("El chofer no existe o está inactivo.", 422);
  if (!vehiculo?.activo) return fail("El vehículo no existe o está inactivo.", 422);

  let disponibles;
  try {
    disponibles = await getClientesDisponibles(supabase);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "No se pudieron leer los clientes.", 500);
  }
  const porId = new Map(disponibles.map((c) => [c.id, c]));
  const noValidos = clienteIds.filter((id) => !porId.has(id));
  if (noValidos.length) {
    return fail(
      `${noValidos.length} cliente(s) ya no pueden entrar a la ruta (inactivos, sin coordenadas o sin pedidos pendientes disponibles). Actualiza la lista e inténtalo de nuevo.`,
      409,
    );
  }
  const clientes = clienteIds.map((id) => porId.get(id)!);

  // --- algoritmo ---------------------------------------------------------------
  // Trazado por calles con OpenRouteService (clave solo en el servidor). Sin clave o si falla: línea recta.
  const orsKey = process.env.OPENROUTESERVICE_API_KEY;
  const roadProvider = orsKey
    ? (puntos: Parameters<typeof fetchRoadRoute>[0]) =>
        fetchRoadRoute(puntos, { apiKey: orsKey }).catch((e: unknown) => {
          console.error("[ruteo] OpenRouteService falló:", e instanceof Error ? e.message : e);
          throw e;
        })
    : undefined;

  const plan = await planificarRuta(
    {
      depot: { lat: Number(config.almacen_lat), lng: Number(config.almacen_lng) },
      clientes: clientes.map((c) => ({ ...c, pedidoIds: c.pedidos.map((p) => p.id) })),
      speedKmh: Number(config.velocidad_promedio_kmh),
      serviceMin: config.tiempo_atencion_min,
      horaSalida,
    },
    roadProvider,
  );

  // --- persistencia: una sola transacción (RPC) con la sesión del admin ------------
  const { data: rutaId, error: rpcError } = await supabase.rpc("crear_ruta_con_paradas", {
    p_fecha: fecha,
    p_chofer_id: choferId,
    p_vehiculo_id: vehiculoId,
    // La función acepta NULL; los tipos generados no marcan los argumentos como nulables.
    p_zona: zona as string,
    p_distancia_km: plan.totalKm,
    p_tiempo_estimado_min: plan.totalMin,
    p_paradas: plan.paradas as unknown as Json,
  });
  if (rpcError) return fail(describeDbError(rpcError), 500);

  // El trazado se guarda aparte: es accesorio, y si falla la ruta sigue siendo válida (se verá en línea recta).
  let ruteo = plan.ruteo;
  if (plan.geometria && rutaId) {
    const { error: geoError } = await supabase.from("rutas").update({ geometria: plan.geometria }).eq("id", rutaId);
    if (geoError) {
      console.error("[ruteo] no se pudo guardar la geometría:", geoError.message);
      ruteo = "lineal";
    }
  }

  return NextResponse.json(
    {
      ruta_id: rutaId,
      distancia_km: plan.totalKm,
      tiempo_estimado_min: plan.totalMin,
      hora_regreso: plan.horaRegreso,
      ruteo,
      paradas: plan.paradas,
    },
    { status: 201 },
  );
}
