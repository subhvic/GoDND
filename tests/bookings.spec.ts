import { expect, test, type Page } from "@playwright/test";

/**
 * Bookings — five phases derived from status and dates (Awaiting payment,
 * Upcoming, Ongoing, Completed, Cancelled), and the drawer journeys that
 * move a booking between them (docs/BOOKING-JOURNEYS.md). The sample data is
 * dated relative to today, so "on a trip right now" is always true of the
 * same two bookings.
 *
 * Without Supabase keys each change lives in the page, so every test
 * starts from the same fixture.
 */

/** Navigate and wait until the list has hydrated, so clicks have handlers. */
async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator(".bookings-workspace[data-hydrated]")).toBeAttached({ timeout: 20_000 });
}

const tab = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Booking phase" }).getByRole("link", { name: new RegExp(`^${name}`) });

const row = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

async function openDrawer(page: Page, path: string, name: string) {
  await open(page, path);
  await row(page, name).click();
  const drawer = page.getByRole("dialog", { name });
  await expect(drawer).toBeVisible();
  return drawer;
}

async function moreActions(page: Page, drawer: ReturnType<Page["getByRole"]>, item: string) {
  await drawer.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: item }).click();
}

test.describe("bookings list", () => {
  test("five phases, Upcoming by default", async ({ page }) => {
    await open(page, "/dashboard/bookings");

    for (const name of ["Awaiting payment", "Upcoming", "Ongoing", "Completed", "Cancelled"]) {
      await expect(tab(page, name)).toBeVisible();
    }
    await expect(tab(page, "Upcoming")).toHaveAttribute("aria-current", "page");
    await expect(tab(page, "Awaiting payment")).toContainText("1");
    await expect(tab(page, "Ongoing")).toContainText("2");

    // Nearest departure first.
    await expect(page.locator("tbody tr").first()).toContainText("Aarav Nair");
    await expect(row(page, "Priya Sengupta")).toBeVisible();
    await expect(row(page, "Meera Iyer")).toBeVisible();
    await expect(row(page, "Ishaan Das")).toHaveCount(0);
  });

  test("Ongoing holds the trips happening today, with the day of the trip", async ({ page }) => {
    await open(page, "/dashboard/bookings?tab=ongoing");

    const ishaan = page.locator("tbody tr", { hasText: "Ishaan Das" });
    await expect(ishaan).toContainText("Day 2 of 4");
    await expect(ishaan).toContainText("On trip");

    const neha = page.locator("tbody tr", { hasText: "Neha Kulkarni" });
    await expect(neha).toContainText("Day 1 of 3");
    await expect(neha).toContainText("On trip · balance due");

    await expect(page.locator("tbody tr")).toHaveCount(2);
  });

  test("Completed puts wrap-ups first; Cancelled puts owed refunds first", async ({ page }) => {
    await open(page, "/dashboard/bookings?tab=completed");
    await expect(page.locator("tbody tr").first()).toContainText("Siddharth Rao");
    await expect(page.locator("tbody tr").first()).toContainText("Wrap-up pending");
    await expect(row(page, "Anjali Raghavan")).toBeVisible();

    await tab(page, "Cancelled").click();
    await expect(page).toHaveURL(/tab=cancelled/);
    await expect(page.locator("tbody tr").first()).toContainText("Kavya Menon");
    await expect(page.locator("tbody tr").first()).toContainText("Refund due");
    await expect(row(page, "Rahul Menon")).toBeVisible();
    await expect(row(page, "Divya Rao")).toBeVisible();
  });

  test("search matches a reference and recounts every tab", async ({ page }) => {
    await open(page, "/dashboard/bookings?q=BKG-000142");
    await expect(row(page, "Priya Sengupta")).toBeVisible();
    await expect(row(page, "Aarav Nair")).toHaveCount(0);
    await expect(tab(page, "Ongoing")).toContainText("0");
  });
});

