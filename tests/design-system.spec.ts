import { expect, test } from "@playwright/test";

/**
 * /design-system — the page documents the tokens by reading them back out of
 * the stylesheet, so its contrast table doubles as an accessibility check on
 * the tokens themselves.
 *
 * The regression this guards: the source system's muted text and white-on-fill
 * pairs sat below 4.5:1. A token edit that drops any documented pair below
 * WCAG AA fails here rather than in front of an operator.
 */

test.describe("design system", () => {
  test("every documented text pair clears WCAG AA", async ({ page }) => {
    await page.goto("/design-system");

    const rows = page.locator("#color table tbody tr");
    await expect(rows.first()).toContainText(/\d+\.\d{2}:1/);

    const count = await rows.count();
    expect(count).toBeGreaterThan(10);

    for (let index = 0; index < count; index += 1) {
      const row = rows.nth(index);
      const label = (await row.locator("th").textContent()) ?? `row ${index}`;
      // The ratio cell must show a computed, passing ratio.
      await expect(row.locator("td").nth(1), label).toContainText("AA");
      await expect(row, label).not.toContainText("Fails");
    }
  });

  // The token row above proves --border-control passes; this proves the
  // controls actually draw with it (WCAG 1.4.11). The edge is measured
  // against the field's own fill, or the first opaque surface behind it.
  // Itinerary and Availability put fields in a --panel well, where a
  // transparent field would drop to 2.78:1.
  const CONTROL_PAGES = [
    "/design-system",
    "/dashboard/experiences/new/basic-info",
    "/dashboard/experiences/new/itinerary",
    "/dashboard/experiences/new/availability",
  ];
  for (const path of CONTROL_PAGES) {
    test(`every resting form-control edge clears 3:1 on ${path}`, async ({ page }) => {
      await page.goto(path);
      const controls = page.locator(".input, .select, .textarea, .input-wrap, .tile-alt");
      await expect(controls.first()).toBeVisible();

      const measured = await controls.evaluateAll((elements) => {
        const rgb = (value: string) => value.match(/[\d.]+/g)!.map(Number);
        const luminance = ([r, g, b]: number[]) => {
          const channel = (c: number) => {
            const s = c / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
        };
        const opaque = (value: string) => ((rgb(value)[3] ?? 1) === 1 ? rgb(value) : null);
        const surfaceUnder = (element: Element) => {
          for (let node: Element | null = element; node; node = node.parentElement) {
            const color = opaque(getComputedStyle(node).backgroundColor);
            if (color) return color;
          }
          return [255, 255, 255];
        };
        return elements
          // Invalid fields are meant to read red; this guards the resting edge.
          .filter((element) => element.getAttribute("aria-invalid") !== "true"
            && !element.querySelector("[aria-invalid=true]"))
          .map((element) => {
            const border = opaque(getComputedStyle(element).borderTopColor);
            const surface = luminance(surfaceUnder(element));
            // A see-through edge is no boundary at all.
            const edge = border ? luminance(border) : surface;
            const ratio = (Math.max(edge, surface) + 0.05) / (Math.min(edge, surface) + 0.05);
            const field = element.matches("input, select, textarea")
              ? (element as HTMLInputElement)
              : element.querySelector("input");
            const name = field?.labels?.[0]?.textContent?.trim()
              || field?.getAttribute("aria-label")
              || element.className;
            return { name, ratio: Math.round(ratio * 100) / 100 };
          });
      });

      expect(measured.length).toBeGreaterThan(0);
      for (const { name, ratio } of measured) {
        expect(ratio, `${name} edge`).toBeGreaterThanOrEqual(3);
      }
    });
  }

  test("the product is light only, whatever the OS prefers", async ({ browser }) => {
    // Light is the one theme. A dark OS setting must not flip any surface,
    // and no theme control should be left behind to suggest otherwise.
    const context = await browser.newContext({ colorScheme: "dark" });
    const page = await context.newPage();
    await page.goto("/design-system");

    const canvas = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--canvas").trim().toLowerCase(),
    );
    expect(canvas).toBe("#f5f7fb");
    await expect(page.getByRole("button", { name: /theme/i })).toHaveCount(0);
    await context.close();
  });

  test("the record drawer opens, and Escape closes it", async ({ page }) => {
    await page.goto("/design-system#c-overlays");
    await page.getByRole("button", { name: "Open record drawer" }).click();

    const drawer = page.getByRole("dialog", { name: /7 Day Immersive Experience/ });
    await expect(drawer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });
});
