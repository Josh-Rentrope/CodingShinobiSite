// Reusable accessibility test helpers.
// These are TEMPLATES: adapt the selectors to your own project's UI and wire them
// into your specs. Nothing here is imported by the portfolio's tests.

import { expect } from "@playwright/test";

/**
 * Assert that a modal/dialog traps focus: pressing Tab repeatedly never moves
 * focus to an element outside the dialog.
 * @param {import("playwright").Page} page
 * @param {string} dialogSelector
 * @param {{ rounds?: number }} [options]
 */
export async function assertFocusTrap(page, dialogSelector, options = {}) {
  const { rounds = 8 } = options;
  for (let i = 0; i < rounds; i += 1) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate((sel) => {
      return Boolean(document.activeElement?.closest(sel));
    }, dialogSelector);
    expect(inside, `focus escaped the dialog after ${i + 1} Tab presses`).toBe(true);
  }
}
