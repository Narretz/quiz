import { test, expect } from "@playwright/test";
import path from "path";
import { seedQuiz } from "./seed.js";

const AUDIO = path.resolve("tests/audio/band-aid.mp3");

function questionOuter(page, id, answers = false) {
  return page.locator(`.slide-outer:has(.slide[data-slide-id="${id}"][data-answers="${answers ? 1 : 0}"])`);
}

function slideAudio(outer) {
  return outer.locator(".slide .slide-audio");
}

async function addAudio(outer, filePath) {
  await outer.scrollIntoViewIfNeeded();
  await outer.hover();
  const audioInput = outer.locator('.img-actions input[type="file"][accept="audio/*"]');
  await audioInput.setInputFiles(filePath);
  await expect(slideAudio(outer)).toBeVisible({ timeout: 5_000 });
}

async function hoverAndClickButton(outer, buttonText) {
  await outer.scrollIntoViewIfNeeded();
  await outer.hover();
  const btn = outer.locator("button", { hasText: buttonText });
  await expect(btn.first()).toBeVisible();
  await btn.first().click();
}

test.describe("audio", () => {
  test.beforeEach(async ({ page }) => {
    await seedQuiz(page);
  });

  test("+audio button adds audio to slide", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");
    await expect(slideAudio(outer)).not.toBeVisible();
    await addAudio(outer, AUDIO);

    const audio = slideAudio(outer);
    await expect(audio.locator("audio")).toBeVisible();
    await expect(audio.locator(".slide-audio__name")).toHaveText("band-aid.mp3");
  });

  test("remove audio button removes audio from slide", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");
    await addAudio(outer, AUDIO);
    await expect(slideAudio(outer)).toBeVisible();

    await hoverAndClickButton(outer, "remove audio");
    await expect(slideAudio(outer)).not.toBeVisible();
  });

  test("+audio button disappears after adding audio", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");
    await addAudio(outer, AUDIO);

    await outer.scrollIntoViewIfNeeded();
    await outer.hover();
    const addBtn = outer.locator(".img-actions button", { hasText: "+audio" });
    await expect(addBtn).not.toBeVisible();

    const removeBtn = outer.locator(".img-actions button", { hasText: "remove audio" });
    await expect(removeBtn).toBeVisible();
  });

  test("+audio button reappears after removing audio", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");
    await addAudio(outer, AUDIO);
    await hoverAndClickButton(outer, "remove audio");

    await outer.scrollIntoViewIfNeeded();
    await outer.hover();
    const addBtn = outer.locator(".img-actions button", { hasText: "+audio" });
    await expect(addBtn).toBeVisible();
  });

  test("audio is independent per slide — not linked between question and answer", async ({ page }) => {
    const question = questionOuter(page, "r0q0", false);
    const answer = questionOuter(page, "r0q0", true);

    await addAudio(question, AUDIO);
    await expect(slideAudio(question)).toBeVisible();

    // Answer slide should NOT have audio
    await answer.scrollIntoViewIfNeeded();
    await expect(slideAudio(answer)).not.toBeVisible();
  });

  test("question and answer slides can have audio independently", async ({ page }) => {
    const question = questionOuter(page, "r0q0", false);
    const answer = questionOuter(page, "r0q0", true);

    await addAudio(question, AUDIO);
    await addAudio(answer, AUDIO);

    await expect(slideAudio(question)).toBeVisible();
    await expect(slideAudio(answer)).toBeVisible();
  });

  test("removing audio from question does not affect answer audio", async ({ page }) => {
    const question = questionOuter(page, "r0q0", false);
    const answer = questionOuter(page, "r0q0", true);

    await addAudio(question, AUDIO);
    await addAudio(answer, AUDIO);

    await hoverAndClickButton(question, "remove audio");
    await expect(slideAudio(question)).not.toBeVisible();

    await answer.scrollIntoViewIfNeeded();
    await expect(slideAudio(answer)).toBeVisible();
  });

  test("audio coexists with image on the same slide", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");

    // Add image first
    await outer.scrollIntoViewIfNeeded();
    await outer.hover();
    const imgInput = outer.locator('.img-actions input[type="file"][accept="image/*"]');
    await imgInput.setInputFiles(path.resolve("tests/images/image-landscape.webp"));
    await expect(outer.locator(".slide .slide-img-wrap").first()).toBeVisible({ timeout: 5_000 });

    // Add audio
    await addAudio(outer, AUDIO);

    // Both should be visible
    await expect(outer.locator(".slide .slide-img-wrap").first()).toBeVisible();
    await expect(slideAudio(outer)).toBeVisible();
  });

  test("audio persists after page reload", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");
    await addAudio(outer, AUDIO);
    await expect(slideAudio(outer)).toBeVisible();

    // Wait for save to complete (debounced 300ms)
    await page.waitForTimeout(500);
    await page.reload();
    await page.locator(".slide").first().waitFor({ timeout: 10_000 });

    const outerAfter = questionOuter(page, "r0q0");
    await outerAfter.scrollIntoViewIfNeeded();
    await expect(slideAudio(outerAfter)).toBeVisible();
    await expect(slideAudio(outerAfter).locator(".slide-audio__name")).toHaveText("band-aid.mp3");
  });
});
