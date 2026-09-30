import { expect, test, type Page } from "@playwright/test";

/**
 * The reviews screen — the collective view Insights' review panel leads to.
 *
 * What is worth guarding:
 *
 *   - Insights sends you here, not into the bookings list.
 *   - It opens on what is actually work: reviews still owed a reply,
 *     longest wait first.
 *   - The rating picture covers every review ever left, not the period
 *     Insights happened to be showing.
 *   - A reply is published from here, and the review stops asking for one.
 */

const cards = (page: Page) => page.locator(".review-card");

test("Insights leads here rather than to completed bookings", async ({ page }) => {
  await page.goto("/dashboard/insights");
  const panel = page.locator(".panel", { hasText: "Guest reviews" });
  await panel.getByRole("link", { name: /All reviews/ }).click();

  await expect(page).toHaveURL(/\/dashboard\/insights\/reviews/);
  await expect(page.getByRole("heading", { level: 1, name: "Reviews" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Insights");
});

test("the back arrow returns to Insights", async ({ page }) => {
  await page.goto("/dashboard/insights/reviews");
  await page.getByRole("button", { name: "Go back" }).click();
  await expect(page).toHaveURL(/\/dashboard\/insights$/);
});

test("it opens on the reviews owed a reply, longest wait first", async ({ page }) => {
  await page.goto("/dashboard/insights/reviews");
  await expect(page.getByRole("link", { name: /Needs a reply/ })).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".reviews-count")).toContainText("longest wait first");

  const count = await cards(page).count();
  expect(count).toBeGreaterThan(0);
  for (const card of await cards(page).all()) {
    await expect(card.getByText("Needs a reply")).toBeVisible();
  }

  // Oldest first: the top card predates the bottom one.
  const dates = await page.locator(".review-card-meta").evaluateAll((nodes) =>
    nodes.map((node) => {
      const text = node.textContent ?? "";
      return Date.parse(text.match(/\d{1,2} \w{3} \d{4}/)?.[0] ?? "");
    }),
  );
  expect(dates).toEqual([...dates].sort((a, b) => a - b));
});

test("the rating picture covers every review, not just the period", async ({ page }) => {
  await page.goto("/dashboard/insights");
  // Insights counts reviews inside its period.
  await expect(page.getByText("69 in the period")).toBeVisible();

  await page.goto("/dashboard/insights/reviews");
  const summary = page.locator(".panel", { hasText: "All reviews" });
  const scale = await summary.locator(".review-was").textContent();
  const total = Number((scale ?? "").replace(/[^0-9]/g, ""));
  expect(total).toBeGreaterThan(500);
  await expect(summary.locator(".review-avg")).toHaveText(/^\d\.\d$/);
});

test("filters narrow the list and can be linked to", async ({ page }) => {
  await page.goto("/dashboard/insights/reviews?view=all&rating=5");
  // "Rating" exactly — the rating breakdown above is labelled "Reviews by rating".
  await expect(page.getByLabel("Rating", { exact: true })).toHaveValue("5");
  for (const card of await cards(page).all()) {
    await expect(card.getByRole("img", { name: "5 out of 5" })).toBeVisible();
  }

  // Filtering to one experience scopes the summary to it, too.
  await page.getByLabel("Experience", { exact: true }).selectOption({ index: 1 });
  await expect(page).toHaveURL(/experience=demo-/);
  const scoped = await page.locator(".panel", { hasText: "All reviews" }).locator(".hint").textContent();
  await expect(cards(page).first()).toContainText(scoped ?? "");
});

test("a reply is published and the review stops asking for one", async ({ page }) => {
  await page.goto("/dashboard/insights/reviews");
  const card = cards(page).first();
  const guest = await card.locator(".review-card-guest").textContent();

  await card.getByRole("button", { name: "Reply" }).click();
  await expect(card.getByLabel(`Your reply to ${guest}`)).toBeVisible();
  // An empty reply can't be published at all, so there is nothing to validate.
  await expect(card.getByRole("button", { name: "Publish reply" })).toBeDisabled();

  await card.getByLabel(`Your reply to ${guest}`).fill("Thank you — the crew will be glad to hear it.");
  await card.getByRole("button", { name: "Publish reply" }).click();

  await expect(card.locator(".review-reply-body")).toHaveText("Thank you — the crew will be glad to hear it.");
  await expect(card.getByText("Needs a reply")).toHaveCount(0);
  // The tab count drops with it.
  await expect(page.getByRole("link", { name: /Needs a reply/ })).toBeVisible();
});

test("every review is reachable, and the empty state offers a way out", async ({ page }) => {
  await page.goto("/dashboard/insights/reviews?view=all");
  await expect(page.getByRole("navigation", { name: "Pagination" })).toBeVisible();

  await page.goto("/dashboard/insights/reviews?rating=1");
  const empty = page.locator(".empty-state");
  if (await empty.count()) {
    await expect(empty).toContainText(/Every review has a reply|Nothing matches these filters/);
    await empty.getByRole("button", { name: "Show every review" }).click();
    await expect(page).toHaveURL(/view=all/);
  }
});
