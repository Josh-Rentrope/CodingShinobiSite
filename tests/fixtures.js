import { test as base, expect } from "@playwright/test";

// Shared test setup.
// The site pulls GSAP + Google Fonts from CDNs and embeds a heavy Three.js
// archive iframe that runs a WebGL animation loop. Blocking those keeps tests
// fast and hermetic — the palette and structure don't depend on them, and
// evolution.js already guards on window.gsap being absent.

const BLOCKED = /(cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|past-site\.html)/;

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route(BLOCKED, (route) => route.abort());
    await use(page);
  },
});

export { expect };

/** Open the site without waiting on slow external resources. */
export async function openSite(page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
}
