import { createClient } from "@supabase/supabase-js";

// These are public, browser-safe values (the anon key is meant to be exposed).
// Set them in .env.local (locally) and in your Vercel project settings.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Warn (rather than throw at import time, which would break the build) if the
// env vars are missing. Calls will fail with a clear network error instead.
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Missing Supabase env vars: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
  );
}

export const supabase = createClient(
  supabaseUrl ?? "https://placeholder.supabase.co",
  supabaseAnonKey ?? "placeholder-anon-key",
);

// The storage bucket where voice notes are uploaded.
export const BUCKET = "voice-notes";
