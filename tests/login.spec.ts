import { expect, test, type Page } from "@playwright/test";

/**
 * Sign-in — the handoff file's Login Flow: an email address, then a
 * six-digit code. The suite runs keyless (see playwright.config.ts), which
 * is the preview mode: nothing is emailed and the code is 123456.
 */

/**
 * React server-renders `autofocus`, so a focused field proves nothing about
 * hydration. A React fiber on the node does — and typing before it exists
 * is typing into a form whose handlers aren't attached yet.
 */
async function openLogin(page: Page, path = "/login") {
  await page.goto(path);
  await page.waitForFunction(() => {
    const input = document.querySelector("input[type=email]");
    return !!input && Object.keys(input).some((key) => key.startsWith("__reactFiber"));
  });
}

/**
 * The form's own alerts. Next mounts a route announcer with role="alert"
 * outside <main>, so a page-wide lookup would find two.
 */
const formAlert = (page: Page) => page.getByRole("main").getByRole("alert");

async function requestCode(page: Page, email = "ops@wanderbeyond.in") {
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send OTP" }).click();
  await expect(page.getByLabel("6-digit code")).toBeFocused();
}

test.describe("login — email step", () => {
  test("an address that can't receive mail is caught before anything is sent", async ({ page }) => {
    await openLogin(page);

    const email = page.getByLabel("Email address");
    await email.fill("ops@wanderbeyond");
    await page.getByRole("button", { name: "Send OTP" }).click();

    await expect(formAlert(page)).toHaveText("Invalid email address");
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(email).toBeFocused();
    // Still the email step, and the address never reached the URL.
    await expect(page).toHaveURL(/\/login$/);
  });

  test("an empty submit asks for the address", async ({ page }) => {
    await openLogin(page);
    await page.getByRole("button", { name: "Send OTP" }).click();
    await expect(formAlert(page)).toHaveText("Enter your email address");
  });

  test("the error clears as soon as the address is corrected", async ({ page }) => {
    await openLogin(page);
    await page.getByLabel("Email address").fill("ops@");
    await page.getByRole("button", { name: "Send OTP" }).click();
    await expect(formAlert(page)).toBeVisible();

    await page.getByLabel("Email address").fill("ops@wanderbeyond.in");
    await expect(formAlert(page)).toHaveCount(0);
  });
});

test.describe("login — code step", () => {
  test("names the address the code went to, and Change goes back with it kept", async ({ page }) => {
    await openLogin(page);
    await requestCode(page, "Ops@WanderBeyond.in ");

    // Normalised: trimmed and lower-cased, as Supabase would store it.
    await expect(page.getByText("Please enter the code we sent to")).toContainText("ops@wanderbeyond.in");

    await page.getByRole("button", { name: "Change email" }).click();
    await expect(page.getByLabel("Email address")).toHaveValue("ops@wanderbeyond.in");
    await expect(page.getByLabel("Email address")).toBeFocused();
  });

  test("resend stays locked while the first code is fresh", async ({ page }) => {
    await openLogin(page);
    await requestCode(page);

    const resend = page.getByRole("button", { name: /Resend OTP in \d:\d\d/ });
    await expect(resend).toBeDisabled();
  });

  test("the preview says which code to use", async ({ page }) => {
    await openLogin(page);
    await requestCode(page);
    await expect(page.getByText("123456", { exact: true })).toBeVisible();
  });

  test("a wrong code says so and keeps the digits to type over", async ({ page }) => {
    await openLogin(page);
    await requestCode(page);

    const code = page.getByLabel("6-digit code");
    // A complete code verifies itself — no button press needed.
    await code.fill("111111");

    await expect(formAlert(page)).toHaveText("Incorrect OTP");
    await expect(code).toHaveAttribute("aria-invalid", "true");
    await expect(code).toHaveValue("111111");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("a short code is refused with a reason", async ({ page }) => {
    await openLogin(page);
    await requestCode(page);

    await page.getByLabel("6-digit code").fill("123");
    await page.getByRole("button", { name: "Verify & log in" }).click();
    await expect(formAlert(page)).toHaveText("Enter the 6-digit code");
  });

  test("the right code — even pasted over a wrong one — lands on Home", async ({ page }) => {
    await openLogin(page);
    await requestCode(page);

    const code = page.getByLabel("6-digit code");
    await code.fill("111111");
    await expect(formAlert(page)).toHaveText("Incorrect OTP");

    await code.fill("123456");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
  });
});

test.describe("login — where it leads", () => {
  test("?next= returns the operator to where they were going", async ({ page }) => {
    await openLogin(page, "/login?next=%2Fdashboard%2Fbookings%3Ftab%3Dcancelled");
    await requestCode(page);
    await page.getByLabel("6-digit code").fill("123456");
    await expect(page).toHaveURL(/\/dashboard\/bookings\?tab=cancelled$/);
  });

  for (const next of ["https://evil.example", "//evil.example/dashboard", "/\\evil.example"]) {
    test(`?next=${next} can't send anyone off the portal`, async ({ page }) => {
      await openLogin(page, `/login?next=${encodeURIComponent(next)}`);
      await requestCode(page);
      await page.getByLabel("6-digit code").fill("123456");
      await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/dashboard$/);
    });
  }
});
