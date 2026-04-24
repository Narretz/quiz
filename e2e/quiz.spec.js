import { test, expect } from "@playwright/test";
import path from "path";
import { seedQuiz } from "./seed.js";

test.describe("quiz loaded", () => {
  test.beforeEach(async ({ page }) => {
    await seedQuiz(page);
  });

  test("renders slides from seeded data", async ({ page }) => {
    const count = await page.locator(".slide").count();
    expect(count).toBeGreaterThan(20);
    await expect(page.locator(".status")).toContainText("rounds");
  });

  test("shows download button disabled until validated", async ({ page }) => {
    const downloadBtn = page.locator("button", { hasText: "Download .pptx" });
    await expect(downloadBtn).toBeVisible();
    await expect(downloadBtn).toBeDisabled();

    await page.locator("button", { hasText: "Show Validation" }).click();
    await expect(downloadBtn).toBeEnabled();
  });

  test("downloads PPTX file", async ({ page }) => {
    await page.locator("button", { hasText: "Show Validation" }).click();
    const downloadPromise = page.waitForEvent("download", {timeout: 45000});
    await page.locator("button", { hasText: "Download .pptx" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^quiz-.*\.pptx$/);
  });

  test("renders intro slides with expected content", async ({ page }) => {
    const firstSlide = page.locator(".slide").first();
    await expect(firstSlide.locator("img").first()).toBeVisible();
  });

  test("shows hover actions outside the slide", async ({ page }) => {
    const questionOuter = page.locator('.slide-outer:has(.slide[data-slide-id^="r0q"])').first();
    await questionOuter.scrollIntoViewIfNeeded();
    await questionOuter.hover();

    const actions = questionOuter.locator(".img-actions");
    await expect(actions).toBeVisible();

    const slideBox = await questionOuter.locator(".slide").boundingBox();
    const actionsBox = await actions.boundingBox();
    expect(actionsBox.y + actionsBox.height).toBeLessThanOrEqual(slideBox.y + 1);
  });

  test("can add image to a slide", async ({ page }) => {
    const questionOuter = page.locator('.slide-outer:has(.slide[data-slide-id="r0q0"][data-answers="0"])');
    await questionOuter.scrollIntoViewIfNeeded();
    await questionOuter.hover();

    const addImgBtn = questionOuter.locator("button", { hasText: "+img" });
    await expect(addImgBtn).toBeVisible();

    const imgInput = questionOuter.locator('.img-actions input[type="file"][accept="image/*"]');
    await imgInput.setInputFiles(path.resolve("lib/assets/pub-quiz-toucan.jpg"));

    const slideImg = questionOuter.locator(".slide .slide-img-wrap img");
    await expect(slideImg).toBeVisible({ timeout: 5_000 });
  });

  test("goodbye slide is rendered after jackpot answers", async ({ page }) => {
    const lastSlide = page.locator(".slide").last();
    await lastSlide.scrollIntoViewIfNeeded();
    await expect(lastSlide).toContainText("See you again next week");
  });

  test("jackpot input updates rules slide", async ({ page }) => {
    const jackpotInput = page.locator('.setting-input[type="number"]');
    await jackpotInput.fill("250");
    await jackpotInput.press("Enter");

    // Second slide is the rules slide (index 1)
    const rulesSlide = page.locator(".slide").nth(1);
    await rulesSlide.scrollIntoViewIfNeeded();
    await expect(rulesSlide).toContainText("250 €");
  });

  test("jackpot input shows 0 by default", async ({ page }) => {
    const rulesSlide = page.locator(".slide").nth(1);
    await rulesSlide.scrollIntoViewIfNeeded();
    await expect(rulesSlide).toContainText("0 €");
  });

  test("jackpot input adds subtitle to Jackpot title slide", async ({ page }) => {
    const jackpotInput = page.locator('.setting-input[type="number"]');
    await jackpotInput.fill("300");
    await jackpotInput.press("Enter");

    const jackpotTitle = page.locator('.slide[data-slide-id="title-r5"]');
    await jackpotTitle.scrollIntoViewIfNeeded();
    // 50 extra for today
    await expect(jackpotTitle).toContainText("ca. 350 €");

    const jackpotAnsTitle = page.locator('.slide[data-slide-id="title-r5-ans"]');
    await jackpotAnsTitle.scrollIntoViewIfNeeded();
    // 50 extra for today
    await expect(jackpotTitle).toContainText("ca. 350 €");

  });

  test("email input updates goodbye slide", async ({ page }) => {
    const emailInput = page.locator('.setting-input--email');
    await emailInput.fill("quiz@test.de");
    await emailInput.dispatchEvent("change");

    const lastSlide = page.locator(".slide").last();
    await lastSlide.scrollIntoViewIfNeeded();
    await expect(lastSlide).toContainText("quiz@test.de");
  });

  test("jackpot and email persist after reload", async ({ page }) => {
    const jackpotInput = page.locator('.setting-input[type="number"]');
    await jackpotInput.fill("180");
    await jackpotInput.press("Enter");

    const emailInput = page.locator('.setting-input--email');
    await emailInput.fill("persist@test.de");
    await emailInput.dispatchEvent("change");

    // Wait for save
    await page.waitForTimeout(500);
    await page.reload();
    await page.locator(".slide").first().waitFor({ timeout: 10_000 });

    await expect(page.locator('.setting-input[type="number"]')).toHaveValue("180");
    await expect(page.locator('.setting-input--email')).toHaveValue("persist@test.de");
  });
});
