"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Cliente de navegador estable durante la vida del componente. */
export function useSupabase() {
  const [supabase] = useState(createClient);
  return supabase;
}
