import { expect, test, type Page } from "@playwright/test";

/**
 * The Enquiries inbox — list, thread and the flows between them.
 *
 * Runs against the sample workspace (no Supabase keys), whose timestamps are
 * relative to the request, so "longest waiting first" and the overdue count
 * are stable across runs. Each test gets a fresh page, and the sample
 * workspace keeps changes only in the tab, so tests cannot leak into each
 * other.
 */

/** Navigate and wait until the inbox has hydrated, so clicks have handlers. */
async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator(".inbox[data-hydrated]")).toBeAttached({ timeout: 20_000 });
}

const viewTab = (page: Page, name: RegExp) =>
  page.getByRole("navigation", { name: "Enquiry views" }).getByRole("link", { name });
const conversation = (page: Page, name: string) =>
  page.getByRole("navigation", { name: /conversations/ }).getByRole("link", { name: new RegExp(name) });

test.describe("inbox list", () => {
  test("opens on Needs reply, longest wait first, with overdue called out", async ({ page }) => {
    await open(page, "/dashboard/enquiries");

    await expect(viewTab(page, /Needs reply/)).toHaveAttribute("aria-current", "page");
    await expect(viewTab(page, /Needs reply/)).toContainText("5");
    await expect(viewTab(page, /Needs reply/)).toContainText("1 overdue");
    await expect(viewTab(page, /Replied/)).toContainText("2");
    await expect(viewTab(page, /Closed/)).toContainText("3");

    // Ananya has waited 26 hours — she leads, not the newest enquiry.
    const first = page.locator("[data-conv-link]").first();
    await expect(first).toContainText("Ananya Kapoor");
    await expect(first).toContainText("26h");

    // The empty thread pane says what is waiting instead of sitting blank.
    await expect(page.getByRole("heading", { name: "5 travellers are waiting on a reply" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Reply to Ananya" })).toBeVisible();
  });

  test("views split the inbox by whose move it is", async ({ page }) => {
    await open(page, "/dashboard/enquiries");

    await viewTab(page, /Replied/).click();
    await expect(conversation(page, "Sneha Pillai")).toBeVisible();
    await expect(conversation(page, "Nikhil Bora")).toBeVisible();
    await expect(conversation(page, "Ananya Kapoor")).toHaveCount(0);
    await expect(page).toHaveURL(/view=replied/);

    await viewTab(page, /Closed/).click();
    await expect(conversation(page, "Priya Sengupta")).toBeVisible();
    await expect(conversation(page, "Aditya Verma")).toBeVisible();
    await expect(conversation(page, "Rankboost Digital")).toBeVisible();
  });

  test("search points to matches in other views", async ({ page }) => {
    await open(page, "/dashboard/enquiries");

    await page.getByRole("searchbox", { name: "Search enquiries" }).fill("Priya");
    await expect(page.getByText(/Nothing in Needs reply matches/)).toBeVisible();

    await page.getByRole("button", { name: "1 in Closed" }).click();
    await expect(conversation(page, "Priya Sengupta")).toBeVisible();
    await expect(page).toHaveURL(/q=Priya/);
  });

  test("owner filter narrows to your conversations", async ({ page }) => {
    await open(page, "/dashboard/enquiries");

    await page.getByRole("button", { name: /Owner filter/ }).click();
    await page.getByRole("menuitemradio", { name: "Assigned to me" }).click();

    await expect(conversation(page, "Farah Sheikh")).toBeVisible();
    await expect(conversation(page, "Tenzin Dorjee")).toBeVisible();
    await expect(conversation(page, "Ananya Kapoor")).toHaveCount(0);
    await expect(conversation(page, "Rohan Mehta")).toHaveCount(0);
  });

  test("arrow keys move through the list", async ({ page }) => {
    await open(page, "/dashboard/enquiries");

    const links = page.locator("[data-conv-link]");
    await links.first().focus();
    await page.keyboard.press("ArrowDown");
    await expect(links.nth(1)).toBeFocused();
    await page.keyboard.press("End");
    await expect(links.last()).toBeFocused();
  });
});

test.describe("conversation", () => {
  test("opens at the unread marker and clears the badge", async ({ page }) => {
    await open(page, "/dashboard/enquiries");
    await expect(conversation(page, "Farah Sheikh")).toContainText("2 unread");

    await conversation(page, "Farah Sheikh").click();
    await expect(page.getByRole("heading", { name: "Farah Sheikh" })).toBeVisible();
    await expect(page.getByText("2 new messages")).toBeVisible();
    // The enquiry itself opens the thread.
    await expect(page.getByText("ENQ-000146").first()).toBeAttached();
    await expect(conversation(page, "Farah Sheikh")).not.toContainText("unread");
  });

  test("a reply appears at once and moves the conversation to Replied", async ({ page }) => {
    await open(page, "/dashboard/enquiries/enq-148");

    const box = page.getByRole("textbox", { name: "Reply to Ananya Kapoor" });
    await box.fill("Yes — 18 Oct is open. Shall I hold the cottage for you?");
    await box.press("Enter");

    const log = page.getByRole("log");
    await expect(log.getByText("Shall I hold the cottage for you?")).toBeVisible();
    await expect(log.getByText("Sent", { exact: true })).toBeVisible();
    await expect(box).toHaveValue("");

    // A first reply opens the enquiry, and the row stays put, marked as moved.
    await expect(page.getByRole("button", { name: /Stage: Open/ })).toBeVisible();
    await expect(conversation(page, "Ananya Kapoor")).toContainText("Moved to Replied");
    await expect(viewTab(page, /Needs reply/)).toContainText("4");
  });

  test("an internal note is labelled and doesn't count as a reply", async ({ page }) => {
    await open(page, "/dashboard/enquiries/enq-147");

    await page.getByRole("button", { name: "Internal note" }).click();
    await page.getByRole("textbox", { name: /Internal note/ }).fill("Bikes are included — check sizes before quoting.");
    await page.getByRole("button", { name: "Add note" }).click();

    await expect(page.getByRole("log").getByText("Bikes are included")).toBeVisible();
    await expect(page.getByRole("log").getByText(/Internal note · you/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Stage: New/ })).toBeVisible();
    await expect(conversation(page, "Rohan Mehta")).not.toContainText("Moved to");
  });

  test("stage changes are recorded, and Lost asks why", async ({ page }) => {
    await open(page, "/dashboard/enquiries/enq-145");

    await page.getByRole("button", { name: /Stage: Quoted/ }).click();
    await page.getByRole("menuitemradio", { name: /Negotiating/ }).click();
    await expect(page.getByRole("log").getByText("Stage changed to Negotiating")).toBeVisible();

    await page.getByRole("button", { name: /Stage: Negotiating/ }).click();
    await page.getByRole("menuitemradio", { name: /Lost/ }).click();
    const dialog = page.getByRole("dialog", { name: "Why was this enquiry lost?" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Booked with someone else").check();
    await dialog.getByRole("button", { name: "Mark as lost" }).click();

    await expect(page.getByRole("log").getByText("Marked as lost — Booked with someone else")).toBeVisible();
    await expect(page.getByText("This enquiry is marked lost. Sending a reply moves it back to Open.")).toBeVisible();
    await expect(conversation(page, "Vikram Rao")).toContainText("Moved to Closed");
  });

  test("a quote is sent as a card and moves the enquiry to Quoted", async ({ page }) => {
    await open(page, "/dashboard/enquiries/enq-148");

    await page.getByRole("button", { name: "Send quote" }).click();
    const dialog = page.getByRole("dialog", { name: "Send a quote to Ananya" });
    // Base price × two adults, previewed exactly as the traveller will see it.
    await expect(dialog.getByText("₹1,34,000")).toBeVisible();
    await dialog.getByRole("button", { name: "Send quote" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole("log").getByText("₹1,34,000")).toBeVisible();
    await expect(page.getByRole("button", { name: /Stage: Quoted/ })).toBeVisible();
  });

  test("a phone-only contact can't be replied to in chat", async ({ page }) => {
    await open(page, "/dashboard/enquiries/enq-149");

    await expect(page.getByText("Tenzin can’t get replies here")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reply", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Internal note" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("link", { name: "Call" }).first()).toHaveAttribute("href", "tel:+919436120457");
  });

  test("spam switches replies off until it is marked not spam", async ({ page }) => {
    await open(page, "/dashboard/enquiries/enq-137");

    await expect(page.getByText(/Replies are switched off/)).toBeVisible();
    await page.getByRole("button", { name: "Not spam" }).click();
    await expect(page.getByRole("textbox", { name: "Reply to Rankboost Digital" })).toBeVisible();
  });

  test("a half-written reply survives switching conversations", async ({ page }) => {
    await open(page, "/dashboard/enquiries/enq-148");
    await page.getByRole("textbox", { name: "Reply to Ananya Kapoor" }).fill("Draft about the cottage");

    await conversation(page, "Rohan Mehta").click();
    await expect(page.getByRole("heading", { name: "Rohan Mehta" })).toBeVisible();
    await conversation(page, "Ananya Kapoor").click();

    await expect(page.getByRole("textbox", { name: "Reply to Ananya Kapoor" })).toHaveValue("Draft about the cottage");
  });

  test("an unknown enquiry says so instead of erroring", async ({ page }) => {
    await open(page, "/dashboard/enquiries/does-not-exist");
    await expect(page.getByRole("heading", { name: "This enquiry isn’t in your inbox" })).toBeVisible();
  });
});

test.describe("log enquiry", () => {
  test("validates, then opens the new conversation", async ({ page }) => {
    await open(page, "/dashboard/enquiries");

    await page.getByRole("button", { name: /Log enquiry/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Log an enquiry" });
    await dialog.getByRole("button", { name: "Log enquiry" }).click();
    await expect(dialog.getByText("Enter the traveller's name")).toBeVisible();
    await expect(dialog.getByText("Add a phone number or an email so you can reply")).toBeVisible();

    await dialog.getByLabel(/^Name/).fill("Meenakshi Iyer");
    await dialog.getByLabel(/^Email/).fill("meenakshi@example.com");
    await dialog.getByLabel(/What they asked for/).fill("Cycling club of eight, early December.");
    await dialog.getByRole("button", { name: "Log enquiry" }).click();

    await expect(page).toHaveURL(/\/dashboard\/enquiries\/enq-new-/);
    await expect(page.getByRole("heading", { name: "Meenakshi Iyer" })).toBeVisible();
    await expect(page.getByText("ENQ-000150").first()).toBeVisible();
    await expect(conversation(page, "Meenakshi Iyer")).toBeVisible();
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("list and thread are separate screens with a way back", async ({ page }) => {
    await open(page, "/dashboard/enquiries");
    await expect(conversation(page, "Ananya Kapoor")).toBeVisible();

    await conversation(page, "Ananya Kapoor").click();
    await expect(page.getByRole("heading", { name: /Ananya Kapoor/ })).toBeVisible();
    await expect(conversation(page, "Ananya Kapoor")).toBeHidden();

    await page.getByRole("link", { name: "Back to enquiries" }).click();
    await expect(conversation(page, "Ananya Kapoor")).toBeVisible();
  });

  test("Enter makes a new line; the button sends", async ({ page }) => {
    await open(page, "/dashboard/enquiries/enq-148");
    const box = page.getByRole("textbox", { name: "Reply to Ananya Kapoor" });
    await box.fill("Line one");
    await box.press("Enter");
    await expect(box).toHaveValue("Line one\n");

    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByRole("log").getByText("Line one")).toBeVisible();
  });

  test("details open as a full-screen sheet", async ({ page }) => {
    await open(page, "/dashboard/enquiries/enq-145");
    await page.getByRole("button", { name: "Show enquiry details" }).click();

    const sheet = page.getByRole("dialog", { name: "Enquiry details" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByLabel("Stage")).toHaveValue("quoted");
    await sheet.getByRole("button", { name: "Back to conversation" }).click();
    await expect(sheet).toBeHidden();
  });
});
