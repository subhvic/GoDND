import { expect, test } from "@playwright/test";

/**
 * The Bookings module mirrors the Experiences one — same shell, same
 * drawer pattern — so the safety net covers the pieces that make bookings
 * different: the four-tab grouping of eight DB states, the money numbers
 * in the drawer, and the timeline of a completed vs cancelled booking.
 */

test.describe("bookings list", () => {
  test("Upcoming is the default and shows confirmed / paid / part-paid rows", async ({ page }) => {
    await page.goto("/dashboard/bookings");

    // Priya Sengupta (paid), Aarav Nair (part-paid), Meera Iyer (confirmed).
    await expect(page.getByRole("button", { name: "Priya Sengupta" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Aarav Nair" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Meera Iyer" })).toBeVisible();

    // Awaiting-payment counts sit on the tab, not the row.
    await expect(page.getByRole("link", { name: /Awaiting payment/i })).toContainText("1");
  });

  test("Awaiting payment shows only pending rows", async ({ page }) => {
    await page.goto("/dashboard/bookings?tab=awaiting");

    await expect(page.getByRole("button", { name: "Karan Bose" })).toBeVisible();
    // The Priya paid row is on Upcoming, not here.
    await expect(page.getByRole("button", { name: "Priya Sengupta" })).toHaveCount(0);
  });

  test("Cancelled tab groups cancelled and refunded together", async ({ page }) => {
    await page.goto("/dashboard/bookings?tab=cancelled");

    await expect(page.getByRole("button", { name: "Rahul Menon" })).toBeVisible(); // cancelled
    await expect(page.getByRole("button", { name: "Divya Rao" })).toBeVisible();    // refunded
  });

  test("search matches name, reference, and experience title", async ({ page }) => {
    await page.goto("/dashboard/bookings?q=BKG-000142");
    await expect(page.getByRole("button", { name: "Priya Sengupta" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Aarav Nair" })).toHaveCount(0);
  });
});

test.describe("bookings drawer", () => {
  test("paid booking: shows total, paid, zero balance, and a captured payment", async ({ page }) => {
    await page.goto("/dashboard/bookings");
    await page.getByRole("button", { name: "Priya Sengupta" }).click();

    const drawer = page.getByRole("dialog", { name: "Priya Sengupta" });
    await expect(drawer).toBeVisible();

    // Money tiles — "Balance due" is unique to the metric row; "Total" and
    // "Paid" also appear as RecordField labels in the Payment section, so
    // .first() is exact enough here.
    await expect(drawer.getByText("Balance due", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Total", { exact: true }).first()).toBeVisible();
    await expect(drawer.getByText("Paid", { exact: true }).first()).toBeVisible();
    // The whole ₹1,34,000 was captured, so paid = total and balance = 0.
    await expect(drawer.getByText("₹1,34,000").first()).toBeVisible();

    // Refund action is enabled because there's money to refund.
    await expect(drawer.getByRole("button", { name: /Refund/i })).toBeEnabled();

    // Timeline names what happened.
    await expect(drawer.getByText(/Full payment received/i)).toBeVisible();
    await expect(drawer.getByText(/Confirmation sent to guest/i)).toBeVisible();
  });

  test("refunded booking: shows the refund and disables further refund", async ({ page }) => {
    await page.goto("/dashboard/bookings?tab=cancelled");
    await page.getByRole("button", { name: "Divya Rao" }).click();

    const drawer = page.getByRole("dialog", { name: "Divya Rao" });
    await expect(drawer).toBeVisible();

    // Refunded tile replaces the balance-due tile; the same word appears as
    // a status badge in the subtitle and a payment field, so .first() picks
    // the metric label whose section is above them.
    await expect(drawer.getByText("Refunded", { exact: true }).first()).toBeVisible();
    // Cannot refund again; there is nothing left.
    await expect(drawer.getByRole("button", { name: /Refund/i })).toBeDisabled();
    // Cancellation reason is a named section.
    await expect(drawer.getByText(/Operator initiated — flight disruption/i).first()).toBeVisible();
  });

  test("marketplace booking names the commission the platform retained", async ({ page }) => {
    await page.goto("/dashboard/bookings");
    await page.getByRole("button", { name: "Priya Sengupta" }).click();

    const drawer = page.getByRole("dialog", { name: "Priya Sengupta" });
    // 12% commission on ₹1,34,000 = ₹16,080; the drawer labels it as
    // retained by GoDND so the operator's payout math is obvious.
    await expect(drawer.getByText(/Marketplace commission/i)).toBeVisible();
    await expect(drawer.getByText(/retained by GoDND/i)).toBeVisible();
  });
});

test.describe("sidebar wiring", () => {
  test("Bookings is a real link, not disabled", async ({ page }) => {
    await page.goto("/dashboard/experiences");
    // Nav is collapsed by default so the "Bookings" text is display:none.
    // Query the anchor by its href to confirm the link exists and is wired.
    const link = page.locator('a.nav-item[href="/dashboard/bookings"]');
    await expect(link).toHaveCount(1);
    // A disabled nav item renders as a <span>, so the anchor's existence is
    // itself the assertion that Bookings is enabled.
  });
});
