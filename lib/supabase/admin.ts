import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { SUPABASE_URL } from "./env";

/**
 * Cliente con service_role. SOLO para código de servidor (API routes) y SOLO
 * para administrar usuarios de Auth (crear/eliminar choferes). Nunca para leer
 * o escribir tablas: eso va con la sesión del admin y RLS.
 */
export function createServiceRoleAuthClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en el servidor");
  return createClient<Database>(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  }).auth.admin;
}
