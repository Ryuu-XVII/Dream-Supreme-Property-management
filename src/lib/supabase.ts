import { createClient } from "@supabase/supabase-js";

// Read Supabase environment variables or fallback to defaults
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://pxupydhcrfiwggzdtzup.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
