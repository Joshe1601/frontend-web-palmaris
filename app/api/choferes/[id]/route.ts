import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api/require-admin";
import { PASSWORD_MIN } from "@/lib/choferes";
import { describeDbError } from "@/lib/db-errors";
import { createServiceRoleAuthClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (message: string, status: number) => NextResponse.json({ error: message }, { status });

/** Cambia la contraseña del chofer (service_role: solo administra el usuario de Auth). */
export async function PATCH(request: Request, ctx: RouteContext<"/api/choferes/[id]">) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return fail("Chofer inválido", 400);

  const body = (await request.json().catch(() => ({}))) as { password?: unknown };
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < PASSWORD_MIN) return fail(`La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`, 422);

  const { data: chofer } = await guard.supabase.from("choferes").select("auth_user_id").eq("id", id).maybeSingle();
  if (!chofer) return fail("El chofer no existe.", 404);
  if (!chofer.auth_user_id) return fail("Este chofer no tiene usuario de acceso.", 409);

  const { error } = await createServiceRoleAuthClient().updateUserById(chofer.auth_user_id, { password });
  if (error) return fail("No se pudo cambiar la contraseña.", 500);
  return NextResponse.json({ ok: true });
}

/**
 * Elimina al chofer y su usuario de acceso. Si ya tiene rutas no se puede borrar
 * (se conserva el historial): hay que desactivarlo.
 */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/choferes/[id]">) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return fail("Chofer inválido", 400);
  const { supabase } = guard;

  const { data: chofer } = await supabase.from("choferes").select("auth_user_id").eq("id", id).maybeSingle();
  if (!chofer) return fail("El chofer no existe.", 404);

  const { count } = await supabase.from("rutas").select("id", { count: "exact", head: true }).eq("chofer_id", id);
  if (count) {
    return fail("Este chofer tiene rutas registradas y no se puede eliminar. Desmárcalo como activo para ocultarlo.", 409);
  }

  const { error: delError } = await supabase.from("choferes").delete().eq("id", id);
  if (delError) {
    return fail(delError.code === "23503" ? "El chofer tiene datos asociados; desactívalo en su lugar." : describeDbError(delError), 409);
  }

  // Borra el usuario de Auth (su perfil se elimina en cascada).
  if (chofer.auth_user_id) {
    const { error } = await createServiceRoleAuthClient().deleteUser(chofer.auth_user_id);
    if (error) {
      console.error("[choferes] no se pudo borrar el usuario de Auth:", error.message);
      return NextResponse.json({ ok: true, aviso: "El chofer se eliminó, pero su usuario de acceso quedó pendiente de borrar en Auth." });
    }
  }
  return NextResponse.json({ ok: true });
}
