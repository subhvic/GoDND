import { expect, test, type Page } from "@playwright/test";

/**
 * Settings — the vendor profile GoDND checks before an operator can list.
 *
 * What is worth guarding is the set of promises the section makes:
 *
 *   - It opens where the operator is needed, and the rail says why each
 *     section is or isn't done.
 *   - Nothing reaches GoDND half-filled: a submit names what's missing, in
 *     the operator's terms (a mistyped GSTIN, a mismatched account number).
 *   - A verified section can't be quietly edited: a change is announced,
 *     submitted or cancelled — and leaving mid-edit asks first.
 *   - Changing where payouts go, or the sign-in email, is confirmed.
 *   - The team can't lose its owner, and nobody changes their own role.
 *
 * The sample workspace keeps changes in the page, so each test walks within
 * one visit rather than reloading.
 */

const rail = (page: Page) => page.getByRole("navigation", { name: "Settings sections" });
const pdf = (name: string) => ({ name, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n") });

test.describe("landing", () => {
  test("opens on the first section that needs the operator", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await expect(page).toHaveURL(/\/dashboard\/settings\/financial$/);
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
    await expect(page.getByText("Your bank details are yet to be submitted.")).toBeVisible();
    await expect(page.getByText("Step 3 of 7")).toBeVisible();
  });

  test("the rail states each section's standing, not only an icon", async ({ page }) => {
    await page.goto("/dashboard/settings/basic-info");
    await expect(rail(page).getByRole("link", { name: /Basic Info, Verified/ })).toBeVisible();
    await expect(rail(page).getByRole("link", { name: /Certifications.*Changes requested/ })).toBeVisible();
    await expect(rail(page).getByRole("link", { name: /Operational Details, Not submitted/ })).toBeVisible();
    await expect(rail(page).getByRole("link", { name: /My Profile, Add your phone number/ })).toBeVisible();
  });
});

test.describe("operational details (the handoff frame)", () => {
  test("a missing field is named, then the section is sent and the rail updates", async ({ page }) => {
    await page.goto("/dashboard/settings/operations");
    await expect(page.getByText("Your operational details are yet to be submitted.")).toBeVisible();

    await page.getByRole("button", { name: /Submit & next step/ }).click();
    await expect(page.getByText("Select at least one language")).toBeVisible();
    await expect(page).toHaveURL(/\/operations$/);

    await page.getByLabel("Languages Supported").selectOption("english");
    await page.getByRole("button", { name: /Submit & next step/ }).click();
    await expect(page).toHaveURL(/\/settings\/profile$/);
    await expect(page.locator(".toast-bar")).toContainText("Operational details sent to GoDND");
    await expect(rail(page).getByRole("link", { name: /Operational Details, GoDND is verifying/ })).toBeVisible();
  });
});

test.describe("compliance", () => {
  test("a GSTIN that doesn't carry the PAN is caught before GoDND sees it", async ({ page }) => {
    await page.goto("/dashboard/settings/compliance");
    await page.getByRole("button", { name: "Edit details" }).click();
    await expect(page.getByText("You’re changing verified details")).toBeVisible();

    await page.getByRole("textbox", { name: /^GSTIN/ }).fill("17AAPFU0939F1ZW");
    await page.getByRole("button", { name: "Submit changes" }).click();
    await expect(page.getByText(/Characters 3 to 12 of a GSTIN are the PAN/)).toBeVisible();

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("textbox", { name: /^GSTIN/ })).toHaveValue("17AAHFW4821K1ZU");
    await expect(page.getByRole("textbox", { name: /^GSTIN/ })).toBeDisabled();
  });
});

test.describe("financial details", () => {
  test("bank details are confirmed, then shown masked while GoDND checks them", async ({ page }) => {
    await page.goto("/dashboard/settings/financial");
    await page.getByLabel("Account holder name").fill("Wander Beyond Travels LLP");
    await page.getByRole("textbox", { name: /^Account number/ }).fill("123456789012");
    await page.getByLabel("Re-enter account number").fill("123456789013");
    await page.getByLabel("IFSC").fill("HDFC0001234");
    await expect(page.getByText("HDFC Bank", { exact: true })).toBeVisible();
    await page.getByLabel("Current").check();
    await page.locator('input[type="file"]').first().setInputFiles(pdf("cancelled-cheque.pdf"));

    await page.getByRole("button", { name: /Submit & next step/ }).click();
    await expect(page.getByText("The two account numbers don’t match")).toBeVisible();

    await page.getByLabel("Re-enter account number").fill("123456789012");
    await page.getByRole("button", { name: /Submit & next step/ }).click();
    await expect(page).toHaveURL(/\/certifications$/);

    await rail(page).getByRole("link", { name: /Financial Details/ }).click();
    await expect(page.getByRole("textbox", { name: /last four digits/ })).toHaveValue("•••• •••• 9012");
    await expect(page.getByText(/Sent for verification on/)).toBeVisible();

    // Changing a sent payout account asks first.
    await page.getByRole("button", { name: "Edit details" }).click();
    await page.getByRole("button", { name: "Submit changes" }).click();
    await expect(page.getByRole("dialog", { name: "Change the payout account?" })).toBeVisible();
  });
});