test.describe("booking journeys", () => {
  test("J2 recording the payment moves an awaiting booking to Upcoming", async ({ page }) => {
    const drawer = await openDrawer(page, "/dashboard/bookings?tab=awaiting", "Karan Bose");
    await drawer.getByRole("button", { name: "Record payment" }).click();

    const dialog = page.getByRole("dialog", { name: "Record a payment" });
    await dialog.getByRole("button", { name: "Record payment" }).click();
    // UPI needs a reference so the payment can be matched later.
    await expect(dialog.getByText(/Add the transaction reference/)).toBeVisible();
    await dialog.getByRole("textbox", { name: /Transaction reference/ }).fill("UPI 5521 0934 1182");
    await dialog.getByRole("button", { name: "Record payment" }).click();

    await expect(drawer.getByText("₹55,500 recorded")).toBeVisible();
    await expect(drawer.locator(".record-drawer-sub")).toContainText("Paid");
    // The row stays put, saying where it went, until the tab changes.
    await expect(page.locator("tbody tr", { hasText: "Karan Bose" })).toContainText("Moved to Upcoming");
    await expect(tab(page, "Awaiting payment")).toContainText("0");
    await expect(tab(page, "Upcoming")).toContainText("4");
  });

  test("J1 a payment reminder opens in WhatsApp with the balance and reference", async ({ page }) => {
    const drawer = await openDrawer(page, "/dashboard/bookings", "Aarav Nair");
    await drawer.getByRole("button", { name: "Collect balance" }).click();

    const dialog = page.getByRole("dialog", { name: "Send a payment reminder" });
    await expect(dialog.getByRole("textbox", { name: "Message" })).toHaveValue(/₹49,000 is due/);
    const whatsapp = dialog.getByRole("link", { name: "Open in WhatsApp" });
    await expect(whatsapp).toHaveAttribute("href", /^https:\/\/wa\.me\/919740788113\?text=.*BKG-000143/);
  });

  test("J3 cancelling applies the refund policy and leaves a refund due", async ({ page }) => {
    const drawer = await openDrawer(page, "/dashboard/bookings", "Priya Sengupta");
    await moreActions(page, drawer, "Cancel booking");

    const dialog = page.getByRole("dialog", { name: "Cancel BKG-000142?" });
    // Nine days out is the 50% tier.
    await expect(dialog.getByText(/9 days before departure — 50% refund/)).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: "Refund to the guest" })).toHaveValue("67000");

    const confirm = dialog.getByRole("button", { name: "Cancel booking", exact: true });
    await expect(confirm).toBeDisabled();
    await dialog.getByRole("textbox", { name: /Details/ }).fill("Family emergency — asked by phone");
    await dialog.getByRole("checkbox").check();
    await confirm.click();

    await expect(drawer.locator(".record-drawer-sub")).toContainText("Refund due");
    await expect(tab(page, "Cancelled")).toContainText("4");
    await expect(tab(page, "Upcoming")).toContainText("2");
  });

  test("J4 recording an owed refund settles the cancellation", async ({ page }) => {
    const drawer = await openDrawer(page, "/dashboard/bookings?tab=cancelled", "Kavya Menon");
    await drawer.getByRole("button", { name: "Record refund" }).first().click();
    await page.getByRole("dialog", { name: "Record the refund" }).getByRole("button", { name: "Record refund" }).click();

    await expect(drawer.getByText("₹50,250 refund recorded")).toBeVisible();
    await expect(drawer.locator(".record-drawer-sub")).toContainText("Refunded");
    await expect(drawer.getByRole("button", { name: "Record refund" })).toHaveCount(0);
  });

  test("J5 + permits: fill a seat and move the permit along", async ({ page }) => {
    const drawer = await openDrawer(page, "/dashboard/bookings", "Aarav Nair");
    await expect(drawer.getByText(/needs ID details for 2 more travellers/)).toBeVisible();

    await drawer.getByRole("button", { name: "Add a traveller to seat 3" }).click();
    const dialog = page.getByRole("dialog", { name: "Add a traveller" });
    await dialog.getByRole("textbox", { name: /Full name/ }).fill("Rohan Nair");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(drawer.getByText("Rohan Nair added")).toBeVisible();
    // Named, but the permit still needs an ID for him.
    await expect(drawer.locator(".manifest-row", { hasText: "Rohan Nair" })).toContainText("ID needed for the permit");

    await drawer.getByRole("button", { name: "Mark applied" }).click();
    await expect(drawer.getByText("Applied — awaiting permits")).toBeVisible();
    await drawer.getByRole("button", { name: "Mark issued" }).click();
    await expect(drawer.getByText("Permits marked issued")).toBeVisible();
  });

  test("J8 changing dates refuses a no-op and logs the move", async ({ page }) => {
    const drawer = await openDrawer(page, "/dashboard/bookings", "Aarav Nair");
    await moreActions(page, drawer, "Change dates");

    const dialog = page.getByRole("dialog", { name: "Change dates" });
    await dialog.getByRole("button", { name: "Change dates" }).click();
    await expect(dialog.getByText("Those are the current dates — pick new ones.")).toBeVisible();

    const later = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10);
    await dialog.getByLabel("New start").fill(later);
    await dialog.getByRole("button", { name: "Change dates" }).click();
    await expect(drawer.getByText(/^Dates changed to/)).toBeVisible();

    await drawer.locator("summary", { hasText: "Timeline" }).click();
    await expect(drawer.locator(".booking-timeline")).toContainText("Dates changed");
  });

  test("J9 + J10 checking in the last guest, then logging an incident", async ({ page }) => {
    const drawer = await openDrawer(page, "/dashboard/bookings?tab=ongoing", "Ishaan Das");
    await expect(drawer.getByText("3 / 4")).toBeVisible();

    await drawer.getByRole("button", { name: "Check in Mira Joshi" }).click();
    await page.getByRole("dialog", { name: "Check in guests" }).getByRole("button", { name: "Check in 1" }).click();
    await expect(drawer.getByText("4 / 4")).toBeVisible();

    // Everyone's in, so the primary action becomes the trip log.
    await drawer.getByRole("button", { name: "Add trip update" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Add a trip update" });
    await dialog.getByRole("button", { name: "Incident" }).click();
    await dialog.getByRole("textbox", { name: /Headline/ }).fill("Minor sprain on the descent — first aid given");
    await dialog.getByRole("button", { name: "Add to trip log" }).click();
    // Incidents stand out in the trip log (and are kept on the timeline too).
    const logged = drawer.locator(".trip-log li", { hasText: "Minor sprain on the descent — first aid given" });
    await expect(logged).toBeVisible();
    await expect(logged).toHaveClass(/incident/);
  });

  test("J11 a trip with a balance due can't be closed until it's paid", async ({ page }) => {
    const drawer = await openDrawer(page, "/dashboard/bookings?tab=ongoing", "Neha Kulkarni");
    await moreActions(page, drawer, "End trip early");

    const dialog = page.getByRole("dialog", { name: "End the trip early?" });
    await expect(dialog.getByText(/₹18,500 is still due/)).toBeVisible();
    await dialog.getByRole("button", { name: "Record the payment" }).click();
    await expect(page.getByRole("dialog", { name: "Record a payment" })).toBeVisible();
  });

  test("J11 closing out a wrap-up completes it and asks for a review", async ({ page }) => {
    const drawer = await openDrawer(page, "/dashboard/bookings?tab=completed", "Siddharth Rao");
    await drawer.getByRole("button", { name: "Close out trip" }).click();

    const dialog = page.getByRole("dialog", { name: "Close out this trip?" });
    await expect(dialog.getByText(/Siddharth is asked for a review/)).toBeVisible();
    await dialog.getByRole("button", { name: "Close out trip" }).click();

    await expect(drawer.getByText("Trip closed — review requested")).toBeVisible();
    await expect(drawer.locator(".record-drawer-sub")).toContainText("Completed");
    await expect(page.locator("tbody tr", { hasText: "Siddharth Rao" })).not.toContainText("Wrap-up pending");
  });

  test("J13 replying to a review shows the reply under it", async ({ page }) => {
    const drawer = await openDrawer(page, "/dashboard/bookings?tab=completed", "Anjali Raghavan");
    await drawer.getByRole("button", { name: "Reply to review" }).click();

    const dialog = page.getByRole("dialog", { name: "Reply to the review" });
    await dialog.getByRole("textbox", { name: /Your reply/ }).fill("Thank you, Anjali — see you in the hills again!");
    await dialog.getByRole("button", { name: "Post reply" }).click();

    await expect(drawer.getByText("Reply posted")).toBeVisible();
    await expect(drawer.getByText("Thank you, Anjali — see you in the hills again!")).toBeVisible();
  });

  test("J14 the invoice splits GST and adds up to the paisa", async ({ page }) => {
    const drawer = await openDrawer(page, "/dashboard/bookings", "Priya Sengupta");
    await drawer.getByRole("button", { name: "View invoice" }).click();

    const invoice = page.getByRole("article", { name: "Invoice INV-000142" });
    await expect(invoice).toContainText("998555");
    await expect(invoice).toContainText("₹1,27,619.05");
    await expect(invoice).toContainText("₹3,190.47");
    await expect(invoice).toContainText("₹3,190.48");
    await expect(invoice).toContainText("₹1,34,000.00");
  });
});

