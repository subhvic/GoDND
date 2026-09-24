import { expect, test, type Page } from "@playwright/test";

/**
 * Add New Experience wizard — regression specs.
 *
 * The consent test below guards a bug that shipped: the policy link sits inside
 * its checkbox's <label>, so clicking through to READ the cancellation policy
 * also ticked the box AGREEING to it. That is the kind of defect a restyle
 * silently reintroduces, and an operator would never notice they had agreed.
 *
 * Steps are addressed directly by URL. The draft is seeded into sessionStorage
 * where a test needs earlier answers, so each test is independent and none has
 * to click through six forms to reach the one it cares about.
 */

const WIZARD = "/dashboard/experiences/new";
const DRAFT_KEY = "godnd:experience-draft";

/** A draft filled far enough for the later steps to render real content. */
const seededDraft = {
  draft: {
    basicInfo: {
      kind: "general",
      title: "7 Day Immersive Experience in Meghalaya",
      regions: ["meghalaya"],
      durationDays: 7,
      durationNights: 6,
      categories: ["adventure"],
      languages: ["english"],
      minAge: 16,
      maxAge: 40,
      activityTags: ["rafting"],
      foodIncluded: "breakfast_dinner",
      foodPreference: "both",
    },
    pricing: {
      basePrice: 7500,
      maxGuestsPerBooking: 4,
      pricingMode: "unit_multiply",
      tiers: {},
      couponCode: "",
    },
  },
  completed: { "basic-info": true, itinerary: true, crew: true, pricing: true },
};

async function seedDraft(page: Page) {
  await page.addInitScript(
    ([key, value]) => {
      window.sessionStorage.setItem(key as string, value as string);
    },
    [DRAFT_KEY, JSON.stringify(seededDraft)] as const,
  );
}

const stepFromUrl = (page: Page) =>
  new URL(page.url()).pathname.replace(`${WIZARD}/`, "");

test.describe("wizard validation", () => {
  test("an empty Basic Info cannot be submitted", async ({ page }) => {
    await page.goto(`${WIZARD}/basic-info`);
    await page.click("button[type=submit][form=step-basic-info]");

    await expect(page.getByText(/fields? needs? attention/)).toBeVisible();
    expect(stepFromUrl(page)).toBe("basic-info");
  });

  test("a completed Basic Info advances, and the day tabs follow the duration", async ({
    page,
  }) => {
    await page.goto(`${WIZARD}/basic-info`);
    await page.fill("input[name=title]", "Meghalaya in Seven Days");

    for (const [label, value] of [
      ["Region/State", "meghalaya"],
      ["Categories", "adventure"],
      ["Languages Spoken", "english"],
      ["Activity Tags", "rafting"],
    ]) {
      // By accessible label rather than DOM shape: a restyle may change the
      // markup around a control, but never what it is called.
      await page.getByLabel(label).first().selectOption(value);
    }
    // The itinerary derives its days from this, rather than asking again.
    await page.getByLabel("Duration (days)").selectOption("7");

    await page.click("button[type=submit][form=step-basic-info]");
    await expect(page).toHaveURL(new RegExp(`${WIZARD}/itinerary$`));

    await expect(
      page.locator('nav[aria-label="Itinerary days"] button'),
    ).toHaveCount(7);
  });
});

test.describe("support & policies", () => {
  test.beforeEach(async ({ page }) => {
    await seedDraft(page);
    await page.goto(`${WIZARD}/policies`);
  });

  const consentBoxes = (page: Page) =>
    page.locator(
      'section:has(> h3:text-is("Cancellation Policy")) input[type=checkbox], section:has(> h3:text-is("Help & Policy")) input[type=checkbox]',
    );

  test("opening a policy link does not agree to the policy", async ({ page }) => {
    const cancellation = consentBoxes(page).nth(0);
    await expect(cancellation).not.toBeChecked();

    // A link nested in a <label> inherits the label's activation behaviour.
    // Reading the policy must not consent to it.
    const [popup] = await Promise.all([
      page.waitForEvent("popup"),
      page.locator('a[href="/legal/cancellation-policy"]').click(),
    ]);

    await expect(cancellation).not.toBeChecked();

    // And it opens in a new tab, so reading a policy never costs the operator
    // the half-finished draft behind this form.
    expect(popup).not.toBeNull();
    await popup.close();

    // The control itself must still work.
    await cancellation.check();
    await expect(cancellation).toBeChecked();
  });

  test("both consents are required before continuing", async ({ page }) => {
    await page.getByLabel("What's Included?").selectOption("breakfast-partial");
    await page.getByLabel("What's Not Included?").selectOption("elephant-falls-tickets");
    await page.fill(
      "textarea[name=departureNote]",
      "Meet our captain at Guwahati airport arrivals, 7:30 AM.",
    );

    await consentBoxes(page).nth(0).check();
    await page.click("button[type=submit][form=step-policies]");
    expect(stepFromUrl(page)).toBe("policies");

    await consentBoxes(page).nth(1).check();
    await page.click("button[type=submit][form=step-policies]");
    await expect(page).toHaveURL(new RegExp(`${WIZARD}/media$`));
  });
});

test.describe("media & overview", () => {
  test.beforeEach(async ({ page }) => {
    await seedDraft(page);
    await page.goto(`${WIZARD}/media`);
  });

  test("a thumbnail must be chosen before submitting", async ({ page }) => {
    await page.click("button[type=submit][form=step-media]");
    expect(stepFromUrl(page)).toBe("media");
    await expect(page.getByText("Choose a thumbnail image")).toBeVisible();
  });

  test("the guest card previews the real draft, not placeholder copy", async ({
    page,
  }) => {
    await page.locator("[role=radio]").first().click();
    await page.fill(
      "textarea[name=summary]",
      "Seven days across Meghalaya's living root bridges and the Khasi hills.",
    );

    // The point of this panel is that an operator sees what a traveller will.
    // If it ever shows placeholder text instead, it is worse than useless.
    const card = page.locator("article").first();
    await expect(card).toContainText("7 Day Immersive Experience in Meghalaya");
    await expect(card).toContainText("7D & 6N");
    await expect(card).toContainText("Meghalaya");
    await expect(card).toContainText("7,500");
    await expect(card).toContainText("living root bridges");
  });

  test("the final action is Send for approval, and it is not covered", async ({
    page,
  }) => {
    // The sticky footer once floated over the form with nothing reserving its
    // height, leaving the last controls unclickable.
    const submit = page.locator("button[type=submit][form=step-media]");
    // Case-insensitive: the label follows the system's sentence case, and
    // what matters here is the action, not its capitalisation.
    await expect(submit).toHaveText(/Send for approval/i);
    await expect(submit).toBeInViewport();
  });
});

test.describe("draft persistence", () => {
  test("a reload does not lose what was typed", async ({ page }) => {
    await page.goto(`${WIZARD}/basic-info`);
    await page.fill("input[name=title]", "Draft survives a refresh");
    await page.getByLabel("Region/State").first().selectOption("assam");

    await page.reload();

    // Operators fill this on patchy connections; losing a part-built itinerary
    // to a dropped request is this form's worst failure.
    await expect(page.locator("input[name=title]")).toHaveValue(
      "Draft survives a refresh",
    );
    await expect(page.getByRole("listitem").filter({ hasText: "Assam" })).toBeVisible();
  });
});
