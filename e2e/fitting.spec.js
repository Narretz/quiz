import { test, expect } from "@playwright/test";
import path from "path";
import { seedQuiz } from "./seed.js";

const IMG_PORTRAIT = path.resolve("tests/files/image-portrait.jpg");
const IMG_LANDSCAPE = path.resolve("tests/files/image-landscape.webp");

const LONG_DE = "Im vergangenen Monat wurde bekannt, dass die Lieblingsburgerkette von Barack Obama vor der Insolvenz steht. Am Freitag schloss dann die erste Filiale von Five Guys. Besser läuft es für eine Berliner Kultmarke, die vom Szene-Imbiss zum ernstzunehmenden Player wurde. Mit einem durchschnittlichen Umsatz von 3,25 Millionen Euro pro Standort setzt sich die Marke damit hinter McDonald's auf Platz 2. Welche Kette suche ich?";
const LONG_EN = "Last month, it was announced that Barack Obama's favorite burger chain was facing bankruptcy. On Friday, the first Five Guys branch closed. Things are going better for a cult Berlin brand that has gone from being a trendy snack bar to a serious player. With average sales of €3.25 million per location, the brand ranks second behind McDonald's. Which chain am I looking for?";

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

async function getComputedFontSize(el) {
  return el.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
}

async function hoverAndClickButton(outer, buttonText) {
  await outer.scrollIntoViewIfNeeded();
  await outer.hover();
  const btn = outer.locator("button", { hasText: buttonText });
  await expect(btn.first()).toBeVisible();
  await btn.first().click();
}

test.describe("text fitting", () => {
  test("answer slide text does not overlap answer bar", async ({ page }) => {
    await seedQuiz(page, {
      questions: { r0q0: { text: { de: LONG_DE, en: LONG_EN }, answers: { de: "Burgermeister", en: "Burgermeister" } } },
    });
    const outer = questionOuter(page, "r0q0", true);
    await outer.scrollIntoViewIfNeeded();

    const en = outer.locator('.slide [data-role="en"]');
    const bar = outer.locator(".slide .answer-bar--filled");
    const enBox = await en.boundingBox();
    const barBox = await bar.boundingBox();

    expect(enBox.y + enBox.height).toBeLessThanOrEqual(barBox.y + 2);
  });

  test("portrait image + answer slide reduces font size, removing image restores it", async ({ page }) => {
    await seedQuiz(page, {
      questions: { r0q0: { text: { de: LONG_DE, en: LONG_EN }, answers: { de: "Burgermeister", en: "Burgermeister" } } },
    });
    const question = questionOuter(page, "r0q0", false);
    const answer = questionOuter(page, "r0q0", true);

    // Add portrait image on question slide (links to answer)
    await addImage(question, IMG_PORTRAIT);

    const de = answer.locator('.slide [data-role="de"]');
    const reducedSize = await getComputedFontSize(de);
    // With narrow portrait text + answer bar, font must shrink below default 16px (20pt * 0.8)
    expect(reducedSize).toBeLessThan(16);

    // Remove image — font should recover
    await hoverAndClickButton(question, "remove media");
    await expect(slideImg(question)).toHaveCount(0);
    await page.waitForTimeout(200);

    const restoredSize = await getComputedFontSize(de);
    expect(restoredSize).toBeGreaterThan(reducedSize);
  });

  test("portrait image + answer slide text stays above answer bar", async ({ page }) => {
    await seedQuiz(page, {
      questions: { r0q0: { text: { de: LONG_DE, en: LONG_EN }, answers: { de: "Burgermeister", en: "Burgermeister" } } },
    });
    const outer = questionOuter(page, "r0q0", true);
    await addImage(outer, IMG_PORTRAIT);

    const en = outer.locator('.slide [data-role="en"]');
    const bar = outer.locator(".slide .answer-bar--filled");
    const enBox = await en.boundingBox();
    const barBox = await bar.boundingBox();

    expect(enBox.y + enBox.height).toBeLessThanOrEqual(barBox.y + 2);
  });

  test("long answer text triggers re-fit, shortening answer recovers font size", async ({ page }) => {
    const longAnswer = "Eine sehr lange Antwort die definitiv umbrechen wird";
    await seedQuiz(page, {
      questions: {
        r0q0: {
          text: { de: LONG_DE, en: LONG_EN },
          answers: { de: longAnswer, en: "A very long answer that will definitely wrap to the next line" },
        },
      },
    });
    const outer = questionOuter(page, "r0q0", true);
    await outer.scrollIntoViewIfNeeded();

    const de = outer.locator('.slide [data-role="de"]');
    const en = outer.locator('.slide [data-role="en"]');
    const bar = outer.locator(".slide .answer-bar--filled");

    // Text must not overlap the tall answer bar
    const enBox = await en.boundingBox();
    const barBox = await bar.boundingBox();
    expect(enBox.y + enBox.height).toBeLessThanOrEqual(barBox.y + 2);

    const reducedSize = await getComputedFontSize(de);

    // Shorten the answer — click DE field, clear, type short answer
    const ansDeField = outer.locator(".answer-bar__field--de");
    await ansDeField.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("Kurz");
    await page.keyboard.press("Tab");
    // Clear EN field too
    const ansEnField = outer.locator(".answer-bar__field--en");
    await ansEnField.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("Short");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);

    const restoredSize = await getComputedFontSize(de);
    expect(restoredSize).toBeGreaterThanOrEqual(reducedSize);
  });

});

