import { expect, test, type Page } from "@playwright/test";

/**
 * Insights. Three promises worth guarding:
 *
 *   - It agrees with Home. The two pages share figures, and a reviewer
 *     clicking "See all insights" must not find a different business.
 *   - Findings come before numbers, and each names the numbers behind it.
 *   - A live experience that sold nothing stays on the table rather than
 *     dropping out of a ranking.
 */

const tile = (page: Page, label: string) => page.locator(".kpi-card", { hasText: label });

test("Home's links lead here, filed under Website", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "See all insights" }).click();
  await expect(page).toHaveURL(/\/dashboard\/insights/);
  await expect(page.getByRole("heading", { level: 1, name: "Insights" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Website");
  await expect(
    page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Insights" }),
  ).toHaveAttribute("aria-current", "page");
});

test("the headline agrees with Home's funnel for each shared period", async ({ page }) => {
  await page.goto("/dashboard/insights");
  await expect(tile(page, "Bookings made")).toContainText("87");
  await expect(tile(page, "Bookings made")).toContainText("+81% vs previous 30 days");
  await expect(page.getByText("69 in the period")).toBeVisible();

  await page.getByLabel("Period").selectOption("7d");
  await expect(tile(page, "Bookings made")).toContainText("21");
  await expect(tile(page, "Bookings made")).toContainText("+17% vs previous 7 days");

  await page.getByLabel("Period").selectOption("90d");
  await expect(tile(page, "Bookings made")).toContainText("214");
  await expect(page).toHaveURL(/period=90d/);
});

test("a period in the link opens on that period", async ({ page }) => {
  await page.goto("/dashboard/insights?period=12m");
  await expect(page.getByLabel("Period")).toHaveValue("12m");
  const chart = page.locator(".insights-chart");
  await expect(chart).toContainText("By month");
  await expect(chart.locator("table tbody tr")).toHaveCount(12);
});

test("every finding carries its evidence, and the idle experience is named", async ({ page }) => {
  await page.goto("/dashboard/insights");
  const findings = page.locator(".action-row");
  expect(await findings.count()).toBeGreaterThan(0);
  for (const finding of await findings.all()) {
    await expect(finding.locator(".action-evidence")).not.toBeEmpty();
  }
  await expect(page.locator(".action-row", { hasText: "took no bookings" })).toContainText(
    "Rafting, Camping & Cycling in Upper Assam",
  );
});

test("an experience that sold nothing stays on the table", async ({ page }) => {
  await page.goto("/dashboard/insights");
  const row = page.locator("table.data-table tbody tr", { hasText: "Rafting, Camping & Cycling in Upper Assam" });
  await expect(row).toBeVisible();
  await expect(row).toContainText("None");
});
