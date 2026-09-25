import { expect, test } from "@playwright/test";

/**
 * The edit flow, per state.
 *
 * The drawer's Edit link now points at /dashboard/experiences/[id]/edit,
 * which fetches the row, converts the detail into a draft the wizard's
 * schemas accept, and either seeds the store + redirects into the wizard
 * or shows a dedicated "restore first" screen for archived rows.
 *
 * The state-specific banner at the top of every step is what turns the
 * same seven-step editor into six state-appropriate flows.
 */

const cases = [
  {
    id: "demo-6",
    label: "draft",
    banner: /Editing a draft/i,
    // Info tone: nothing on the marketplace yet, save at any point.
    tone: "info",
  },
  {
    id: "demo-5",
    label: "under_review",
    banner: /Under review — editing will withdraw the submission/i,
    tone: "warning",
  },
  {
    id: "demo-9",
    label: "rejected",
    banner: /Changes requested/i,
    tone: "critical",
  },
  {
    id: "demo-1",
    label: "active",
    banner: /This experience is live/i,
    tone: "info",
  },
  {
    id: "demo-7",
    label: "disabled",
    banner: /Currently disabled/i,
    tone: "info",
  },
] as const;

test.describe("edit banners", () => {
  for (const { id, label, banner } of cases) {
    test(`${label}: lands on basic-info with a state banner naming the row`, async ({ page }) => {
      await page.goto(`/dashboard/experiences/${id}/edit`);

      // Every non-archived state seeds the store and redirects into the wizard.
      await expect(page).toHaveURL(/\/new\/basic-info$/);

      // The banner is the whole point of the edit flow — six states, six
      // pieces of copy that answer the operator's question about what a
      // save does next.
      await expect(page.getByText(banner).first()).toBeVisible();

      // The wizard breadcrumb and footer speak "edit" too.
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        /Edit experience/i,
      );
      await expect(page.getByRole("link", { name: /Discard changes/i })).toBeVisible();
    });
  }

  test("archived: blocks entry and offers a Restore path instead", async ({ page }) => {
    await page.goto(`/dashboard/experiences/demo-8/edit`);
    // Deliberately does NOT redirect — archived rows never enter the wizard.
    await expect(page).toHaveURL(/\/demo-8\/edit$/);

    await expect(page.getByRole("heading", { level: 2 })).toContainText(
      /is archived and can’t be edited in place/i,
    );
    // Restore is disabled in the demo build; the button and its reason are
    // both present so the operator knows why.
    const restore = page.getByRole("button", { name: /Restore to edit/i });
    await expect(restore).toBeDisabled();
  });
});

test.describe("edit review flow", () => {
  test("review page speaks 'changes' not 'send for approval' in edit mode", async ({ page }) => {
    // Prime the store as if the operator had opened demo-1 for edit and
    // walked through to the review page. The isEditing flag is the pair
    // (experienceId, originalStatus), both set by loadForEdit().
    await page.addInitScript(() => {
      window.sessionStorage.setItem(
        "godnd:experience-draft",
        JSON.stringify({
          draft: {
            basicInfo: {
              kind: "general", title: "7 Day Immersive Experience in Meghalaya",
              regions: ["meghalaya"], durationDays: 7, durationNights: 6,
              categories: ["adventure"], languages: ["english"],
              minAge: 16, maxAge: 40, activityTags: ["rafting"],
              foodIncluded: "breakfast_dinner", foodPreference: "both",
            },
            itinerary: {
              days: [
                { dayNumber: 1, pickupIncluded: true, pickupLocation: "Guwahati", pickupRegion: "", pickupTime: "10:30",
                  activities: [{ id: "a1", title: "Drive", kind: "transfer", stoppageMin: 180, locationName: "", comment: "" }] },
              ],
            },
            crew: { tripCaptain: "dipendu-dey", coordinator: "anjali-rai", hasGroundCrew: false, crewMembers: [], onboardingStrategy: "open", maxGroupSize: 10 },
            pricing: { basePrice: 67000, maxGuestsPerBooking: 10, pricingMode: "variable", tiers: {}, couponCode: "" },
            availability: { availabilityMode: "selective", logs: [{ id: "log-1", from: "2026-05-01", to: "2026-05-31" }], blockAfterFullCapacity: false, blockForDays: 0, holidays: [] },
            policies: { inclusions: ["accommodation"], exclusions: ["flights"], departureNote: "Meet at Guwahati arrivals.", accessibility: [], additionalInfo: [], acceptCancellationPolicy: true, acceptSupportStandards: true },
            media: { thumbnailId: "media-01", summary: "Seven days across Meghalaya’s living root bridges." },
            images: [{ id: "media-01", owner: "activity:a1", name: "drive.jpg", alt: "", width: 1600, height: 1200, bytes: 300000, originalBytes: 3900000 }],
          },
          completed: { "basic-info": true, itinerary: true, crew: true, pricing: true, availability: true, policies: true, media: true },
          experienceId: "demo-1",
          originalStatus: "active",
        }),
      );
    });

    await page.goto("/dashboard/experiences/new/review");

    // The state banner rides along here too, because a live experience being
    // reviewed is still an edit-in-progress the reviewer needs to name.
    await expect(page.getByText(/This experience is live/i).first()).toBeVisible();

    // The terminal action is now Send changes for review — not Send for approval.
    await expect(
      page.getByRole("button", { name: /Send changes for review/i }),
    ).toBeVisible();
  });
});
