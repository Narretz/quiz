import { test, expect } from "@playwright/test";
import path from "path";
import { seedQuiz } from "./seed.js";

const IMG = {
  portrait: path.resolve("tests/images/image-portrait.jpg"),
  landscape: path.resolve("tests/images/image-landscape.webp"),
  square: path.resolve("tests/images/image-square.webp"),
  ultrawide: path.resolve("tests/images/image-ultrawide.png"),
};

function questionOuter(page, id, answers = false) {
  return page.locator(`.slide-outer:has(.slide[data-slide-id="${id}"][data-answers="${answers ? 1 : 0}"])`);
}

function slideImg(outer) {
  return outer.locator(".slide .slide-img-wrap");
}

async function addImage(outer, filePath) {
  await outer.scrollIntoViewIfNeeded();
  await outer.hover();
  const imgInput = outer.locator('.img-actions input[type="file"][accept="image/*"]');
  await imgInput.setInputFiles(filePath);
  await expect(slideImg(outer).first()).toBeVisible({ timeout: 5_000 });
}

async function hoverAndClickButton(outer, buttonText) {
  await outer.scrollIntoViewIfNeeded();
  await outer.hover();
  // Button may be in .img-actions (top bar) or .slide-img-btns (per-image overlay)
  const btn = outer.locator("button", { hasText: buttonText });
  await expect(btn.first()).toBeVisible();
  await btn.first().click();
}

test.describe("image positioning", () => {
  test.beforeEach(async ({ page }) => {
    await seedQuiz(page);
  });

  test("portrait image is placed on the right side", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");
    await addImage(outer, IMG.portrait);

    const slide = outer.locator(".slide");
    const img = slideImg(outer).first();
    const slideBox = await slide.boundingBox();
    const imgBox = await img.boundingBox();

    // Image should be in the right portion of the slide
    const imgCenter = imgBox.x + imgBox.width / 2;
    const slideMid = slideBox.x + slideBox.width / 2;
    expect(imgCenter).toBeGreaterThan(slideMid);

    // Image should be taller than wide (portrait)
    expect(imgBox.height).toBeGreaterThan(imgBox.width);
  });

  test("landscape image is placed in the bottom-right", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");
    await addImage(outer, IMG.landscape);

    const slide = outer.locator(".slide");
    const img = slideImg(outer).first();
    const slideBox = await slide.boundingBox();
    const imgBox = await img.boundingBox();

    // Right half
    const imgCenter = imgBox.x + imgBox.width / 2;
    const slideMid = slideBox.x + slideBox.width / 2;
    expect(imgCenter).toBeGreaterThan(slideMid);

    // Bottom half
    const imgMidY = imgBox.y + imgBox.height / 2;
    const slideMidY = slideBox.y + slideBox.height / 2;
    expect(imgMidY).toBeGreaterThan(slideMidY);
  });

  test("square image is placed in the bottom-right", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");
    await addImage(outer, IMG.square);

    const slide = outer.locator(".slide");
    const img = slideImg(outer).first();
    const slideBox = await slide.boundingBox();
    const imgBox = await img.boundingBox();

    const imgCenter = imgBox.x + imgBox.width / 2;
    const slideMid = slideBox.x + slideBox.width / 2;
    expect(imgCenter).toBeGreaterThan(slideMid);
  });

  test("ultrawide image is placed at the bottom, full width", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");
    await addImage(outer, IMG.ultrawide);

    const slide = outer.locator(".slide");
    const img = slideImg(outer).first();
    const slideBox = await slide.boundingBox();
    const imgBox = await img.boundingBox();

    // Bottom half
    const imgMidY = imgBox.y + imgBox.height / 2;
    const slideMidY = slideBox.y + slideBox.height / 2;
    expect(imgMidY).toBeGreaterThan(slideMidY);

    // Width should span most of the slide
    expect(imgBox.width).toBeGreaterThan(slideBox.width * 0.7);
  });
});

