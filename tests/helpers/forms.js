// Reusable smart-test helpers for form flows.
// These are TEMPLATES: adapt the selectors to your own project's UI and wire them
// into your specs. Nothing here is imported by the portfolio's tests.

/**
 * Walk through a standard "reset password" workflow.
 * Fills the current/next/confirm password fields, submits, and waits for the
 * success state. `page` is a Playwright Page.
 *
 * @param {import("playwright").Page} page
 * @param {{ current?: string, next: string, confirm?: string }} creds
 * @param {{ currentInput?: string, nextInput?: string, confirmInput?: string, submit?: string, successSelector?: string }} [selectors]
 */
export async function fillPasswordResetFlow(page, creds, selectors = {}) {
  const sel = {
    currentInput: '[data-test="current-password"]',
    nextInput: '[data-test="new-password"]',
    confirmInput: '[data-test="confirm-password"]',
    submit: '[data-test="submit-reset"]',
    successSelector: '[data-test="reset-success"]',
    ...selectors,
  };

  if (creds.current) await page.locator(sel.currentInput).fill(creds.current);
  await page.locator(sel.nextInput).fill(creds.next);
  if (creds.confirm) await page.locator(sel.confirmInput).fill(creds.confirm);
  await page.locator(sel.submit).click();
  await page.locator(sel.successSelector).waitFor({ state: "visible" });
}

/**
 * Fill a password field and assert the strength meter updates to `expected`.
 * @param {import("playwright").Page} page
 * @param {string} value
 * @param {string} meterSelector
 * @param {"weak"|"medium"|"strong"} expected
 */
export async function assertPasswordStrength(page, value, meterSelector, expected) {
  await page.locator('[data-test="password"]').fill(value);
  await page.locator(meterSelector).filter({ hasText: expected }).waitFor({ state: "visible" });
}
