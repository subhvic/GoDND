import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * How a request finds its tenant.
 *
 * Three host shapes reach this app:
 *
 *   portal.godnd.co       -> the operator dashboard (SaaS). No tenant from the
 *                            host; the tenant comes from the session.
 *   godnd.co              -> the GoDND marketplace. Cross-tenant by design.
 *   goarunachal.godnd.site-> a tenant's free subdomain site.
 *   wanderbeyond.in       -> a tenant's own custom domain.
 *
 * Subdomain resolution is a pure string operation and costs nothing. Custom
 * domains need a database lookup, which is why the result is cached: this runs
 * on every request to every tenant site, and an uncached round trip here would
 * put Supabase on the critical path of every page load.
 */

export type TenantContext =
  | { kind: "dashboard" }
  | { kind: "marketplace" }
  | { kind: "tenant"; agencyId: string; agencySlug: string; hostname: string };

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "godnd.co";
const TENANT_DOMAIN = process.env.NEXT_PUBLIC_TENANT_DOMAIN ?? "godnd.site";

/** Reserved slugs that must never resolve to a tenant site. */
const RESERVED = new Set([
  "app",
  "portal",
  "www",
  "api",
  "admin",
  "auth",
  "cdn",
  "assets",
  "static",
  "mail",
  "blog",
  "docs",
  "status",
  "support",
]);

function normalise(host: string): string {
  // Host headers carry a port in local dev, and are case-insensitive per RFC.
  return host.toLowerCase().split(":")[0].replace(/\.$/, "");
}

/**
 * Local development maps *.localhost to tenants so the multi-tenant paths are
 * exercised in dev rather than discovered in production.
 */
function devSubdomain(host: string): string | null {
  if (!host.endsWith(".localhost")) return null;
  const slug = host.slice(0, -".localhost".length);
  return slug && !RESERVED.has(slug) ? slug : null;
}

export async function resolveTenant(rawHost: string): Promise<TenantContext> {
  const host = normalise(rawHost);

  // The handoff file's browser chrome reads portal.godnd.com, so `portal` is
  // the canonical dashboard host; `app` is kept as an alias.
  if (
    host === `portal.${ROOT_DOMAIN}` ||
    host === `app.${ROOT_DOMAIN}` ||
    host === "portal.localhost" ||
    host === "app.localhost"
  ) {
    return { kind: "dashboard" };
  }

  if (host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}` || host === "localhost") {
    return { kind: "marketplace" };
  }

  const slug =
    host.endsWith(`.${TENANT_DOMAIN}`)
      ? host.slice(0, -(TENANT_DOMAIN.length + 1))
      : devSubdomain(host);

  if (slug && !slug.includes(".") && !RESERVED.has(slug)) {
    const agency = await lookupBySlug(slug);
    if (agency) return { kind: "tenant", ...agency, hostname: host };
  }

  const custom = await lookupByHostname(host);
  if (custom) return { kind: "tenant", ...custom, hostname: host };

  // An unknown host is treated as the marketplace rather than a hard 404: it is
  // almost always a misconfigured DNS record pointed at us, and a working page
  // beats an error while the operator fixes their records.
  return { kind: "marketplace" };
}

type AgencyRef = { agencyId: string; agencySlug: string };

const lookupBySlug = cached(async (slug: string): Promise<AgencyRef | null> => {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agencies")
    .select("id, slug")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  return data ? { agencyId: data.id, agencySlug: data.slug } : null;
});

const lookupByHostname = cached(async (hostname: string): Promise<AgencyRef | null> => {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agency_domains")
    .select("agency_id, agencies!inner(slug, status)")
    .eq("hostname", hostname)
    .eq("status", "active")
    .maybeSingle();

  const agency = data?.agencies as unknown as { slug: string; status: string } | undefined;
  if (!data || !agency || agency.status !== "active") return null;

  return { agencyId: data.agency_id, agencySlug: agency.slug };
});

/**
 * Small in-process TTL cache. Domain records change rarely (an operator adds a
 * domain once), but the lookup runs on every request, so a 60s window removes
 * essentially all of the load while keeping "I just added my domain" fast
 * enough to feel instant.
 */
function cached<T>(fn: (key: string) => Promise<T | null>, ttlMs = 60_000) {
  const store = new Map<string, { value: T | null; expires: number }>();

  return async (key: string): Promise<T | null> => {
    const now = Date.now();
    const hit = store.get(key);
    if (hit && hit.expires > now) return hit.value;

    const value = await fn(key);
    store.set(key, { value, expires: now + ttlMs });
    return value;
  };
}
