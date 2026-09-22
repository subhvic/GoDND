import { NextResponse, type NextRequest } from "next/server";

import { resolveTenant } from "@/lib/tenant/resolve";

/**
 * Host-based routing.
 *
 * Rather than putting the tenant in the URL path (/sites/goarunachal/...), the
 * host is rewritten into a route group the visitor never sees. The operator's
 * customers get clean URLs on their own domain — wanderbeyond.in/trips/meghalaya
 * — which is the whole point of a white-label site.
 *
 * Route layout:
 *   src/app/(dashboard)/...   -> app.godnd.co
 *   src/app/(marketplace)/... -> godnd.co
 *   src/app/(site)/[agency]/... -> every tenant host
 */
export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const url = request.nextUrl;

  // Domain-verification and webhook endpoints must answer on every host.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/.well-known/")) {
    return NextResponse.next();
  }

  const tenant = await resolveTenant(host);

  if (tenant.kind === "tenant") {
    const rewritten = new URL(
      `/_sites/${tenant.agencySlug}${url.pathname}${url.search}`,
      request.url,
    );
    const response = NextResponse.rewrite(rewritten);
    // Downstream server components read the tenant without re-resolving it.
    response.headers.set("x-godnd-agency-id", tenant.agencyId);
    response.headers.set("x-godnd-agency-slug", tenant.agencySlug);
    return response;
  }

  if (tenant.kind === "dashboard") {
    return NextResponse.rewrite(
      new URL(`/_dashboard${url.pathname}${url.search}`, request.url),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)",
  ],
};
