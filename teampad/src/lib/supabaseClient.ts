import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

if (!isSupabaseConfigured) {
  console.warn("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY.");
} else if (import.meta.env.DEV) {
  console.info("Server on Fire");
}

export const supabase = createClient(supabaseUrl || "http://localhost", supabaseKey || "public-anon-key", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
