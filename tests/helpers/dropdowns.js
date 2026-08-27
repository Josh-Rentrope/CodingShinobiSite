// Reusable smart-test helpers for custom dropdown / select menus.
// These are TEMPLATES: adapt the selectors to your own project's UI and wire them
// into your specs. Nothing here is imported by the portfolio's tests.

/**
 * Open a custom dropdown by clicking its trigger.
 * @param {import("playwright").Page} page
 * @param {string} [triggerSelector]
 */
export async function openDropdown(page, triggerSelector = '[data-test="dropdown-trigger"]') {
  await page.locator(triggerSelector).click();
}

/**
 * Choose an option by visible text. Selects by clicking the matching option.
 * @param {import("playwright").Page} page
 * @param {string} optionText
 * @param {{ listSelector?: string, optionSelector?: string, activeAttribute?: string }} [options]
 */
export async function chooseOption(page, optionText, options = {}) {
  const {
    listSelector = '[data-test="dropdown-menu"]',
    optionSelector = '[role="option"]',
    activeAttribute = "aria-selected",
  } = options;

  const menu = page.locator(listSelector);
  await menu.waitFor();
  const opts = menu.locator(optionSelector);
  const count = await opts.count();
  if (count === 0) throw new Error(`Dropdown has no options to choose from (selector ${listSelector})`);

  for (let i = 0; i < count; i += 1) {
    const text = (await opts.nth(i).textContent()) ?? "";
    if (text.trim().includes(optionText)) {
      await opts.nth(i).click();
      return;
    }
  }
  throw new Error(`No option "${optionText}" found in dropdown ${listSelector}`);
}
