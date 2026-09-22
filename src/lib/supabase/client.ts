"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Browser client — used for realtime enquiry chat and optimistic UI. */
export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
