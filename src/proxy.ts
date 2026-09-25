import { NextResponse, type NextRequest } from "next/server";

import { isAuthConfigured, safeNextPath } from "@/lib/auth/config";
import { readSession, redirectKeepingSession } from "@/lib/supabase/proxy";
import { resolveTenant } from "@/lib/tenant/resolve";

/**
 * Host-based routing.
 *
 * This is Next's proxy (formerly the middleware convention): one function that
 * sees every request before routing, which is where a tenant has to be decided
 * because the answer lives in the Host header rather than the path.
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
export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const url = request.nextUrl;

  // Domain-verification and webhook endpoints must answer on every host.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/.well-known/")) {
    return NextResponse.next();
  }

  const tenant = await resolveTenant(host);

  // On a preview deployment every surface is reachable by path, so a reviewer
  // can open /dashboard and /sites/<slug> from one generated URL.
  if (tenant.kind === "preview") return gatePortal(request);

  if (tenant.kind === "tenant") {
    // A tenant must never reach the portal or another tenant's tree.
    if (isPortalPath(url.pathname) || url.pathname.startsWith("/sites")) {
      return new NextResponse(null, { status: 404 });
    }

    const rewritten = new URL(
      `/sites/${tenant.agencySlug}${url.pathname}${url.search}`,
      request.url,
    );
    const response = NextResponse.rewrite(rewritten);
    // Downstream server components read the tenant without re-resolving it.
    response.headers.set("x-godnd-agency-id", tenant.agencyId);
    response.headers.set("x-godnd-agency-slug", tenant.agencySlug);
    return response;
  }

  if (tenant.kind === "dashboard") {
    if (url.pathname === "/") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return gatePortal(request);
  }

  // Marketplace host: the portal (its sign-in included) and the tenant trees
  // are not addressable here.
  if (isPortalPath(url.pathname) || url.pathname.startsWith("/sites")) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.next();
}

/** The operator portal: the dashboard and its sign-in page. */
function isPortalPath(pathname: string): boolean {
  return pathname.startsWith("/dashboard") || pathname === "/login";
}

/**
 * Keeps the dashboard behind a session once auth exists.
 *
 * Signed out on /dashboard/* → /login?next=<where they were going>.
 * Signed in on /login → straight on to the dashboard.
 *
 * This is the optimistic check the Next docs describe — a cookie read plus a
 * JWT verification, no database. The real boundary is still RLS: every
 * query runs under the caller's session, so a request that slipped past
 * here would see nothing. Without Supabase keys there is no session to
 * check, and the portal stays open as a walkable preview.
 */
async function gatePortal(request: NextRequest): Promise<NextResponse> {
  const { pathname, search, searchParams } = request.nextUrl;
  const isDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const isLogin = pathname === "/login";

  if (!isAuthConfigured() || (!isDashboard && !isLogin)) return NextResponse.next();

  let session: Awaited<ReturnType<typeof readSession>>;
  try {
    session = await readSession(request);
  } catch {
    // Fail closed: if the session can't be read, the dashboard can't be
    // entered. The login page itself still renders.
    session = { response: NextResponse.next(), signedIn: false };
  }

  if (isDashboard && !session.signedIn) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    return redirectKeepingSession(login, session.response);
  }

  if (isLogin && session.signedIn) {
    const destination = safeNextPath(searchParams.get("next"));
    return redirectKeepingSession(new URL(destination, request.url), session.response);
  }

  return session.response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)",
  ],
};
