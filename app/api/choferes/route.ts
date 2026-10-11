import { NextResponse } from "next/server";
import { describeDbError } from "@/lib/db-errors";
import { DNI_REGEX, PASSWORD_MIN, emailDeChofer } from "@/lib/choferes";
import { createServiceRoleAuthClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Body = { nombre?: unknown; dni?: unknown; telefono?: unknown; password?: unknown };

const error = (message: string, status: number) => NextResponse.json({ error: message }, { status });

/**
 * Alta de chofer: crea el usuario en Auth (service_role, única operación que lo usa),
 * y luego inserta `perfiles` y `choferes` con la sesión del admin (RLS).
 * Si algo falla después de crear el usuario de Auth, lo elimina (compensación).
 */
export async function POST(request: Request) {
  // El proxy ya filtra, pero esta ruta usa service_role: se verifica de nuevo aquí.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return error("No autenticado", 401);
  const { data: esAdmin } = await supabase.rpc("es_admin");
  if (!esAdmin) return error("Acceso denegado", 403);

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return error("Cuerpo de la solicitud inválido", 400);
  }

  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  const dni = typeof body.dni === "string" ? body.dni.trim() : "";
  const telefono = typeof body.telefono === "string" ? body.telefono.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!nombre) return error("El nombre es obligatorio.", 422);
  if (!DNI_REGEX.test(dni)) return error("El DNI debe tener 8 dígitos.", 422);
  if (password.length < PASSWORD_MIN) {
    return error(`La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`, 422);
  }

  const { data: existente } = await supabase
    .from("choferes")
    .select("id")
    .eq("usuario", dni)
    .maybeSingle();
  if (existente) return error("Ya existe un chofer con ese DNI.", 409);

  const authAdmin = createServiceRoleAuthClient();
  const { data: creado, error: authError } = await authAdmin.createUser({
    email: emailDeChofer(dni),
    password,
    email_confirm: true,
    user_metadata: { nombre, dni },
  });
  if (authError || !creado.user) {
    const yaExiste = authError?.status === 422 || /already|registered/i.test(authError?.message ?? "");
    return error(
      yaExiste ? "Ya existe un usuario con ese DNI." : "No se pudo crear el usuario de acceso.",
      yaExiste ? 409 : 500,
    );
  }
  const authUserId = creado.user.id;
  const deshacer = () => authAdmin.deleteUser(authUserId);

  const { error: perfilError } = await supabase
    .from("perfiles")
    .insert({ id: authUserId, rol: "chofer", nombre });
  if (perfilError) {
    await deshacer();
    return error(describeDbError(perfilError), 500);
  }

  const { data: chofer, error: choferError } = await supabase
    .from("choferes")
    .insert({ nombre, usuario: dni, telefono: telefono || null, auth_user_id: authUserId })
    .select()
    .single();
  if (choferError) {
    await deshacer(); // borra también el perfil (on delete cascade)
    return error(describeDbError(choferError), choferError.code === "23505" ? 409 : 500);
  }

  return NextResponse.json({ chofer }, { status: 201 });
}
