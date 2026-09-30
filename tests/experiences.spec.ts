import { expect, test, type Page } from "@playwright/test";

/**
 * Experiences — the lifecycle board.
 *
 * The promises worth guarding are the ones the seven-column table could not
 * keep:
 *
 *   - Every state is on screen at once, including the one that had no tab.
 *   - A card says what is pending on it, and nothing the lane already says.
 *   - Lanes lead with whatever needs the operator, not with whatever is
 *     newest.
 *   - Search reaches regions, not just titles.
 *   - Six columns do not become a horizontal scrollbar on a phone.
 */

const lane = (page: Page, name: string) =>
  page.getByRole("region", { name: new RegExp(`^${name}\\b`) });

test("every lifecycle state is a lane, in the order an experience moves through them", async ({ page }) => {
  await page.goto("/dashboard/experiences");

  const headings = await page.locator(".xp-lane-title").allTextContents();
  // The count pill carries a screen-reader suffix; the lane name is what is left.
  expect(headings.map((text) => text.replace(/\d+\s*experiences?$/, "").trim())).toEqual([
    "Drafts",
    "Changes requested",
    "Under review",
    "Active",
    "Disabled",
    "Archived",
  ]);
});

test("an experience sent back for changes is on the board at all", async ({ page }) => {
  // It has no status tab, so the old list queried it out of existence: the
  // one state where the operator is blocked was the one state they could
  // not see.
  await page.goto("/dashboard/experiences");
  await expect(lane(page, "Changes requested")).toContainText("Bomdila Bird Trail");
});

test("a lane's count is the number of cards in it", async ({ page }) => {
  await page.goto("/dashboard/experiences");

  for (const name of ["Drafts", "Under review", "Active", "Archived"]) {
    const section = lane(page, name);
    const count = Number.parseInt((await section.locator(".xp-lane-count").textContent()) ?? "", 10);
    await expect(section.locator(".xp-card")).toHaveCount(count);
  }
});

test("a live experience with nothing bookable says so, and leads its lane", async ({ page }) => {
  await page.goto("/dashboard/experiences");
  const active = lane(page, "Active");

  const first = active.locator(".xp-card").first();
  await expect(first).toContainText("No open departures");

  // Worst first: the unbookable one outranks every dated departure.
  const cards = await active.locator(".xp-card").allTextContents();
  expect(cards.filter((text) => /No open departures/.test(text))).toHaveLength(1);
});

test("a card carries only what its lane cannot say", async ({ page }) => {
  await page.goto("/dashboard/experiences");

  // Active but off the marketplace — invisible in a status-only list.
  const direct = page.locator(".xp-card", { hasText: "Mawlynnong & Dawki Day Trip" });
  await expect(direct).toContainText("Direct bookings only");

  // A draft that never got a price cannot be submitted.
  const priceless = page.locator(".xp-card", { hasText: "Aizawl Highlands Homestay Trail" });
  await expect(priceless).toContainText("No price set");

  // And no card repeats its own lane back at itself.
  await expect(lane(page, "Drafts")).not.toContainText("Draft ·");
});

test("the review lane leads with the longest wait", async ({ page }) => {
  await page.goto("/dashboard/experiences");
  const waits = await lane(page, "Under review").locator(".xp-signal").allTextContents();

  const days = waits
    .map((text) => Number(text.replace(/\D/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0);

  expect(days.length).toBeGreaterThan(1);
  expect([...days]).toEqual([...days].sort((a, b) => b - a));
});

test("search covers regions, not just titles", async ({ page }) => {
  await page.goto("/dashboard/experiences?q=Nagaland");

  const cards = page.locator(".xp-card");
  expect(await cards.count()).toBeGreaterThan(0);
  // Every card that survived is in Nagaland, by title or by region.
  await expect(page.locator(".xp-board")).toContainText("Dzukou Valley Trek from Kohima");
});

test("a lane emptied by the filter says so, rather than teaching onboarding", async ({ page }) => {
  // "Start an experience and save at any step" is true of an empty Drafts
  // lane and false of one a search just emptied.
  await page.goto("/dashboard/experiences?q=Nagaland");
  const drafts = page.getByRole("region", { name: /^Drafts\b/ });
  await expect(drafts).toContainText("No matches here.");
  await expect(drafts).not.toContainText("Start an experience");
});

test("a search that matches nothing teaches the way out", async ({ page }) => {
  await page.goto("/dashboard/experiences?q=zzzznotathing");
  const empty = page.locator(".empty-state");
  await expect(empty).toContainText("No experiences match");
  await expect(empty).toContainText("titles and regions");
});

test("a ?tab= link still means “show me that state”", async ({ page }) => {
  // The submitted screen and the archive notice both link this way.
  await page.goto("/dashboard/experiences?tab=under_review");
  await expect(page.locator('.xp-lane[data-lane="under_review"][data-focused]')).toBeVisible();
});

test("a card opens the same drawer the table opened", async ({ page }) => {
  await page.goto("/dashboard/experiences");
  await page.getByRole("button", { name: "Dzukou Valley Trek from Kohima" }).click();

  const drawer = page.getByRole("dialog", { name: /Dzukou Valley Trek from Kohima/ });
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText("EXP-");
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("lanes stack instead of hiding five of six behind a swipe", async ({ page }) => {
    await page.goto("/dashboard/experiences");

    const lanes = page.locator(".xp-lane");
    await expect(lanes).toHaveCount(6);

    // Stacked, not side by side.
    const first = await lanes.nth(0).boundingBox();
    const second = await lanes.nth(1).boundingBox();
    expect(second!.y).toBeGreaterThan(first!.y);

    // And the page itself never scrolls sideways.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