test.describe("certifications", () => {
  test("the certificate GoDND flagged is renewed and the section resubmitted", async ({ page }) => {
    await page.goto("/dashboard/settings/certifications");
    await expect(page.getByText("GoDND asked for changes")).toBeVisible();
    const flagged = page.locator(".cert-card", { hasText: "Wilderness first aid" });
    await expect(flagged).toContainText("Flagged by GoDND");
    await expect(flagged).toContainText(/Expired on/);

    await page.getByRole("button", { name: "Edit Wilderness first aid" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit certificate" });
    await expect(dialog).toContainText("This one has expired");
    const nextYear = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
    await dialog.getByLabel("Valid until").fill(nextYear);
    await dialog.locator('input[type="file"]').setInputFiles(pdf("wfa-renewed.pdf"));
    await dialog.getByRole("button", { name: "Save certificate" }).click();
    await expect(flagged).toContainText(/Valid until/);

    await page.getByRole("button", { name: /Submit & next step/ }).click();
    await expect(page.locator(".toast-bar")).toContainText("Certifications sent to GoDND");
  });

  test("an expired certificate can't be added as if it were current", async ({ page }) => {
    await page.goto("/dashboard/settings/certifications");
    await page.getByRole("button", { name: "Add certificate" }).click();
    const dialog = page.getByRole("dialog", { name: "Add certificate" });
    await dialog.getByLabel("Type").selectOption("iato");
    await expect(dialog.getByLabel("Issued by")).toHaveValue("Indian Association of Tour Operators");
    await dialog.getByLabel("Certificate or registration number").fill("IATO/2024/88");
    await dialog.getByLabel("Valid until").fill("2020-01-01");
    await dialog.getByRole("button", { name: "Add certificate" }).click();
    await expect(dialog.getByText(/That date has passed/)).toBeVisible();
  });
});

test.describe("editing a verified section", () => {
  test("leaving with unsaved edits asks first, and cancel restores what was verified", async ({ page }) => {
    await page.goto("/dashboard/settings/basic-info");
    await expect(page.getByLabel("City")).toBeDisabled();
    await page.getByRole("button", { name: "Edit details" }).click();
    await page.getByLabel("City").fill("Guwahati");

    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Home", exact: true }).click();
    const guard = page.getByRole("dialog", { name: "Discard your changes?" });
    await expect(guard).toBeVisible();
    await guard.getByRole("button", { name: "Keep editing" }).click();
    await expect(page).toHaveURL(/\/basic-info$/);

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByLabel("City")).toHaveValue("Shillong");
  });
});

test.describe("my profile", () => {
  test("the sign-in email changes only after a code sent to the new address", async ({ page }) => {
    await page.goto("/dashboard/settings/profile");
    await page.getByRole("button", { name: "Change", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("New email address").fill("riya@wanderbeyond.in");
    await dialog.getByRole("button", { name: "Send code" }).click();
    await expect(dialog.getByText("That address belongs to someone on your team")).toBeVisible();

    await dialog.getByLabel("New email address").fill("dipendu.dey@wanderbeyond.in");
    await dialog.getByRole("button", { name: "Send code" }).click();
    await dialog.locator(".otp-input").fill("111111");
    await dialog.getByRole("button", { name: "Confirm new email" }).click();
    await expect(dialog.getByText("Incorrect code")).toBeVisible();

    await dialog.locator(".otp-input").fill("123456");
    await dialog.getByRole("button", { name: "Confirm new email" }).click();
    await expect(page.locator(".toast-bar")).toContainText("dipendu.dey@wanderbeyond.in");
  });

  test("a phone number is required, and saving moves on to the team", async ({ page }) => {
    await page.goto("/dashboard/settings/profile");
    await page.getByRole("button", { name: /Save & next step/ }).click();
    await expect(page.getByText("Phone number is required")).toBeVisible();
    await page.getByRole("textbox", { name: /^Phone number/ }).fill("98640 11223");
    await page.getByRole("button", { name: /Save & next step/ }).click();
    await expect(page).toHaveURL(/\/settings\/team$/);
  });
});

test.describe("my team", () => {
  test("invites are checked for duplicates and join the list as pending", async ({ page }) => {
    await page.goto("/dashboard/settings/team");
    await page.getByRole("button", { name: "Invite member" }).click();
    const dialog = page.getByRole("dialog", { name: "Invite a team member" });
    await dialog.getByLabel("Email address").fill("riya@wanderbeyond.in");
    await dialog.getByRole("button", { name: "Send invite" }).click();
    await expect(dialog.getByText("Already on your team")).toBeVisible();

    await dialog.getByLabel("Email address").fill("trips@wanderbeyond.in");
    await dialog.getByText("Operations", { exact: true }).click();
    await dialog.getByRole("button", { name: "Send invite" }).click();
    await expect(page.locator(".team-row", { hasText: "trips@wanderbeyond.in" })).toContainText("Invited");
  });

  test("the owner and your own row can't be changed; others can", async ({ page }) => {
    await page.goto("/dashboard/settings/team");
    await expect(page.getByRole("button", { name: "Actions for Rohit Sangha" })).toHaveCount(0);
    await expect(page.getByLabel("Role for Dipendu Dey")).toHaveCount(0);

    await page.getByLabel("Role for Riya Das").selectOption("ops");
    await expect(page.locator(".toast-bar")).toContainText("Riya Das is now Operations");

    await page.getByRole("button", { name: "Actions for Arjun Gogoi" }).click();
    await page.getByRole("menuitem", { name: /Remove from workspace/ }).click();
    const confirm = page.getByRole("dialog", { name: "Remove Arjun Gogoi?" });
    await expect(confirm).toContainText("Enquiries assigned to them become unassigned");
    await confirm.getByRole("button", { name: "Remove from workspace" }).click();
    await expect(page.locator(".team-row", { hasText: "Arjun Gogoi" })).toHaveCount(0);
  });
});
