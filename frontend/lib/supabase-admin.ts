import { createClient } from "@supabase/supabase-js"

let supabaseAdminClient: ReturnType<typeof createClient> | null = null

export function getSupabaseAdminClient() {
  if (supabaseAdminClient) return supabaseAdminClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL env var.")
  }
  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY env var.")
  }

  supabaseAdminClient = createClient(supabaseUrl, supabaseServiceRoleKey)
  return supabaseAdminClient
}
