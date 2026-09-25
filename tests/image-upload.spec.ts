import { deflateSync, crc32 } from "node:zlib";

import { expect, test, type Page } from "@playwright/test";

/**
 * Photo upload — itinerary stops and the listing thumbnail.
 *
 * Guards the states an operator actually meets: an empty stop that says what
 * it accepts, photos that survive a reload (they live in IndexedDB, not the
 * sessionStorage draft), rejections that explain themselves on the tile, the
 * per-stop cap, reordering, and the hand-off to step 7's thumbnail picker —
 * including a removed photo taking its thumbnail choice with it.
 *
 * Images are generated here rather than checked in: a solid-colour PNG of an
 * exact size is all the pipeline needs, and the size is what the rules test.
 */

const NEW = "/dashboard/experiences/new";

function png(width: number, height: number, rgb: [number, number, number] = [4, 120, 87]) {
  const row = Buffer.alloc(width * 3 + 1);
  for (let x = 0; x < width; x += 1) row.set(rgb, 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));

  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const photo = (name: string, width = 1200, height = 900) => ({
  name,
  mimeType: "image/png",
  buffer: png(width, height),
});

const DRAFT = {
  draft: {
    basicInfo: {
      kind: "general", title: "Khasi hills in two days",
      regions: ["meghalaya"], durationDays: 2, durationNights: 1,
      categories: ["adventure"], languages: ["english"],
      minAge: 16, maxAge: 60, activityTags: ["trekking"],
      foodIncluded: "breakfast_dinner", foodPreference: "both",
    },
    itinerary: {
      days: [
        { dayNumber: 1, pickupIncluded: false, pickupLocation: "", pickupRegion: "", pickupTime: "",
          activities: [{ id: "a1", title: "Umiam Lake", kind: "stop_location", stoppageMin: 60, locationName: "Umiam", comment: "" }] },
        { dayNumber: 2, pickupIncluded: false, pickupLocation: "", pickupRegion: "", pickupTime: "",
          activities: [] },
      ],
    },
  },
  completed: { "basic-info": true },
};

async function seed(page: Page) {
  // Seed once per test, not on every navigation: later steps must see what
  // earlier ones wrote.
  await page.addInitScript((state) => {
    if (!window.sessionStorage.getItem("seeded")) {
      window.sessionStorage.setItem("godnd:experience-draft", state);
      window.sessionStorage.setItem("seeded", "1");
    }
  }, JSON.stringify(DRAFT));
}

const stop = (page: Page) => page.locator(".uploader").first();
const fileInput = (page: Page) => stop(page).locator("input[type=file]");
const addedTiles = (page: Page) => stop(page).locator(".upload-tile:not(.is-error):not(.is-busy)");

