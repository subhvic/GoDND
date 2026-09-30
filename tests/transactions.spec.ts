import { expect, test, type Page } from "@playwright/test";

/**
 * Transactions — where the operator's money is.
 *
 * The promises worth guarding are arithmetic ones, because this is the
 * screen an operator checks against their bank statement:
 *
 *   - The four headline figures answer the four money questions, and the
 *     one that blocks payment says what blocks it.
 *   - A payout's breakdown adds up: gross − commission ± refunds = net,
 *     and its line items sum to the gross.
 *   - Settlement cycles are whole halves of a month, in India time.
 *   - An invoice is a valid tax invoice: taxable + GST = total, the split
 *     follows the place of supply, and the number is inside a financial year.
 */

const money = (text: string | null) => Number((text ?? "").replace(/[^0-9]/g, ""));
const tile = (page: Page, label: string) => page.locator(".kpi-card", { hasText: label });

test("the headline answers the four money questions", async ({ page }) => {
  await page.goto("/dashboard/transactions");
  for (const label of ["Settled to your bank", "Awaiting payout", "Due from guests", "Refunds you owe"]) {
    await expect(tile(page, label)).toBeVisible();
  }
  await expect(tile(page, "Settled to your bank")).toContainText("commission");
  await expect(tile(page, "Due from guests")).toContainText(/overdue|Nothing overdue/);
});

test("held payouts say what is holding them, and link to the fix", async ({ page }) => {
  await page.goto("/dashboard/transactions");
  const notice = page.locator(".notice", { hasText: "Payouts are on hold" });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("bank details are verified");

  await notice.getByRole("link", { name: /Add your bank details/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/settings\/financial$/);
});

test("a payout reconciles: the breakdown and the line items both add up", async ({ page }) => {
  await page.goto("/dashboard/transactions");
  await page.locator("table tbody tr").first().click();

  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();

  const rows = drawer.locator(".payout-maths dl > div");
  const gross = money(await rows.nth(0).locator("dd").textContent());
  const commission = money(await rows.nth(1).locator("dd").textContent());
  const net = money(await drawer.locator(".payout-maths .is-total dd").textContent());
  const adjustment = (await rows.count()) > 3 ? money(await rows.nth(2).locator("dd").textContent()) : 0;
  expect(net).toBe(gross - commission - adjustment);

  // The hero figure is the same number as the breakdown's total.
  expect(money(await drawer.locator(".payout-hero-value").textContent())).toBe(net);

  // And the bookings listed sum to the gross.
  const lineGross = await drawer.locator("tbody tr td:nth-child(2)").allTextContents();
  expect(lineGross.reduce((total, cell) => total + money(cell), 0)).toBe(gross);
});

test("settlement runs on whole halves of the month", async ({ page }) => {
  await page.goto("/dashboard/transactions");
  const periods = await page.locator("table tbody tr td:nth-child(2)").allTextContents();
  expect(periods.length).toBeGreaterThan(2);
  for (const period of periods.slice(0, 6)) {
    // 1st–15th, or 16th–month end.
    expect(period).toMatch(/^(1|16) \w+ \d{4} – (15|28|29|30|31) \w+ \d{4}$/);
  }
});

test("payments name who collected the money", async ({ page }) => {
  await page.goto("/dashboard/transactions?tab=payments");
  const rows = page.locator("table tbody tr");
  expect(await rows.count()).toBeGreaterThan(0);
  await expect(page.locator("table")).toContainText("GoDND");
  await expect(page.locator("table")).toContainText("You");
});

test("refunds still owed lead the list", async ({ page }) => {
  await page.goto("/dashboard/transactions?tab=refunds");
  const statuses = await page.locator("table tbody tr td:last-child").allTextContents();
  const sent = statuses.findIndex((status) => /Sent/.test(status));
  const owed = statuses.map((status, index) => (/Sent/.test(status) ? -1 : index)).filter((index) => index >= 0);
  if (sent >= 0 && owed.length > 0) expect(Math.max(...owed)).toBeLessThan(sent);
});

test("an invoice is a valid tax invoice", async ({ page }) => {
  await page.goto("/dashboard/transactions?tab=invoices");
  await page.locator("table tbody tr th a").first().click();
  await expect(page.locator(".invoice-doc")).toBeVisible();

  // Numbered inside a financial year, as GST requires.
  await expect(page.locator(".invoice-doc-meta")).toContainText(/\w+\/\d{2}-\d{2}\/\d{4}/);

  // Supplier identity comes from Settings.
  await expect(page.locator(".invoice-doc-ids")).toContainText("GSTIN");
  await expect(page.locator(".invoice-doc")).toContainText("9985");

  // The tax adds up, and is split by place of supply.
  const totals = page.locator(".invoice-doc-totals dl > div");
  const taxable = money(await totals.nth(0).locator("dd").textContent());
  const total = money(await page.locator(".invoice-doc-totals .is-total dd").textContent());
  const taxRows = await totals.count();
  let tax = 0;
  for (let index = 1; index < taxRows; index += 1) {
    const label = await totals.nth(index).locator("dt").textContent();
    if (/GST/.test(label ?? "")) tax += money(await totals.nth(index).locator("dd").textContent());
  }
  expect(taxable + tax).toBe(total);

  const split = await page.locator(".invoice-doc-totals").textContent();
  expect(/IGST/.test(split ?? "") !== /CGST/.test(split ?? "")).toBe(true);

  await expect(page.locator(".invoice-doc-words")).toContainText(/Rupees/);
});

test("the period switch compares like with like", async ({ page }) => {
  await page.goto("/dashboard/transactions?period=fy");
  await expect(page.getByLabel("Period")).toHaveValue("fy");
  await expect(tile(page, "Settled to your bank")).toContainText("same point last year");
});
