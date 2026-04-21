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

async function clearQuestionText(page, outer) {
  const slide = outer.locator(".slide");
  for (const lang of ["de", "en"]) {
    const field = slide.locator(`[lang="${lang}"] .q-text__field`);
    await field.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Enter");
  }
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

test.describe("full-screen image", () => {
  test.beforeEach(async ({ page }) => {
    await seedQuiz(page);
  });

  test("image fills slide when question text is cleared", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");
    await outer.scrollIntoViewIfNeeded();
    await clearQuestionText(page, outer);
    await addImage(outer, IMG.landscape);

    const slide = outer.locator(".slide");
    const img = slideImg(outer).first();
    const slideBox = await slide.boundingBox();
    const imgBox = await img.boundingBox();

    // Image should fill most of the slide (width or height > 80%)
    const widthRatio = imgBox.width / slideBox.width;
    const heightRatio = imgBox.height / slideBox.height;
    expect(Math.max(widthRatio, heightRatio)).toBeGreaterThan(0.8);

    // Image should be roughly centered
    const imgCenterX = imgBox.x + imgBox.width / 2;
    const slideCenterX = slideBox.x + slideBox.width / 2;
    expect(Math.abs(imgCenterX - slideCenterX)).toBeLessThan(slideBox.width * 0.1);

    const imgCenterY = imgBox.y + imgBox.height / 2;
    const slideCenterY = slideBox.y + slideBox.height / 2;
    expect(Math.abs(imgCenterY - slideCenterY)).toBeLessThan(slideBox.height * 0.1);
  });

  test("two images fill slide side by side when no text", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");
    await outer.scrollIntoViewIfNeeded();
    await clearQuestionText(page, outer);
    await addImage(outer, IMG.landscape);
    await addImage(outer, IMG.portrait);
    await expect(slideImg(outer)).toHaveCount(2, { timeout: 5_000 });

    const slide = outer.locator(".slide");
    const imgs = slideImg(outer);
    const slideBox = await slide.boundingBox();
    const box0 = await imgs.nth(0).boundingBox();
    const box1 = await imgs.nth(1).boundingBox();

    // Each image should take roughly half the slide width
    expect(box0.width).toBeLessThan(slideBox.width * 0.6);
    expect(box1.width).toBeLessThan(slideBox.width * 0.6);

    // Images should not overlap horizontally
    const left = box0.x < box1.x ? box0 : box1;
    const right = box0.x < box1.x ? box1 : box0;
    expect(left.x + left.width).toBeLessThanOrEqual(right.x + 2);
  });
});

test.describe("multiple images", () => {
  test.beforeEach(async ({ page }) => {
    await seedQuiz(page);
  });

  test("two images are positioned side by side", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");
    await addImage(outer, IMG.landscape);
    await addImage(outer, IMG.portrait);
    await expect(slideImg(outer)).toHaveCount(2, { timeout: 5_000 });

    const imgs = slideImg(outer);
    const box0 = await imgs.nth(0).boundingBox();
    const box1 = await imgs.nth(1).boundingBox();

    // Images should not overlap horizontally
    const left = box0.x < box1.x ? box0 : box1;
    const right = box0.x < box1.x ? box1 : box0;
    expect(left.x + left.width).toBeLessThanOrEqual(right.x + 2);
  });

  test("per-image remove × on first image keeps second", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");
    await addImage(outer, IMG.landscape);
    await addImage(outer, IMG.portrait);
    await expect(slideImg(outer)).toHaveCount(2, { timeout: 5_000 });

    const secondSrc = await slideImg(outer).nth(1).locator("img").getAttribute("src");

    // Hover slide to reveal per-image buttons, click remove on first
    await outer.locator(".slide").hover();
    const removeBtn = slideImg(outer).nth(0).locator(".slide-img-btns button", { hasText: "remove ×" });
    await expect(removeBtn).toBeVisible();
    await removeBtn.click();

    await expect(slideImg(outer)).toHaveCount(1);
    // Second image promoted to slot 0
    const remainingSrc = await slideImg(outer).first().locator("img").getAttribute("src");
    expect(remainingSrc).toEqual(secondSrc);
  });

  test("per-image remove × on second image keeps first", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");
    await addImage(outer, IMG.landscape);
    await addImage(outer, IMG.portrait);
    await expect(slideImg(outer)).toHaveCount(2, { timeout: 5_000 });

    const firstSrc = await slideImg(outer).nth(0).locator("img").getAttribute("src");

    await outer.locator(".slide").hover();
    const removeBtn = slideImg(outer).nth(1).locator(".slide-img-btns button", { hasText: "remove ×" });
    await expect(removeBtn).toBeVisible();
    await removeBtn.click();

    await expect(slideImg(outer)).toHaveCount(1);
    const remainingSrc = await slideImg(outer).first().locator("img").getAttribute("src");
    expect(remainingSrc).toEqual(firstSrc);
  });

  test("slide-level remove all img removes both images", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");
    await addImage(outer, IMG.landscape);
    await addImage(outer, IMG.portrait);
    await expect(slideImg(outer)).toHaveCount(2, { timeout: 5_000 });

    await hoverAndClickButton(outer, "remove all img");
    await expect(slideImg(outer)).toHaveCount(0);
  });

  test("slide-level remove all img also removes from linked slide", async ({ page }) => {
    const question = questionOuter(page, "r0q0", false);
    const answer = questionOuter(page, "r0q0", true);

    await addImage(question, IMG.landscape);
    await addImage(question, IMG.portrait);
    await expect(slideImg(question)).toHaveCount(2, { timeout: 5_000 });

    await answer.scrollIntoViewIfNeeded();
    await expect(slideImg(answer)).toHaveCount(2, { timeout: 5_000 });

    // Remove all from question (source)
    await hoverAndClickButton(question, "remove all img");
    await expect(slideImg(question)).toHaveCount(0);

    await answer.scrollIntoViewIfNeeded();
    await expect(slideImg(answer)).toHaveCount(0);
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
