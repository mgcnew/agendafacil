import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Client Supabase com a service-role key — IGNORA RLS. Usar SOMENTE no servidor
 * (webhooks, server actions de billing) e nunca expor a chave ao navegador.
 * SUPABASE_SERVICE_ROLE_KEY é secreta (env, sem prefixo NEXT_PUBLIC).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
