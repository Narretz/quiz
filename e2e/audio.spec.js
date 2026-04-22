import { test, expect } from "@playwright/test";
import path from "path";
import { seedQuiz } from "./seed.js";

const AUDIO = path.resolve("tests/files/band-aid.mp3");

function questionOuter(page, id, answers = false) {
  return page.locator(`.slide-outer:has(.slide[data-slide-id="${id}"][data-answers="${answers ? 1 : 0}"])`);
}

function slideAudioSlot(outer) {
  return outer.locator(".slide .slide-img-wrap .slide-audio-slot");
}

async function addAV(outer, filePath) {
  await outer.scrollIntoViewIfNeeded();
  await outer.hover();
  const avInput = outer.locator('.img-actions input[type="file"][accept="audio/*,video/*"]');
  await avInput.setInputFiles(filePath);
  await expect(slideAudioSlot(outer)).toBeVisible({ timeout: 5_000 });
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

  test("+av button adds audio to slide", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");
    await expect(slideAudioSlot(outer)).not.toBeVisible();
    await addAV(outer, AUDIO);

    const slot = slideAudioSlot(outer);
    await expect(slot.locator("audio")).toBeVisible();
    await expect(slot.locator(".slide-audio__name")).toHaveText("band-aid.mp3");
  });

  test("remove button removes audio from slide", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");
    await addAV(outer, AUDIO);
    await expect(slideAudioSlot(outer)).toBeVisible();

    await hoverAndClickButton(outer, "remove media");
    await expect(slideAudioSlot(outer)).not.toBeVisible();
  });

  test("+av button disappears after adding audio", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");
    await addAV(outer, AUDIO);

    await outer.scrollIntoViewIfNeeded();
    await outer.hover();
    const addBtn = outer.locator(".img-actions button", { hasText: "+av" });
    await expect(addBtn).not.toBeVisible();
  });

  test("+av button reappears after removing audio", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");
    await addAV(outer, AUDIO);
    await hoverAndClickButton(outer, "remove media");

    await outer.scrollIntoViewIfNeeded();
    await outer.hover();
    const addBtn = outer.locator(".img-actions button", { hasText: "+av" });
    await expect(addBtn).toBeVisible();
  });

  test("audio is NOT linked from question to answer", async ({ page }) => {
    const question = questionOuter(page, "r0q0", false);
    const answer = questionOuter(page, "r0q0", true);

    await addAV(question, AUDIO);
    await expect(slideAudioSlot(question)).toBeVisible();

    // Answer slide should NOT have audio
    await answer.scrollIntoViewIfNeeded();
    await expect(slideAudioSlot(answer)).not.toBeVisible();
  });

  test("audio coexists with image on the same slide", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");

    // Add image first
    await outer.scrollIntoViewIfNeeded();
    await outer.hover();
    const imgInput = outer.locator('.img-actions input[type="file"][accept="image/*"]');
    await imgInput.setInputFiles(path.resolve("tests/files/image-landscape.webp"));
    await expect(outer.locator(".slide .slide-img-wrap").first()).toBeVisible({ timeout: 5_000 });

    // Add audio
    await addAV(outer, AUDIO);

    // Both should be visible — image in one slot, audio in another
    const wraps = outer.locator(".slide .slide-img-wrap");
    await expect(wraps).toHaveCount(2);
    await expect(slideAudioSlot(outer)).toBeVisible();
  });

  test("+av hidden when audio present even with free image slot", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");
    await addAV(outer, AUDIO);

    await outer.scrollIntoViewIfNeeded();
    await outer.hover();
    // +av should be hidden (audio/video mutually exclusive)
    const avBtn = outer.locator(".img-actions button", { hasText: "+av" });
    await expect(avBtn).not.toBeVisible();
    // +img should still be available (one slot free)
    const imgBtn = outer.locator(".img-actions button", { hasText: "+img" });
    await expect(imgBtn).toBeVisible();
  });

  test("audio persists after page reload", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");
    await addAV(outer, AUDIO);
    await expect(slideAudioSlot(outer)).toBeVisible();

    // Wait for save to complete (debounced 300ms)
    await page.waitForTimeout(500);
    await page.reload();
    await page.locator(".slide").first().waitFor({ timeout: 10_000 });

    const outerAfter = questionOuter(page, "r0q0");
    await outerAfter.scrollIntoViewIfNeeded();
    await expect(slideAudioSlot(outerAfter)).toBeVisible();
    await expect(slideAudioSlot(outerAfter).locator(".slide-audio__name")).toHaveText("band-aid.mp3");
  });

  test("empty EN text field is clickable when audio is present", async ({ page }) => {
    // r1q0 has empty question slots — EN field starts empty
    const outer = questionOuter(page, "r1q0");
    await addAV(outer, AUDIO);

    const slide = outer.locator(".slide");
    await slide.hover();
    const enField = slide.locator('[lang="en"] .q-text__field');
    await enField.click();

    const isFocused = await enField.evaluate((el) => document.activeElement === el);
    expect(isFocused).toBe(true);

    await page.keyboard.type("Typed over audio");
    await enField.evaluate((el) => el.blur());
    await expect(enField).toHaveText("Typed over audio");
  });
});
