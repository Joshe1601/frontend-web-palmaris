import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Verifica sesión + rol admin en una API route. Devuelve el cliente con la sesión o una respuesta de error. */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) } as const;
  const { data: esAdmin } = await supabase.rpc("es_admin");
  if (!esAdmin) return { error: NextResponse.json({ error: "Acceso denegado" }, { status: 403 }) } as const;
  return { supabase } as const;
}
