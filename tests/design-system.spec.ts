import { expect, test } from "@playwright/test";

/**
 * /design-system — the page documents the tokens by reading them back out of
 * the stylesheet, so its contrast table doubles as an accessibility check on
 * the tokens themselves.
 *
 * The regression this guards: the source system's muted text and white-on-fill
 * pairs sat below 4.5:1. A token edit that drops any documented pair below
 * WCAG AA fails here rather than in front of an operator.
 */

test.describe("design system", () => {
  test("every documented text pair clears WCAG AA", async ({ page }) => {
    await page.goto("/design-system");

    const rows = page.locator("#color table tbody tr");
    await expect(rows.first()).toContainText(/\d+\.\d{2}:1/);

    const count = await rows.count();
    expect(count).toBeGreaterThan(10);

    for (let index = 0; index < count; index += 1) {
      const row = rows.nth(index);
      const label = (await row.locator("th").textContent()) ?? `row ${index}`;
      // The ratio cell must show a computed, passing ratio.
      await expect(row.locator("td").nth(1), label).toContainText("AA");
      await expect(row, label).not.toContainText("Fails");
    }
  });

  test("the product is light only, whatever the OS prefers", async ({ browser }) => {
    // Light is the one theme. A dark OS setting must not flip any surface,
    // and no theme control should be left behind to suggest otherwise.
    const context = await browser.newContext({ colorScheme: "dark" });
    const page = await context.newPage();
    await page.goto("/design-system");

    const canvas = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--canvas").trim().toLowerCase(),
    );
    expect(canvas).toBe("#f5f7fb");
    await expect(page.getByRole("button", { name: /theme/i })).toHaveCount(0);
    await context.close();
  });

  test("the record drawer opens, and Escape closes it", async ({ page }) => {
    await page.goto("/design-system#c-overlays");
    await page.getByRole("button", { name: "Open record drawer" }).click();

    const drawer = page.getByRole("dialog", { name: /7 Day Immersive Experience/ });
    await expect(drawer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });
});
