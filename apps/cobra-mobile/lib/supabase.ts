import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || ""
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ""

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase env vars")
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: null,
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
})
