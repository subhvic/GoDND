import { expect, test } from "@playwright/test";

/**
 * The navigation rail is always expanded. On desktop that means labels are
 * always on screen and there is no collapse control; on phones, where a 178px
 * rail beside the page would halve it, the same expanded rail slides in over
 * the page from a menu button.
 */

test.describe("desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the rail shows its labels and cannot be collapsed", async ({ page }) => {
    await page.goto("/dashboard/experiences");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Bookings" })).toBeVisible();
    await expect(nav).toHaveCSS("width", "178px");
    await expect(page.getByRole("button", { name: /collapse navigation|expand navigation/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open navigation" })).toBeHidden();
  });
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the rail is a panel: opens from the menu, closes on Escape, returns focus", async ({ page }) => {
    await page.goto("/dashboard/experiences");
    const nav = page.getByRole("navigation", { name: "Main" });
    const menu = page.getByRole("button", { name: "Open navigation" });

    await expect(nav).toBeHidden();
    // The page gets the whole width.
    const cardWidth = await page.locator(".surface-card").evaluate((el) => el.getBoundingClientRect().width);
    expect(cardWidth).toBeGreaterThan(340);

    await menu.click();
    await expect(nav).toBeVisible();
    await expect(page.getByRole("button", { name: "Close navigation" })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(nav).toBeHidden();
    await expect(menu).toBeFocused();
  });

  test("following a link in the panel closes it", async ({ page }) => {
    await page.goto("/dashboard/experiences");
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Bookings" }).click();

    await expect(page).toHaveURL(/\/dashboard\/bookings/);
    await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
  });
});
