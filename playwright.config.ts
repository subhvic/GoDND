import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3210);
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * End-to-end tests run against a PRODUCTION build with no Supabase keys.
 *
 * That combination is deliberate, and is exactly the configuration that once
 * shipped broken: `next dev` on `portal.localhost` hid a crash that only
 * appeared on a production deployment reached by its generated hostname.
 * Testing the dev server would have missed it again.
 *
 * VERCEL_ENV=production makes tenant resolution take its production branch,
 * so host isolation is exercised rather than the permissive local path.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL,
    trace: "on-first-retry",
    // Sandboxed environments ship their own Chromium rather than the one
    // `playwright install` would fetch. Set PLAYWRIGHT_CHROMIUM_PATH there;
    // leave it unset everywhere else and Playwright uses its own.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      VERCEL_ENV: "production",
      // Explicitly blank: the app must work without a database, and the smoke
      // test asserts that an unrecognised host degrades instead of throwing.
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
  },
});
