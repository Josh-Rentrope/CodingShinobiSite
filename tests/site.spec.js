import { test, expect, openSite } from "./fixtures.js";

const SCENES = ["origin", "lineage", "systems", "worlds", "architecture", "gallery", "current"];

test("portfolio loads with the expected identity", async ({ page }) => {
  await openSite(page);
  await expect(page).toHaveTitle(/Coding Shinobi/);
  await expect(page.locator("#story")).toBeVisible();
  await expect(page.locator(".site-header")).toBeVisible();
});

test("all seven chapters are present as data-scene sections", async ({ page }) => {
  await openSite(page);
  await expect(page.locator("[data-scene]")).toHaveCount(SCENES.length);
  for (const id of SCENES) {
    await expect(page.locator(`#${id}`)).toHaveAttribute("data-scene", id);
  }
});

test("the background canvas renders", async ({ page }) => {
  await openSite(page);
  const canvas = page.locator("#evolution-canvas");
  await expect(canvas).toBeVisible();
  const { width, height } = await canvas.evaluate((el) => ({ width: el.width, height: el.height }));
  expect(width).toBeGreaterThan(0);
  expect(height).toBeGreaterThan(0);
});

test("chapter links navigate to their anchor and highlight active state", async ({ page }) => {
  await openSite(page);
  const systemsLink = page.locator('[data-chapter-link="systems"]');
  await systemsLink.click();
  await expect(page).toHaveURL(/#systems/);
  await expect(systemsLink).toHaveClass(/active/);
});

test("the past-site archive preview iframe is wired", async ({ page }) => {
  await openSite(page);
  const iframe = page.locator("iframe[src='past-site.html']");
  await expect(iframe).toBeVisible();
});