test.describe("debug mode overrides", () => {
  test("debug inputs are hidden without ?debug=true", async ({ page }) => {
    await seedQuiz(page);
    const outer = questionOuter(page, "r0q0");
    await addImage(outer, IMG_LANDSCAPE);

    await outer.scrollIntoViewIfNeeded();
    await outer.hover();

    const fsInput = outer.locator(".slide-fs-input");
    await expect(fsInput).not.toBeVisible();
  });

  test("debug inputs are visible with ?debug=true", async ({ page }) => {
    await seedQuiz(page);
    // Re-navigate with debug flag
    const url = page.url();
    await page.goto(url + (url.includes("?") ? "&" : "?") + "debug=true");
    await page.locator(".slide").first().waitFor({ timeout: 10_000 });

    const outer = questionOuter(page, "r0q0");
    await addImage(outer, IMG_LANDSCAPE);

    await outer.scrollIntoViewIfNeeded();
    await outer.hover();

    const fsInput = outer.locator(".slide-fs-input");
    await expect(fsInput).toBeVisible();
  });

  test("manual override changes font size and takes effect", async ({ page }) => {
    await seedQuiz(page, {
      questions: { r0q0: { text: { de: LONG_DE, en: LONG_EN } } },
    });
    const url = page.url();
    await page.goto(url + (url.includes("?") ? "&" : "?") + "debug=true");
    await page.locator(".slide").first().waitFor({ timeout: 10_000 });

    const outer = questionOuter(page, "r0q0");
    await addImage(outer, IMG_LANDSCAPE);

    await outer.scrollIntoViewIfNeeded();
    await outer.hover();

    const fsInput = outer.locator(".slide-fs-input");
    await fsInput.fill("14");
    await fsInput.dispatchEvent("change");

    // Wait for fitting to apply
    await page.waitForTimeout(300);

    const de = outer.locator('.slide [data-role="de"]');
    const fontSize = await getComputedFontSize(de);
    // 14pt * 0.8 PT_SCALE = 11.2px
    expect(fontSize).toBeCloseTo(11.2, 0);
  });

  test("reset button appears when manual override is set", async ({ page }) => {
    await seedQuiz(page, {
      questions: { r0q0: { text: { de: LONG_DE, en: LONG_EN } } },
    });
    const url = page.url();
    await page.goto(url + (url.includes("?") ? "&" : "?") + "debug=true");
    await page.locator(".slide").first().waitFor({ timeout: 10_000 });

    const outer = questionOuter(page, "r0q0");
    await addImage(outer, IMG_LANDSCAPE);
    await outer.scrollIntoViewIfNeeded();
    await outer.hover();

    const resetBtn = outer.locator("button", { hasText: "auto" });
    // No manual override yet — reset button hidden
    await expect(resetBtn).not.toBeVisible();

    // Set a manual override
    const fsInput = outer.locator(".slide-fs-input");
    await fsInput.fill("15");
    await fsInput.dispatchEvent("change");
    await page.waitForTimeout(300);

    await outer.hover();
    await expect(resetBtn).toBeVisible();
  });

  test("reset button clears override and returns to auto-fitting", async ({ page }) => {
    await seedQuiz(page, {
      questions: { r0q0: { text: { de: LONG_DE, en: LONG_EN } } },
    });
    const url = page.url();
    await page.goto(url + (url.includes("?") ? "&" : "?") + "debug=true");
    await page.locator(".slide").first().waitFor({ timeout: 10_000 });

    const outer = questionOuter(page, "r0q0");
    await addImage(outer, IMG_LANDSCAPE);
    await outer.scrollIntoViewIfNeeded();
    await outer.hover();

    // Set override to a very small font
    const fsInput = outer.locator(".slide-fs-input");
    await fsInput.fill("12");
    await fsInput.dispatchEvent("change");
    await page.waitForTimeout(300);

    const de = outer.locator('.slide [data-role="de"]');
    const forcedSize = await getComputedFontSize(de);
    expect(forcedSize).toBeCloseTo(9.6, 0); // 12pt * 0.8

    // Click reset
    await outer.hover();
    const resetBtn = outer.locator("button", { hasText: "auto" });
    await resetBtn.click();
    await page.waitForTimeout(300);

    // Font should return to auto-fitted size (larger than 12pt)
    const autoSize = await getComputedFontSize(de);
    expect(autoSize).toBeGreaterThan(forcedSize);

    // Reset button should disappear
    await outer.hover();
    await expect(resetBtn).not.toBeVisible();
  });

  test("manual override persists after reload", async ({ page }) => {
    await seedQuiz(page, {
      questions: { r0q0: { text: { de: LONG_DE, en: LONG_EN } } },
    });
    const url = page.url();
    await page.goto(url + (url.includes("?") ? "&" : "?") + "debug=true");
    await page.locator(".slide").first().waitFor({ timeout: 10_000 });

    const outer = questionOuter(page, "r0q0");
    await addImage(outer, IMG_LANDSCAPE);
    await outer.scrollIntoViewIfNeeded();
    await outer.hover();

    // Set override
    const fsInput = outer.locator(".slide-fs-input");
    await fsInput.fill("14");
    await fsInput.dispatchEvent("change");
    await page.waitForTimeout(500);

    // Reload with debug
    await page.reload();
    await page.locator(".slide").first().waitFor({ timeout: 10_000 });

    const outerAfter = questionOuter(page, "r0q0");
    await outerAfter.scrollIntoViewIfNeeded();
    await outerAfter.hover();

    // Reset button should be visible (override persisted)
    const resetBtn = outerAfter.locator("button", { hasText: "auto" });
    await expect(resetBtn).toBeVisible();

    // Font size should still be overridden
    const de = outerAfter.locator('.slide [data-role="de"]');
    const fontSize = await getComputedFontSize(de);
    expect(fontSize).toBeCloseTo(11.2, 0); // 14pt * 0.8
  });
});
