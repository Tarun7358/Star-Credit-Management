import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// Validate keys exist (check if placeholders are still present)
export const isSupabaseConfigured = 
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes("placeholder") && 
  !supabaseAnonKey.includes("placeholder");

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : "https://placeholder.supabase.co", 
  isSupabaseConfigured ? supabaseAnonKey : "placeholder"
);

// Secondary client instance configured to NEVER persist its session state in LocalStorage.
// This allows a logged-in Agency Owner to call signUp() for a new worker/telecaller
// without logging the owner out of the current dashboard session.
export const createAdminSignupClient = () => {
  return createClient(
    isSupabaseConfigured ? supabaseUrl : "https://placeholder.supabase.co",
    isSupabaseConfigured ? supabaseAnonKey : "placeholder",
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    }
  );
};
