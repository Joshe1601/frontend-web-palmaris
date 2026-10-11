import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";

const LOGIN = "/admin/login";
const DENEGADO = "/admin/acceso-denegado";

/**
 * Protege /admin y las API del admin:
 *  - sin sesión  -> login (o 401 en /api)
 *  - sin rol admin -> acceso denegado (o 403 en /api)
 * Las políticas RLS siguen siendo la barrera real de los datos.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const esApi = pathname.startsWith("/api/");

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Redirige/responde conservando las cookies de sesión refrescadas.
  const conCookies = (res: NextResponse) => {
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };
  const irA = (path: string, next?: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = next ? `?next=${encodeURIComponent(next)}` : "";
    return conCookies(NextResponse.redirect(url));
  };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (esApi) return conCookies(NextResponse.json({ error: "No autenticado" }, { status: 401 }));
    if (pathname === LOGIN) return response;
    return irA(LOGIN, pathname + request.nextUrl.search);
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();
  const esAdmin = perfil?.rol === "admin";

  if (esApi) {
    return esAdmin
      ? response
      : conCookies(NextResponse.json({ error: "Acceso denegado" }, { status: 403 }));
  }
  if (!esAdmin) return pathname === DENEGADO ? response : irA(DENEGADO);
  if (pathname === LOGIN || pathname === DENEGADO) return irA("/admin");
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/routes/:path*", "/api/choferes/:path*"],
};