test.describe("bookings on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("cards replace the table, and the drawer keeps every action in reach", async ({ page }) => {
    await open(page, "/dashboard/bookings?tab=ongoing");

    // The table is swapped out; the card says what the status column did.
    await expect(page.locator("table.data-table")).toBeHidden();
    const card = page.getByRole("button", { name: "Neha Kulkarni", exact: true });
    await expect(card).toBeVisible();
    await expect(page.locator(".booking-card", { hasText: "Neha Kulkarni" })).toContainText("On trip · balance due");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    await card.click();
    const drawer = page.getByRole("dialog", { name: "Neha Kulkarni" });
    await expect(drawer.getByRole("button", { name: "Message guest" })).toBeHidden();
    await drawer.getByRole("button", { name: "More actions" }).click();
    await expect(page.getByRole("menuitem", { name: "Message guest" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Cancel booking" })).toBeVisible();
  });
});

test.describe("sidebar wiring", () => {
  test("Bookings is a real link, not disabled", async ({ page }) => {
    await page.goto("/dashboard/experiences");
    // A disabled nav item renders as a <span>, so the anchor's existence is
    // itself the assertion that Bookings is enabled.
    await expect(page.locator('a.nav-item[href="/dashboard/bookings"]')).toHaveCount(1);
  });
});
