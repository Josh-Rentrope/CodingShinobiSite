import { test, expect, openSite } from "./fixtures.js";

const palette = ".palette-root";
const openClass = "is-open";

test.beforeEach(async ({ page }) => {
  await openSite(page);
});

test("palette mounts with accessible dialog semantics", async ({ page }) => {
  const root = page.locator(palette);
  await expect(root).toHaveAttribute("role", "dialog");
  await expect(root).toHaveAttribute("aria-modal", "true");
  await expect(root).toBeHidden();
});

test("right-click on empty space opens the palette", async ({ page }) => {
  await page.mouse.click(640, 400, { button: "right" });
  await expect(page.locator(palette)).toHaveClass(new RegExp(openClass));
  await expect(page.locator(".palette-input")).toBeFocused();
});

test("right-click on a link keeps the native menu (palette stays closed)", async ({ page }) => {
  await page.locator(".wordmark").click({ button: "right" });
  await expect(page.locator(palette)).not.toHaveClass(new RegExp(openClass));
  await expect(page.locator(palette)).toBeHidden();
});

test("Control+K opens the palette", async ({ page }) => {
  await page.keyboard.press("Control+k");
  await expect(page.locator(palette)).toHaveClass(new RegExp(openClass));
  await expect(page.locator(".palette-input")).toBeFocused();
});

test("Escape closes the palette and restores focus", async ({ page }) => {
  const trigger = page.locator(".site-header");
  await trigger.click();
  await page.keyboard.press("Control+k");
  await page.keyboard.press("Escape");
  await expect(page.locator(palette)).not.toHaveClass(new RegExp(openClass));
  const activeTag = await page.evaluate(() => document.activeElement?.tagName);
  expect(activeTag).toBe("BODY");
});

test("clicking the overlay closes the palette", async ({ page }) => {
  await page.keyboard.press("Control+k");
  await page.mouse.click(20, 20);
  await expect(page.locator(palette)).not.toHaveClass(new RegExp(openClass));
});

test("typing filters the command list", async ({ page }) => {
  await page.keyboard.press("Control+k");
  await page.locator(".palette-input").fill("sys");
  const rows = page.locator(".palette-opt:not(.palette-hidden)");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("SYSTEMS");
});

test("typing gibberish shows an empty state", async ({ page }) => {
  await page.keyboard.press("Control+k");
  await page.locator(".palette-input").fill("zzzz-nothing-here");
  await expect(page.locator(".palette-opt:not(.palette-hidden)")).toHaveCount(0);
  await expect(page.locator(".palette-empty")).toBeVisible();
});

test("arrow keys move the active descendant highlight", async ({ page }) => {
  await page.keyboard.press("Control+k");
  const input = page.locator(".palette-input");
  await input.press("ArrowDown");
  let active = await input.getAttribute("aria-activedescendant");
  expect(active).not.toBe("");
  await input.press("ArrowDown");
  const second = await input.getAttribute("aria-activedescendant");
  expect(second).not.toBe(active);
});

test("Enter on the Systems command scrolls to the systems section", async ({ page }) => {
  await page.keyboard.press("Control+k");
  const input = page.locator(".palette-input");
  await input.fill("systems");
  await input.press("Enter");
  await expect(page.locator("#systems")).toBeInViewport();
  await expect(page).toHaveURL(/#systems/);
  await expect(page.locator(palette)).not.toHaveClass(new RegExp(openClass));
});

test("Tab stays trapped inside the palette panel", async ({ page }) => {
  await page.keyboard.press("Control+k");
  for (let i = 0; i < 6; i += 1) await page.keyboard.press("Tab");
  const inside = await page.evaluate(() => Boolean(document.activeElement?.closest(".palette-panel")));
  expect(inside).toBe(true);
});
