import { test, expect } from "@playwright/test";
import { seedQuiz } from "./seed.js";

test.describe("navigation (TOC + URL hash)", () => {
  test.beforeEach(async ({ page }) => {
    await seedQuiz(page);
  });

  test("TOC navigation scrolls to round", async ({ page }) => {
    const tocLinks = page.locator(".toc a");
    const secondLink = tocLinks.nth(1);
    const targetText = await secondLink.textContent();
    await secondLink.click();

    const titleSlide = page.locator(".slide .title-bar__field, .slide .q-text__field", { hasText: targetText });
    await expect(titleSlide.first()).toBeInViewport({ timeout: 3_000 });
  });

  test("scrolling to the top clears the url hash", async ({ page }) => {
    await page.evaluate(() => window.scrollTo({ top: 2000, behavior: "instant" }));
    await expect.poll(() => page.evaluate(() => location.hash)).not.toBe("");

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect.poll(() => page.evaluate(() => location.hash)).toBe("");
  });

  test("url hash updates while scrolling through sections", async ({ page }) => {
    const anchors = await page.locator(".toc a").evaluateAll((els) =>
      els.map((a) => a.getAttribute("href")?.slice(1)).filter(Boolean),
    );
    expect(anchors.length).toBeGreaterThan(2);

    // Pick an anchor past the intro so scrolling will clearly select a section.
    const target = anchors[2];
    await page.evaluate((id) => {
      document.getElementById(id)?.scrollIntoView({ behavior: "instant", block: "center" });
    }, target);

    await expect.poll(() => page.evaluate(() => location.hash)).toBe(`#${target}`);

    // Move to a different section and watch the hash follow.
    const other = anchors[anchors.length - 1];
    await page.evaluate((id) => {
      document.getElementById(id)?.scrollIntoView({ behavior: "instant", block: "center" });
    }, other);

    await expect.poll(() => page.evaluate(() => location.hash)).toBe(`#${other}`);
  });

  test("loads specific slide when anchor is in the URL", async ({ page }) => {
    // Pick a non-intro anchor from the already-loaded page, then reload with it in the URL.
    const anchors = await page.locator(".toc a").evaluateAll((els) =>
      els.map((a) => a.getAttribute("href")?.slice(1)).filter(Boolean),
    );
    const target = anchors[2];
    expect(target).toBeTruthy();

    const url = new URL(page.url());
    url.hash = target;
    await page.goto(url.toString());

    await page.locator(".slide").first().waitFor({ timeout: 10_000 });
    await expect(page.locator(`#${target}`)).toBeInViewport({ timeout: 3_000 });
    await expect.poll(() => page.evaluate(() => location.hash)).toBe(`#${target}`);
  });
});
