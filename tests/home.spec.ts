import { expect, test } from "@playwright/test";

/**
 * Home — the handoff file's "Home - Ground Instance": the funnel strip, the
 * conversion graph, latest bookings and recently created experiences. Runs
 * on the preview figures (the file's own numbers for the 30-day window).
 */

test.describe("home", () => {
  test("the portal opens on Home, and only Home lights up in the nav", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();

    const home = page.locator('a.nav-item[href="/dashboard"]');
    await expect(home).toHaveAttribute("aria-current", "page");

    // /dashboard prefixes every portal path; Home must not stay lit on them.
    await page.goto("/dashboard/experiences");
    await expect(home).not.toHaveAttribute("aria-current", "page");
  });

  test("the funnel shows six figures and follows its window", async ({ page }) => {
    await page.goto("/dashboard");
    const funnel = page.getByRole("region", { name: "My experience funnel" });
    const tile = (label: string) => funnel.locator(".stat-tile", { hasText: label });

    await expect(funnel.locator(".stat-tile")).toHaveCount(6);
    await expect(tile("Reservations made")).toContainText("87");
    await expect(tile("Reservations cancelled")).toContainText("1 in 44 reservations");
    await expect(tile("Bookings cancelled")).toContainText("1 in 33 bookings");
    await expect(tile("Reviews received")).toContainText("Avg. rating 4.6");

    await funnel.getByLabel("Funnel period").selectOption("7d");
    await expect(tile("Reservations made")).toContainText("21");
    await expect(tile("Reservations made")).toContainText("vs prior 7 days");
    await expect(tile("Bookings completed")).toContainText("−15%");
  });

  test("the conversion graph switches interval, and a table carries every value", async ({ page }) => {
    await page.goto("/dashboard");
    const graph = page.getByRole("region", { name: "Conversion graph" });

    await expect(graph.locator(".recharts-surface")).toBeVisible();
    await expect(graph.getByRole("list", { name: "Legend" })).toContainText("Experiences booked");

    // The screen-reader twin of the chart: every period, both series.
    const table = graph.locator("table");
    await expect(table.locator("thead")).toContainText("Month");
    await expect(table.locator("tbody tr")).toHaveCount(7);

    await graph.getByLabel("Graph interval").selectOption("weekly");
    await expect(table.locator("thead")).toContainText("Week");
    await expect(table.locator("tbody tr")).toHaveCount(7);
  });

  test("latest bookings lists four and opens the booking drawer", async ({ page }) => {
    await page.goto("/dashboard");
    const latest = page.getByRole("region", { name: "Latest bookings" });

    await expect(latest.locator("tbody tr")).toHaveCount(4);
    // Newest first: Priya booked on 20 Mar, the latest in the fixture.
    await expect(latest.locator("tbody tr").first()).toContainText("Priya Sengupta");
    await expect(latest.locator("tbody tr").first()).toContainText("Guwahati");

    await latest.getByRole("button", { name: "Priya Sengupta" }).click();
    await expect(page.getByRole("dialog", { name: "Priya Sengupta" })).toBeVisible();

    await expect(latest.getByRole("link", { name: "See all bookings" })).toHaveAttribute(
      "href",
      "/dashboard/bookings",
    );
  });

  test("recently created experiences: newest first, drafts included, one click from the editor", async ({ page }) => {
    await page.goto("/dashboard");
    const recent = page.getByRole("region", { name: "Recently created experiences" });
    const rows = recent.locator("tbody tr");

    await expect(rows).toHaveCount(3);
    await expect(rows.first()).toContainText("Ziro Valley Music & Culture Week");
    await expect(rows.first()).toContainText("Draft");
    await expect(rows.nth(1)).toContainText("Expiring on");

    await expect(
      recent.getByRole("link", { name: "Edit Ziro Valley Music & Culture Week" }),
    ).toHaveAttribute("href", "/dashboard/experiences/demo-6/edit");

    await recent.getByRole("button", { name: "Living Root Bridges Trek" }).click();
    await expect(page.getByRole("dialog", { name: /Living Root Bridges Trek/ })).toBeVisible();
  });

  test("one drawer at a time, whichever table opened it", async ({ page }) => {
    await page.goto("/dashboard");
    await page
      .getByRole("region", { name: "Latest bookings" })
      .getByRole("button", { name: "Priya Sengupta" })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(1);

    await page
      .getByRole("region", { name: "Recently created experiences" })
      .getByRole("button", { name: "Bomdila Bird Trail" })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await expect(page.getByRole("dialog", { name: /Bomdila Bird Trail/ })).toBeVisible();
  });

  test("log out returns to the sign-in page", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: /Log out/ }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { level: 1, name: "Login" })).toBeVisible();
  });
});
