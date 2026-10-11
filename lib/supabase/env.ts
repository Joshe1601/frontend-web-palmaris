export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// Supabase renombró la "anon key" a "publishable key": se aceptan ambos nombres.
// (Cada variable se referencia por su nombre completo para que Next la inyecte en el navegador.)
export const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!;