test.describe("image linking", () => {
  test.beforeEach(async ({ page }) => {
    await seedQuiz(page);
  });

  test("adding image to question slide propagates to answer slide", async ({ page }) => {
    const question = questionOuter(page, "r0q0", false);
    const answer = questionOuter(page, "r0q0", true);

    await addImage(question, IMG.landscape);

    // Answer slide should also have the image
    await answer.scrollIntoViewIfNeeded();
    await expect(slideImg(answer).first()).toBeVisible({ timeout: 5_000 });
  });

  test("answer slide can unlink image from question", async ({ page }) => {
    const question = questionOuter(page, "r0q0", false);
    const answer = questionOuter(page, "r0q0", true);

    await addImage(question, IMG.landscape);
    await expect(slideImg(answer).first()).toBeVisible({ timeout: 5_000 });

    // Unlink from answer slide
    await hoverAndClickButton(answer, "unlink img");

    // Answer should no longer have an image
    await expect(slideImg(answer)).toHaveCount(0);

    // Question should still have its image
    await question.scrollIntoViewIfNeeded();
    await expect(slideImg(question).first()).toBeVisible();
  });

  test("answer slide can relink image after unlinking", async ({ page }) => {
    const question = questionOuter(page, "r0q0", false);
    const answer = questionOuter(page, "r0q0", true);

    await addImage(question, IMG.landscape);
    await expect(slideImg(answer).first()).toBeVisible({ timeout: 5_000 });

    // Unlink
    await hoverAndClickButton(answer, "unlink img");
    await expect(slideImg(answer)).toHaveCount(0);

    // Relink
    await hoverAndClickButton(answer, "relink");
    await expect(slideImg(answer).first()).toBeVisible({ timeout: 5_000 });
  });

  test("answer slide can have its own independent image after unlinking", async ({ page }) => {
    const question = questionOuter(page, "r0q0", false);
    const answer = questionOuter(page, "r0q0", true);

    // Add landscape to question (propagates to answer)
    await addImage(question, IMG.landscape);
    await expect(slideImg(answer).first()).toBeVisible({ timeout: 5_000 });

    // Unlink answer, then add a different image
    await hoverAndClickButton(answer, "unlink img");
    await expect(slideImg(answer)).toHaveCount(0);
    await addImage(answer, IMG.portrait);

    // Both slides should have images, but different ones
    await question.scrollIntoViewIfNeeded();
    const qImg = await slideImg(question).first().locator("img").getAttribute("src");
    await answer.scrollIntoViewIfNeeded();
    const aImg = await slideImg(answer).first().locator("img").getAttribute("src");
    expect(qImg).not.toEqual(aImg);
  });
});

test.describe("image action buttons", () => {
  test.beforeEach(async ({ page }) => {
    await seedQuiz(page);
  });

  test("+img button adds image to slide", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");
    await expect(slideImg(outer)).toHaveCount(0);
    await addImage(outer, IMG.landscape);
    await expect(slideImg(outer)).toHaveCount(1);
  });

  test("remove img button removes image from slide and linked slide", async ({ page }) => {
    const question = questionOuter(page, "r0q0", false);
    const answer = questionOuter(page, "r0q0", true);

    await addImage(question, IMG.landscape);
    await expect(slideImg(answer).first()).toBeVisible({ timeout: 5_000 });

    // Remove from question (source) — should remove from both
    await hoverAndClickButton(question, "remove img");
    await expect(slideImg(question)).toHaveCount(0);
    await answer.scrollIntoViewIfNeeded();
    await expect(slideImg(answer)).toHaveCount(0);
  });

  test("remove img from linked button only removes from answer", async ({ page }) => {
    const question = questionOuter(page, "r0q0", false);
    const answer = questionOuter(page, "r0q0", true);

    await addImage(question, IMG.landscape);
    await expect(slideImg(answer).first()).toBeVisible({ timeout: 5_000 });

    // Use "remove img from linked" on question slide
    await hoverAndClickButton(question, "remove img from linked");

    // Question should still have its image
    await question.scrollIntoViewIfNeeded();
    await expect(slideImg(question).first()).toBeVisible();

    // Answer should not
    await answer.scrollIntoViewIfNeeded();
    await expect(slideImg(answer)).toHaveCount(0);
  });

  test("per-image remove × button removes that image", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");
    await addImage(outer, IMG.landscape);
    await expect(slideImg(outer)).toHaveCount(1);

    // Hover the image itself to get the per-image buttons
    await outer.scrollIntoViewIfNeeded();
    await outer.locator(".slide").hover();
    const removeBtn = outer.locator(".slide-img-btns button", { hasText: "remove ×" });
    await expect(removeBtn).toBeVisible();
    await removeBtn.click();

    await expect(slideImg(outer)).toHaveCount(0);
  });

  test("navigate button scrolls to paired slide", async ({ page }) => {
    const question = questionOuter(page, "r0q0", false);
    await question.scrollIntoViewIfNeeded();
    await question.hover();

    // Click "↓ answer" button
    const navBtn = question.locator("button", { hasText: "answer" });
    await expect(navBtn).toBeVisible();
    await navBtn.click();

    // Answer slide should be in viewport
    const answerSlide = page.locator('.slide[data-slide-id="r0q0"][data-answers="1"]');
    await expect(answerSlide).toBeInViewport({ timeout: 3_000 });
  });
});
