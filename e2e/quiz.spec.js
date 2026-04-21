import { test, expect } from "@playwright/test";
import path from "path";
import { seedQuiz } from "./seed.js";

const XLSX_PATH = path.resolve("0112.xlsx");

test.describe("upload", () => {
  test("loads the page with upload button", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveText("Quiz XLSX to PPTX");
    await expect(page.locator("label.upload-btn")).toBeVisible();
  });

  test("uploads XLSX and renders slides", async ({ page }) => {
    await page.goto("/");
    const fileInput = page.locator('input[type="file"][accept=".xlsx"]');
    await fileInput.setInputFiles(XLSX_PATH);

    const slides = page.locator(".slide");
    await expect(slides.first()).toBeVisible({ timeout: 10_000 });

    const count = await slides.count();
    expect(count).toBeGreaterThan(20);

    await expect(page.locator(".status")).toContainText("rounds");
  });

  test("persists quiz and shows it in saved list", async ({ page }) => {
    await page.goto("/");
    const fileInput = page.locator('input[type="file"][accept=".xlsx"]');
    await fileInput.setInputFiles(XLSX_PATH);
    await expect(page.locator(".slide").first()).toBeVisible({ timeout: 10_000 });

    const savedItem = page.locator(".saved-quizzes .sq-item");
    await expect(savedItem.first()).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("quiz loaded", () => {
  test.beforeEach(async ({ page }) => {
    await seedQuiz(page);
  });

  test("renders slides from seeded data", async ({ page }) => {
    const count = await page.locator(".slide").count();
    expect(count).toBeGreaterThan(20);
    await expect(page.locator(".status")).toContainText("rounds");
  });

  test("shows download button", async ({ page }) => {
    const downloadBtn = page.locator("button", { hasText: "Download .pptx" });
    await expect(downloadBtn).toBeVisible();
    await expect(downloadBtn).toBeEnabled();
  });

  test("downloads PPTX file", async ({ page }) => {
    const downloadPromise = page.waitForEvent("download");
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

  test("can edit question text", async ({ page }) => {
    const questionSlide = page.locator('.slide[data-slide-id="r0q0"][data-answers="0"]');
    await questionSlide.scrollIntoViewIfNeeded();

    const deField = questionSlide.locator('[lang="de"] .q-text__field');
    await deField.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("Edited question text");
    await deField.press("Enter");

    await expect(deField).toHaveText("Edited question text");
  });

  test("TOC navigation scrolls to round", async ({ page }) => {
    const tocLinks = page.locator(".toc a");
    const secondLink = tocLinks.nth(1);
    const targetText = await secondLink.textContent();
    await secondLink.click();

    const titleSlide = page.locator(".slide .title-text", { hasText: targetText });
    await expect(titleSlide.first()).toBeInViewport({ timeout: 3_000 });
  });
});
