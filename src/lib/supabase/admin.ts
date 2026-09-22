import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS entirely, so it is confined to code paths
 * that have no user session to authorise against: host -> tenant resolution,
 * payment webhooks, payout generation, scheduled jobs.
 *
 * Never import this from a component or a route that a browser can reach with
 * user-supplied filters.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
