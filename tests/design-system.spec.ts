import { expect, test } from "@playwright/test";

/**
 * /design-system — the page documents the tokens by reading them back out of
 * the stylesheet, so its contrast table doubles as an accessibility check on
 * the tokens themselves.
 *
 * The regression this guards: the source system's muted text and white-on-fill
 * pairs sat at 2.2–3.8:1. A token edit that drops any documented pair below
 * WCAG AA, in either theme, fails here rather than in front of an operator.
 */

test.describe("design system", () => {
  test("every documented text pair clears WCAG AA in both themes", async ({ page }) => {
    await page.goto("/design-system");

    const rows = page.locator("#color table tbody tr");
    await expect(rows.first()).toContainText(/\d+\.\d{2}:1/);

    const count = await rows.count();
    expect(count).toBeGreaterThan(10);

    for (let index = 0; index < count; index += 1) {
      const row = rows.nth(index);
      const label = (await row.locator("th").textContent()) ?? `row ${index}`;
      // Both the dark and light cells must show a computed, passing ratio.
      await expect(row.locator("td").nth(1), `${label} · dark`).toContainText("AA");
      await expect(row.locator("td").nth(2), `${label} · light`).toContainText("AA");
      await expect(row, label).not.toContainText("Fails");
    }
  });

  test("the theme toggle re-skins the page and is remembered", async ({ page }) => {
    await page.goto("/design-system");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "dark");

    await page.getByRole("button", { name: "Switch to light theme" }).click();
    await expect(html).toHaveAttribute("data-theme", "light");

    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "light");
    await expect(page.getByRole("button", { name: "Switch to dark theme" })).toBeVisible();
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
