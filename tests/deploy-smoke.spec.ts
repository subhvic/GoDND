import http from "node:http";

import { expect, test } from "@playwright/test";

/**
 * Deploy smoke test — host-based routing.
 *
 * This exists because the first deployment returned 500 on every request. The
 * generated `*.vercel.app` hostname matched none of the configured domains, so
 * tenant resolution fell through to the custom-domain lookup, which builds the
 * Supabase service-role client and throws when its keys are absent. A throw in
 * the proxy fails the request, so the whole site was down.
 *
 * Every case below is a rule that was either broken then, or must not break
 * now. They run against a production build with no Supabase keys — see
 * playwright.config.ts for why that combination matters.
 *
 * Requests are made with node:http rather than Playwright's request fixture
 * because `Host` is a forbidden header for fetch-style clients, and the Host
 * header is the entire subject of this test.
 */

const PORT = Number(process.env.E2E_PORT ?? 3210);

function fetchWithHost(
  host: string,
  path: string,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      { host: "127.0.0.1", port: PORT, path, method: "GET", headers: { Host: host } },
      (response) => {
        let body = "";
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () =>
          resolve({ status: response.statusCode ?? 0, body }),
        );
      },
    );
    request.on("error", reject);
    request.end();
  });
}

const DEPLOYMENT_HOST = "go-dnd.vercel.app";
const MARKETPLACE_HOST = "godnd.co";
const PORTAL_HOST = "portal.godnd.co";

test.describe("host routing", () => {
  test("the deployment hostname serves every surface by path", async () => {
    // Before DNS is pointed at the project, this generated hostname is the only
    // way to open the app at all. It must reach the portal as well as the root.
    for (const path of [
      "/",
      "/dashboard/experiences",
      "/dashboard/experiences/new/basic-info",
    ]) {
      const { status } = await fetchWithHost(DEPLOYMENT_HOST, path);
      expect(status, `${DEPLOYMENT_HOST}${path}`).toBe(200);
    }
  });

  test("an unrecognised domain degrades instead of failing", async () => {
    // The regression: with no Supabase keys this threw and returned 500.
    // Someone's stale DNS record pointing at us must not produce an error page.
    const { status } = await fetchWithHost("some-unpointed-domain.example", "/");
    expect(status).toBe(200);
  });

  test("the marketplace domain cannot reach the operator portal", async () => {
    // Host isolation is the security property behind the whole routing scheme:
    // a traveller on the public marketplace must not be able to walk into the
    // operator app by typing a path.
    for (const path of ["/dashboard/experiences", "/sites/any-agency"]) {
      const { status } = await fetchWithHost(MARKETPLACE_HOST, path);
      expect(status, `${MARKETPLACE_HOST}${path}`).toBe(404);
    }
  });

  test("the marketplace domain still serves its own root", async () => {
    const { status, body } = await fetchWithHost(MARKETPLACE_HOST, "/");
    expect(status).toBe(200);
    expect(body).toContain("GoDND");
  });

  test("the root links to the portal only where it is reachable", async () => {
    // A link that 404s is worse than no link. The root page and the proxy must
    // agree about whether /dashboard can be opened on this host.
    const deployment = await fetchWithHost(DEPLOYMENT_HOST, "/");
    expect(deployment.body).toContain('href="/dashboard/experiences"');

    const marketplace = await fetchWithHost(MARKETPLACE_HOST, "/");
    expect(marketplace.body).not.toContain('href="/dashboard/experiences"');
  });

  test("the portal hostname redirects its root into the dashboard", async () => {
    const { status } = await fetchWithHost(PORTAL_HOST, "/");
    expect([301, 302, 307, 308]).toContain(status);
  });

  test("the portal hostname serves the experiences table", async () => {
    const { status, body } = await fetchWithHost(
      PORTAL_HOST,
      "/dashboard/experiences",
    );
    expect(status).toBe(200);
    expect(body).toContain("Experiences");
  });
});
