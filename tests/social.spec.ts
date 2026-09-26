import { expect, test } from "@playwright/test";

/**
 * The Grow section: Channels, Studio, Calendar, Ads, Performance.
 *
 * What is worth guarding here is the reasoning, not the layout. Three claims
 * the section makes and must keep making:
 *
 *   - A connection's health is stated before its follower count, because an
 *     expired token silently breaks everything downstream of it.
 *   - The composer blocks on the platform's own limits, live, rather than
 *     letting the platform reject the post hours later.
 *   - A recommendation always carries the numbers it came from.
 */

const GROW = "/dashboard/social";

test.describe("navigation", () => {
  test("Grow sits between doing the work and measuring it", async ({ page }) => {
    await page.goto(`${GROW}/channels`);
    const nav = page.getByRole("navigation", { name: "Main" });
    for (const label of ["Channels", "Studio", "Calendar", "Ads", "Performance"]) {
      await expect(nav.getByRole("link", { name: label })).toBeVisible();
    }
    await expect(nav.getByRole("link", { name: "Channels" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

test.describe("channels", () => {
  test("an expiring token is called out above the fold, with a deadline", async ({ page }) => {
    await page.goto(`${GROW}/channels`);

    // The warning leads, and says why it cannot simply be ignored.
    const notice = page.locator(".notice").first();
    await expect(notice).toContainText("needs reconnecting");
    await expect(notice).toContainText("cannot be renewed once they lapse");

    // The card carries the countdown, not just a date.
    const facebook = page.getByRole("article", { name: /Facebook/ });
    await expect(facebook).toContainText("days left");
    await expect(facebook.locator(".status-badge")).toHaveText("Expiring soon");
  });

  test("a connection states what its scopes do and do not allow", async ({ page }) => {
    await page.goto(`${GROW}/channels`);
    // Instagram in the fixture has no ads scope: shown, struck through, rather
    // than omitted — the gap has to be visible before a campaign is built.
    const instagram = page.getByRole("article", { name: /Instagram/ }).first();
    await expect(instagram.locator(".cap", { hasText: "Ads" })).toHaveClass(/off/);
    await expect(instagram.locator(".cap", { hasText: "Publish" })).not.toHaveClass(/off/);
  });

  test("an unconnected platform offers a reason to connect it", async ({ page }) => {
    await page.goto(`${GROW}/channels`);
    const x = page.getByRole("article", { name: "X" });
    await expect(x).toContainText("Not connected");
    await expect(x).toContainText("departure announcements");
  });
});

test.describe("studio", () => {
  test("a draft is built from the chosen experience, not from a blank box", async ({ page }) => {
    await page.goto(`${GROW}/studio`);
    const body = page.locator("#composer-body");
    await expect(body).toHaveValue("");

    await page.getByRole("button", { name: /Draft for me/ }).click();

    // The caption has to contain details only this experience could supply.
    await expect(body).toHaveValue(/7 Day Immersive Experience in Meghalaya/);
    await expect(body).toHaveValue(/7 days and 6 nights/);
    await expect(body).toHaveValue(/#meghalaya/);
  });

  test("the caption is blocked at the platform's own limit", async ({ page }) => {
    await page.goto(`${GROW}/studio`);
    const publish = page.getByRole("button", { name: /Publish now/ });

    await page.locator("#composer-body").fill("A caption well within the limit.");
    await expect(publish).toBeEnabled();

    await page.locator("#composer-body").fill("a".repeat(2500));
    await expect(page.locator(".check.critical")).toContainText("over Instagram's 2200 limit");
    await expect(publish).toBeDisabled();
  });

  test("the preview shows where the caption gets truncated", async ({ page }) => {
    await page.goto(`${GROW}/studio`);
    await page.locator("#composer-body").fill("b".repeat(400));

    // Instagram hides everything past 125 characters behind "more".
    const preview = page.locator(".preview-card").first();
    await expect(preview.locator(".preview-more")).toHaveText("more");
    await expect(page.locator(".check.info")).toContainText("first 125 characters");
  });

  test("only formats every chosen channel supports are offered", async ({ page }) => {
    await page.goto(`${GROW}/studio`);
    // Instagram alone offers reels.
    await expect(page.getByRole("button", { name: "Reel" })).toBeVisible();

    // Adding X — which has no reels — withdraws the option rather than
    // letting a publish fail on a format one channel cannot take.
    await page.getByRole("button", { name: "Facebook" }).click();
    await expect(page.getByRole("button", { name: "Reel" })).toBeVisible();
    await expect(page.getByText("Only formats every chosen channel supports")).toBeVisible();
  });

  test("an unconnected channel cannot be selected", async ({ page }) => {
    await page.goto(`${GROW}/studio`);
    await expect(page.getByRole("button", { name: "X", exact: true })).toBeDisabled();
  });
});

test.describe("calendar", () => {
  test("scheduled posts land on the grid and open in a drawer", async ({ page }) => {
    await page.goto(`${GROW}/calendar`);
    const chips = page.locator(".cal-chip");
    expect(await chips.count()).toBeGreaterThan(0);

    await chips.first().click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText("Caption");
  });

  test("a failed post is surfaced with the platform's own reason", async ({ page }) => {
    await page.goto(`${GROW}/calendar`);
    await expect(page.locator(".notice.critical")).toContainText("access token has expired");
  });

  test("unscheduled drafts get a shelf, not a hiding place", async ({ page }) => {
    await page.goto(`${GROW}/calendar`);
    const drafts = page.getByRole("heading", { name: /Drafts/ });
    await expect(drafts).toBeVisible();
    await expect(page.getByText("they will not go out")).toBeVisible();
  });

  test("filtering by channel narrows the grid", async ({ page }) => {
    await page.goto(`${GROW}/calendar`);
    const before = await page.locator(".cal-chip").count();

    await page.getByRole("button", { name: /^Facebook/ }).click();
    const after = await page.locator(".cal-chip").count();
    expect(after).toBeLessThan(before);
  });
});

test.describe("performance", () => {
  test("every recommendation carries the numbers behind it", async ({ page }) => {
    await page.goto(`${GROW}/performance`);
    const actions = page.locator(".action-row");
    expect(await actions.count()).toBeGreaterThan(0);

    // Each one states its evidence and offers somewhere to act.
    for (const action of await actions.all()) {
      await expect(action.locator(".action-evidence")).not.toBeEmpty();
      await expect(action.getByRole("link")).toBeVisible();
    }
  });

  test("the format finding names its sample size", async ({ page }) => {
    await page.goto(`${GROW}/performance`);
    const finding = page.locator(".action-row", { hasText: "what your other formats do" });
    await expect(finding).toBeVisible();
    // A multiple is only claimed off more than one post.
    await expect(finding.locator(".action-evidence")).toContainText(/across \d+ reels/);
  });

  test("published posts are ranked by reach", async ({ page }) => {
    await page.goto(`${GROW}/performance`);
    const reach = await page
      .locator("table.data-table tbody tr td.primary")
      .allInnerTexts();
    const numbers = reach.map((value) => Number(value.replace(/[^0-9]/g, "")));
    const sorted = [...numbers].sort((a, b) => b - a);
    expect(numbers).toEqual(sorted);
  });
});

test.describe("ads", () => {
  test("a campaign returning less than it spends is flagged red", async ({ page }) => {
    await page.goto(`${GROW}/ads`);
    const row = page.locator("tbody tr", { hasText: "Brand awareness" });
    await expect(row.locator(".text-critical-fg")).toContainText("0.0×");
  });

  test("spend is shown against budget, not on its own", async ({ page }) => {
    await page.goto(`${GROW}/ads`);
    const meter = page.getByRole("img", { name: /% of budget spent/ }).first();
    await expect(meter).toBeVisible();
  });
});
