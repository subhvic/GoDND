import { expect, test } from "@playwright/test";

/**
 * Two things this file guards:
 *
 *   1. The pre-flight review at /dashboard/experiences/new/review.
 *      Step 7's "Review & send" routes here rather than submitting; the
 *      actual submit lives on this page and lands on the confirmation
 *      screen. Regression: the seven-step flow silently reverting to
 *      "submit on step 7", which took away the operator's last chance to
 *      catch a mistake.
 *
 *   2. The itinerary step's error handling. It used to say "1 field needs
 *      attention" with no way to tell which day and activity was the
 *      culprit — an operator with an empty activity on Day 1 and their
 *      real content on Day 2 would be stuck on Day 2 forever.
 */

const NEW = "/dashboard/experiences/new";

const FILLED_DRAFT_STATE = {
  draft: {
    basicInfo: {
      kind: "general", title: "Guarded Sikkim loop",
      regions: ["sikkim"], durationDays: 3, durationNights: 2,
      categories: ["culture-heritage"], languages: ["english"],
      minAge: 16, maxAge: 60, activityTags: ["trekking"],
      foodIncluded: "breakfast_dinner", foodPreference: "both",
    },
    itinerary: {
      days: [
        { dayNumber: 1, pickupIncluded: true, pickupLocation: "Bagdogra", pickupRegion: "", pickupTime: "10:30",
          activities: [{ id: "a1", title: "Drive to Gangtok", kind: "transfer", stoppageMin: 240, locationName: "Gangtok", comment: "", imageCount: 0 }] },
        { dayNumber: 2, pickupIncluded: false, pickupLocation: "", pickupRegion: "", pickupTime: "",
          activities: [{ id: "a2", title: "Rumtek Monastery", kind: "stop_location", stoppageMin: 120, locationName: "Rumtek", comment: "", imageCount: 0 }] },
        { dayNumber: 3, pickupIncluded: false, pickupLocation: "", pickupRegion: "", pickupTime: "",
          activities: [] },
      ],
    },
    crew: {
      tripCaptain: "dipendu-dey", coordinator: "anjali-rai",
      hasGroundCrew: false, crewMembers: [],
      onboardingStrategy: "open", maxGroupSize: 6,
    },
    pricing: {
      basePrice: 24500, maxGuestsPerBooking: 6,
      pricingMode: "unit_multiply", tiers: {}, couponCode: "",
    },
    availability: {
      availabilityMode: "selective",
      logs: [{ id: "log-1", from: "2026-03-01", to: "2026-05-31" }],
      blockAfterFullCapacity: false, blockForDays: 0, holidays: [],
    },
    policies: {
      inclusions: ["accommodation"], exclusions: ["flights"],
      departureNote: "Meet at Bagdogra arrivals, 10:30 AM.",
      accessibility: [], additionalInfo: [],
      acceptCancellationPolicy: true, acceptSupportStandards: true,
    },
    media: {
      thumbnailId: "media-01",
      summary: "A short guarded summary that references what the guest will read.",
    },
  },
  completed: { "basic-info": true, itinerary: true, crew: true, pricing: true, availability: true, policies: true, media: true },
};

test.describe("review & send", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((state) => {
      window.sessionStorage.setItem("godnd:experience-draft", state);
    }, JSON.stringify(FILLED_DRAFT_STATE));
  });

  test("summarizes every one of the seven steps, each with an Edit link", async ({ page }) => {
    await page.goto(`${NEW}/review`);

    for (const label of [
      "Basic Info",
      "Itinerary Builder",
      "Crew & Trip Capacity",
      "Pricing Strategy",
      "Availability Calendar",
      "Support & Policies",
      "Media & Overview",
    ]) {
      await expect(page.getByRole("heading", { level: 3, name: label })).toBeVisible();
    }

    // Every section links back to its step so the operator can fix in place.
    const editLinks = page.getByRole("link", { name: "Edit" });
    await expect(editLinks).toHaveCount(7);
    // The submit action is the terminal one for the whole flow.
    await expect(page.getByRole("button", { name: /Send for approval/ })).toBeEnabled();
  });

  test("blocks submission when a section is missing information", async ({ page }) => {
    // Blank out the media summary so the schema rejects it. The submit
    // button must reflect that instead of letting the operator send a
    // half-filled experience for approval.
    await page.addInitScript(() => {
      const raw = window.sessionStorage.getItem("godnd:experience-draft");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      parsed.draft.media.summary = "";
      window.sessionStorage.setItem("godnd:experience-draft", JSON.stringify(parsed));
    });

    await page.goto(`${NEW}/review`);
    await expect(
      page.getByText(/section needs? attention before you can send/i),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Send for approval/ })).toBeDisabled();
  });
});

test.describe("itinerary error surfacing", () => {
  test("names the day + activity when submit is blocked, and jumps to it", async ({ page }) => {
    // Day 1 has an activity with an empty title, Day 2 has the real
    // content the operator is looking at. The old "1 field needs attention"
    // summary gave no way to find Day 1's problem.
    await page.addInitScript(() => {
      window.sessionStorage.setItem(
        "godnd:experience-draft",
        JSON.stringify({
          draft: {
            basicInfo: {
              kind: "general", title: "Repro", regions: ["meghalaya"],
              durationDays: 3, durationNights: 2,
              categories: ["adventure"], languages: ["english"],
              minAge: 16, maxAge: 40, activityTags: ["rafting"],
              foodIncluded: "breakfast_dinner", foodPreference: "both",
            },
            itinerary: {
              days: [
                { dayNumber: 1, pickupIncluded: false, pickupLocation: "", pickupRegion: "", pickupTime: "",
                  activities: [{ id: "a1", title: "", kind: "stop_location", stoppageMin: 60, locationName: "", comment: "", imageCount: 0 }] },
                { dayNumber: 2, pickupIncluded: false, pickupLocation: "", pickupRegion: "", pickupTime: "",
                  activities: [{ id: "a2", title: "Umiam Lake", kind: "stop_location", stoppageMin: 60, locationName: "mrf", comment: "", imageCount: 0 }] },
              ],
            },
          },
          completed: { "basic-info": true },
        }),
      );
    });

    await page.goto(`${NEW}/itinerary`);
    // Land on Day 2 first, as in the reported scenario — the operator was
    // there when they hit "Next step" and got stuck.
    await page.getByRole("button", { name: /^Day 2/ }).click();
    await page.locator("button[type=submit][form=step-itinerary]").click();

    // The summary names Day 1 and Activity 1, so the operator knows exactly
    // where to look.
    await expect(page.locator("[aria-live=assertive]").first()).toHaveText(
      /Day 1, activity 1: Activity name is required/i,
    );
    // The rail marks Day 1 as needing attention.
    await expect(page.getByRole("button", { name: /Day 1.*needs attention/i })).toBeVisible();
    // The active pill has switched to Day 1 so the empty title field is
    // now visible instead of hidden behind another tab.
    await expect(page.locator(".pill-tab.active")).toHaveText(/Day 1/);
  });
});
