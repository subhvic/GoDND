import { expect, test } from "@playwright/test";

/**
 * The screens that bookend the seven-step wizard.
 *
 * /dashboard/experiences/new used to redirect straight into basic-info; now
 * it frames the flow first and picks up an in-progress draft.
 * /dashboard/experiences/new/submitted used to not exist — the wizard would
 * silently push into the Under Review list. These tests guard both loops
 * against regressing back to the old, contextless behaviour.
 */

const INTRO = "/dashboard/experiences/new";
const SUBMITTED = "/dashboard/experiences/new/submitted";

test.describe("intro screen", () => {
  test("no draft: leads with a single Start CTA and lists all seven steps", async ({ page }) => {
    await page.goto(INTRO);

    // Names every one of the seven steps that follow. If a step is added or
    // renamed and forgotten here, this row goes missing and the test fails.
    for (const label of [
      "Basic Info",
      "Itinerary Builder",
      "Crew & Trip Capacity",
      "Pricing Strategy",
      "Availability Calendar",
      "Support & Policies",
      "Media & Overview",
    ]) {
      await expect(page.getByRole("heading", { name: label, level: 4 })).toBeVisible();
    }

    // Fresh visitor: one CTA that starts the wizard. No "Continue" affordance.
    const start = page.getByRole("link", { name: /Start with Basic Info/i });
    await expect(start).toBeVisible();
    await expect(start).toHaveAttribute("href", /\/basic-info$/);
    await expect(page.getByRole("link", { name: /Continue on/i })).toHaveCount(0);
  });

  test("draft in progress: replaces Start with Continue on the first unfinished step", async ({ page }) => {
    // Seed a draft that has completed basic-info + itinerary + crew, so the
    // next step is pricing. The wizard reads its state out of sessionStorage,
    // and so does the intro screen.
    await page.addInitScript(() => {
      window.sessionStorage.setItem(
        "godnd:experience-draft",
        JSON.stringify({
          draft: {
            basicInfo: { title: "5-day Sikkim monastery loop" },
          },
          completed: { "basic-info": true, itinerary: true, crew: true },
          experienceId: null,
        }),
      );
    });

    await page.goto(INTRO);

    // The banner names the draft and the next step.
    await expect(page.getByText("5-day Sikkim monastery loop")).toBeVisible();
    const cont = page.getByRole("link", { name: /Continue on Pricing Strategy/i });
    await expect(cont).toBeVisible();
    await expect(cont).toHaveAttribute("href", /\/pricing$/);
    // No fresh-Start CTA competing with the resume path.
    await expect(page.getByRole("link", { name: /Start with Basic Info/i })).toHaveCount(0);
  });
});

test.describe("submitted screen", () => {
  test("with a flash payload: names the experience and lists the three stages", async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem(
        "godnd:last-submission",
        JSON.stringify({
          title: "5-day Sikkim monastery loop",
          ref: "8f2e6c04-1234-5678-9abc-def012345678",
          submittedAt: Date.now(),
        }),
      );
    });

    await page.goto(SUBMITTED);

    // The specific title comes off the flash payload.
    await expect(page.getByRole("heading", { level: 2 })).toContainText(
      "5-day Sikkim monastery loop",
    );
    // A shortened form of the id is visible so the operator has a reference.
    await expect(page.getByText(/EXP-8f2e6c04/)).toBeVisible();

    // The three stages, in order.
    for (const stage of ["Under review", "You'll hear back", "Live on the marketplace"]) {
      await expect(page.getByRole("heading", { name: stage, level: 4 })).toBeVisible();
    }

    // Primary CTA lands the operator where their row now sits.
    const primary = page.getByRole("link", { name: /See it under Under review/i });
    await expect(primary).toHaveAttribute("href", /tab=under_review/);
  });

  test("without a flash: shows the neutral fallback, not a fake confirmation", async ({ page }) => {
    // No flash written — the operator hit /submitted directly, or refreshed
    // after the flash was consumed. The screen must not pretend a submission
    // happened.
    await page.goto(SUBMITTED);
    await expect(page.getByText(/No recent submission on this device/i)).toBeVisible();
    // And no fake stage list.
    await expect(page.getByRole("heading", { name: "Under review" })).toHaveCount(0);
  });
});