test.describe("itinerary photos", () => {
  test.beforeEach(async ({ page }) => {
    await seed(page);
    await page.goto(`${NEW}/itinerary`);
  });

  test("an empty stop says what it accepts before anything is picked", async ({ page }) => {
    const zone = stop(page).locator(".dropzone");
    await expect(zone).toContainText("Add photos");
    await expect(zone).toContainText("JPG, PNG or WebP · up to 15 MB each · up to 8");
  });

  test("added photos show, can be described, and survive a reload", async ({ page }) => {
    await fileInput(page).setInputFiles([photo("lake-1.png"), photo("lake-2.png")]);

    await expect(addedTiles(page)).toHaveCount(2);
    await expect(addedTiles(page).locator("img")).toHaveCount(2);
    await expect(stop(page).locator(".uploader-count")).toHaveText("2 of 8");
    await expect(stop(page).locator(".tile-badge")).toHaveText("Lead");

    await page.getByLabel(/Description of photo 1/).fill("Umiam Lake at sunrise");

    await page.reload();
    await expect(addedTiles(page).locator("img")).toHaveCount(2);
    await expect(page.getByLabel(/Description of photo 1/)).toHaveValue("Umiam Lake at sunrise");
  });

  test("rejected files explain why, on their own tile", async ({ page }) => {
    await fileInput(page).setInputFiles([
      { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not a photo") },
      { name: "IMG_0042.HEIC", mimeType: "image/heic", buffer: Buffer.from("heic") },
      photo("tiny.png", 320, 240),
    ]);

    const failed = stop(page).locator(".upload-tile.is-error");
    await expect(failed).toHaveCount(3);
    await expect(failed.filter({ hasText: "notes.txt" })).toContainText("isn't a JPG, PNG or WebP");
    await expect(failed.filter({ hasText: "IMG_0042.HEIC" })).toContainText("HEIC photos");
    await expect(failed.filter({ hasText: "tiny.png" })).toContainText("Too small to look sharp on the listing (320×240)");

    await page.getByRole("button", { name: "Dismiss notes.txt" }).click();
    await expect(failed).toHaveCount(2);
  });

  test("a stop holds eight photos and says so", async ({ page }) => {
    await fileInput(page).setInputFiles(
      Array.from({ length: 9 }, (_, index) => photo(`p${index + 1}.png`, 800, 600)),
    );

    await expect(addedTiles(page)).toHaveCount(8);
    await expect(stop(page).locator(".upload-tile.is-error")).toContainText("already has 8 photos");
    await expect(stop(page).locator(".dropzone")).toHaveCount(0);
    await expect(stop(page).locator(".uploader-note")).toHaveText("8 of 8 photos. Remove one to add another.");
  });

  test("photos reorder and remove, and focus lands somewhere sensible", async ({ page }) => {
    await fileInput(page).setInputFiles([photo("first.png")]);
    await expect(addedTiles(page)).toHaveCount(1);
    await fileInput(page).setInputFiles([photo("second.png")]);
    await expect(addedTiles(page)).toHaveCount(2);

    await page.getByRole("button", { name: "Move photo 1 later" }).click();
    await expect(addedTiles(page).first().locator(".tile-meta")).toHaveAttribute("title", "second.png");

    await page.getByRole("button", { name: /Remove photo 1, second.png/ }).click();
    await expect(addedTiles(page)).toHaveCount(1);
    await expect(stop(page).locator(".dropzone")).toBeFocused();
  });

  test("dropping files lights the zone, then adds them", async ({ page }) => {
    const zone = stop(page).locator(".dropzone");
    const bytes = [...png(900, 700)];
    const transfer = await page.evaluateHandle((data) => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(data)], "dropped.png", { type: "image/png" }));
      return dt;
    }, bytes);

    await zone.dispatchEvent("dragenter", { dataTransfer: transfer });
    await expect(zone).toHaveClass(/is-over/);
    await expect(zone).toContainText("Drop to add");

    await zone.dispatchEvent("drop", { dataTransfer: transfer });
    await expect(addedTiles(page)).toHaveCount(1);
    await expect(zone).not.toHaveClass(/is-over/);
  });
});

test.describe("thumbnail from photos", () => {
  test.beforeEach(async ({ page }) => {
    await seed(page);
  });

  test("with no photos, step 7 points back to the itinerary", async ({ page }) => {
    await page.goto(`${NEW}/media`);
    await expect(page.getByText("No photos to choose from yet")).toBeVisible();
    await expect(page.getByRole("link", { name: "Add photos to the itinerary" })).toBeVisible();
  });

  test("an itinerary photo becomes the thumbnail, and removing it clears the choice", async ({ page }) => {
    await page.goto(`${NEW}/itinerary`);
    await fileInput(page).setInputFiles([photo("cover.png")]);
    await expect(addedTiles(page)).toHaveCount(1);

    await page.goto(`${NEW}/media`);
    const option = page.getByRole("radio", { name: /Day 1 · Umiam Lake/ });
    await option.click();
    await expect(option).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("article").first().locator("img")).toBeVisible();

    await page.goto(`${NEW}/itinerary`);
    await page.getByRole("button", { name: /Remove photo 1/ }).click();

    await page.goto(`${NEW}/media`);
    await expect(page.getByText("No photos to choose from yet")).toBeVisible();
    await expect(page.locator("article").first()).toContainText("No thumbnail chosen");
  });

  test("uploading a custom thumbnail selects it", async ({ page }) => {
    await page.goto(`${NEW}/media`);
    await page.locator(".uploader input[type=file]").setInputFiles([photo("custom.png", 1600, 1200)]);

    const custom = page.getByRole("radio", { name: /Custom thumbnail/ });
    await expect(custom).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("button", { name: "Replace" })).toBeVisible();
  });
});
