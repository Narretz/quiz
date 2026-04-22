import { test, expect } from "@playwright/test";
import path from "path";
import { seedQuiz } from "./seed.js";

const XLSX_PATH = path.resolve("tests/files/basic.xlsx");

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

  test("shows download button disabled until validated", async ({ page }) => {
    const downloadBtn = page.locator("button", { hasText: "Download .pptx" });
    await expect(downloadBtn).toBeVisible();
    await expect(downloadBtn).toBeDisabled();

    await page.locator("button", { hasText: "Validate" }).click();
    await expect(downloadBtn).toBeEnabled();
  });

  test("downloads PPTX file", async ({ page }) => {
    await page.locator("button", { hasText: "Validate" }).click();
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

  test("can edit question text", async ({ page }) => {
    const questionSlide = page.locator('.slide[data-slide-id="r0q0"][data-answers="0"]');
    await questionSlide.scrollIntoViewIfNeeded();

    const deField = questionSlide.locator('[lang="de"] .q-text__field');
    await deField.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("Edited question text");
    await deField.evaluate((el) => el.blur());

    await expect(deField).toHaveText("Edited question text");
  });

  test("Enter inserts a newline in question text instead of blurring", async ({ page }) => {
    const questionSlide = page.locator('.slide[data-slide-id="r0q0"][data-answers="0"]');
    await questionSlide.scrollIntoViewIfNeeded();

    const deField = questionSlide.locator('[lang="de"] .q-text__field');
    await deField.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("Line one");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Line two");

    // Field should still be focused (Enter did not blur)
    const isFocused = await deField.evaluate((el) => document.activeElement === el);
    expect(isFocused).toBe(true);

    // Blur and verify the newline was preserved
    await deField.evaluate((el) => el.blur());
    const text = await deField.evaluate((el) => el.innerText);
    expect(text).toContain("Line one");
    expect(text).toContain("Line two");
    expect(text.trim().split("\n").length).toBeGreaterThanOrEqual(2);
  });

  test("newlines in question text persist after reload", async ({ page }) => {
    const questionSlide = page.locator('.slide[data-slide-id="r0q0"][data-answers="0"]');
    await questionSlide.scrollIntoViewIfNeeded();

    const deField = questionSlide.locator('[lang="de"] .q-text__field');
    await deField.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("First line");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Second line");
    await deField.evaluate((el) => el.blur());
    await page.waitForTimeout(500);

    await page.reload();
    await page.locator(".slide").first().waitFor({ timeout: 10_000 });

    const reloaded = page.locator('.slide[data-slide-id="r0q0"][data-answers="0"] [lang="de"] .q-text__field');
    await reloaded.scrollIntoViewIfNeeded();
    const text = await reloaded.evaluate((el) => el.innerText);
    expect(text).toContain("First line");
    expect(text).toContain("Second line");
    expect(text.trim().split("\n").length).toBeGreaterThanOrEqual(2);
  });

  test("Enter still blurs answer fields", async ({ page }) => {
    const answerSlide = page.locator('.slide[data-slide-id="r0q0"][data-answers="1"]');
    await answerSlide.scrollIntoViewIfNeeded();

    const deField = answerSlide.locator(".answer-bar__field--de");
    await deField.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("Test answer");
    await deField.press("Enter");

    // Field should have blurred (Enter blurs answer fields)
    const isFocused = await deField.evaluate((el) => document.activeElement === el);
    expect(isFocused).toBe(false);
  });

  test("Tab cycles through DE question → EN question → DE answer → EN answer → next slide", async ({ page }) => {
    const slide = page.locator('.slide[data-slide-id="r0q0"][data-answers="0"]');
    await slide.scrollIntoViewIfNeeded();

    // Start at DE question
    const deField = slide.locator('[lang="de"] .q-text__field');
    await deField.click();

    // Tab → EN question
    await page.keyboard.press("Tab");
    const enField = slide.locator('[lang="en"] .q-text__field');
    await expect.poll(() => enField.evaluate((el) => el === document.activeElement)).toBe(true);

    // Tab → DE answer (ghost bar)
    await page.keyboard.press("Tab");
    const ansDeField = slide.locator(".answer-bar__field--de");
    await expect.poll(() => ansDeField.evaluate((el) => el === document.activeElement)).toBe(true);

    // Tab → EN answer (ghost bar)
    await page.keyboard.press("Tab");
    const ansEnField = slide.locator(".answer-bar__field--en");
    await expect.poll(() => ansEnField.evaluate((el) => el === document.activeElement)).toBe(true);

    // Tab → next slide (r0q1 question slide — questions are grouped before answers)
    await page.keyboard.press("Tab");
    const nextSlide = page.locator('.slide[data-slide-id="r0q1"][data-answers="0"]');
    const nextDe = nextSlide.locator('[lang="de"] .q-text__field');
    await expect.poll(() => nextDe.evaluate((el) => el === document.activeElement)).toBe(true);

    // Ghost answer bar on the next slide should be visible (focus-within triggers display)
    const nextGhostBar = nextSlide.locator(".answer-bar--ghost");
    await expect(nextGhostBar).toBeVisible();
  });

  test("question text field is inline when filled, inline-block when empty", async ({ page }) => {
    // Regression: filled fields must be `display: inline` so long text wraps
    // word-by-word next to the question number instead of the whole block
    // jumping to the next line. Empty fields need inline-block for a clickable
    // min-width/height target.
    const filledField = page.locator('.slide[data-slide-id="r0q0"][data-answers="0"] [lang="de"] .q-text__field');
    await filledField.scrollIntoViewIfNeeded();
    await expect(filledField).not.toHaveCSS("display", "inline-block");

    const emptySlide = page.locator('.slide[data-slide-id="r1q0"][data-answers="0"]');
    await emptySlide.scrollIntoViewIfNeeded();
    await emptySlide.hover();
    const emptyField = emptySlide.locator('[lang="de"] .q-text__field');
    await expect(emptyField).toHaveCSS("display", "inline-block");

    // After typing, it should switch to inline so text can wrap naturally
    await emptyField.click();
    await page.keyboard.type("Now filled");
    await expect(emptyField).not.toHaveCSS("display", "inline-block");
  });

  test("empty question slots are editable", async ({ page }) => {
    // r1 (Weihnachtslieder) has 0 questions in XLSX → 10 empty descriptor slots
    const slide = page.locator('.slide[data-slide-id="r1q0"][data-answers="0"]');
    await slide.scrollIntoViewIfNeeded();
    await slide.hover();

    // DE field should be visible and editable
    const deField = slide.locator('[lang="de"] .q-text__field');
    await deField.click();
    await page.keyboard.type("New question");
    await deField.evaluate((el) => el.blur());
    await expect(deField).toHaveText("New question");

    // EN field should appear on hover and be editable
    const enBlock = slide.locator('[lang="en"]');
    await expect(enBlock).toBeVisible();
    const enField = slide.locator('[lang="en"] .q-text__field');
    await enField.click();
    await page.keyboard.type("English question");
    await enField.evaluate((el) => el.blur());
    await expect(enField).toHaveText("English question");
  });

  test("ghost answer bar fades when question text is focused", async ({ page }) => {
    const slide = page.locator('.slide[data-slide-id="r0q0"][data-answers="0"]');
    await slide.scrollIntoViewIfNeeded();
    await slide.hover();

    const ghostBar = slide.locator(".answer-bar--ghost");
    await expect(ghostBar).toBeVisible();

    // Focus DE question text — ghost bar should fade but remain reachable via Tab
    const deField = slide.locator('[lang="de"] .q-text__field');
    await deField.click();
    await expect(ghostBar).toHaveCSS("opacity", "0.3");

    // Click outside to blur, then hover slide — ghost bar should return to full opacity
    await page.mouse.click(0, 0);
    await slide.hover();
    await expect(ghostBar).toBeVisible();
  });

  test("can edit answer from question slide ghost bar", async ({ page }) => {
    const questionSlide = page.locator('.slide[data-slide-id="r0q0"][data-answers="0"]');
    await questionSlide.scrollIntoViewIfNeeded();
    await questionSlide.hover();

    const ghostBar = questionSlide.locator(".answer-bar--ghost");
    await expect(ghostBar).toBeVisible();

    const deField = ghostBar.locator(".answer-bar__field--de");
    await deField.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("Ghost answer");
    await deField.press("Enter");

    // Verify it updated the answer slide too
    const answerSlide = page.locator('.slide[data-slide-id="r0q0"][data-answers="1"]');
    await answerSlide.scrollIntoViewIfNeeded();
    const ansBar = answerSlide.locator(".answer-bar .answer-bar__field--de");
    await expect(ansBar).toHaveText("Ghost answer");
  });

  test("can edit round title DE text", async ({ page }) => {
    const titleSlide = page.locator('.slide[data-slide-id="title-r0"]');
    await titleSlide.scrollIntoViewIfNeeded();

    const deField = titleSlide.locator(".title-bar__field").first();
    await deField.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("Edited Round");
    await deField.press("Enter");

    await expect(deField).toHaveText("Edited Round");
  });

  test("can add EN translation to round title", async ({ page }) => {
    const titleSlide = page.locator('.slide[data-slide-id="title-r0"]');
    await titleSlide.scrollIntoViewIfNeeded();
    await titleSlide.hover();

    const enTag = titleSlide.locator(".title-bar__tag--en");
    await enTag.click();

    const enField = titleSlide.locator(".title-bar__field").nth(1);
    await page.keyboard.type("English Title");
    await enField.press("Enter");

    await expect(enField).toHaveText("English Title");
  });

  test("round title edits sync between question and answer title slides", async ({ page }) => {
    const questionTitle = page.locator('.slide[data-slide-id="title-r0"]');
    const answerTitle = page.locator('.slide[data-slide-id="title-r0-ans"]');

    // Edit DE on the question-phase title
    await questionTitle.scrollIntoViewIfNeeded();
    const qDe = questionTitle.locator(".title-bar__field").first();
    await qDe.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("Synced DE");
    await qDe.press("Enter");

    // Answer-phase title should reflect the same DE text
    await answerTitle.scrollIntoViewIfNeeded();
    await expect(answerTitle.locator(".title-bar__field").first()).toHaveText("Synced DE");

    // Now edit EN on the answer-phase title — should propagate back to the question-phase title
    await answerTitle.hover();
    await answerTitle.locator(".title-bar__tag--en").click();
    const aEn = answerTitle.locator(".title-bar__field").nth(1);
    await page.keyboard.type("Synced EN");
    await aEn.press("Enter");

    await questionTitle.scrollIntoViewIfNeeded();
    await expect(questionTitle.locator(".title-bar__field").nth(1)).toHaveText("Synced EN");
  });

  test("round title edits persist after reload", async ({ page }) => {
    const titleSlide = page.locator('.slide[data-slide-id="title-r0"]');
    await titleSlide.scrollIntoViewIfNeeded();

    // Edit DE
    const deField = titleSlide.locator(".title-bar__field").first();
    await deField.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("Persisted DE");
    await deField.press("Tab");

    // Edit EN
    const enField = titleSlide.locator(".title-bar__field").nth(1);
    await page.keyboard.type("Persisted EN");
    await enField.press("Enter");

    await page.waitForTimeout(500);
    await page.reload();
    await page.locator(".slide").first().waitFor({ timeout: 10_000 });

    const reloadedTitle = page.locator('.slide[data-slide-id="title-r0"]');
    await reloadedTitle.scrollIntoViewIfNeeded();
    await expect(reloadedTitle.locator(".title-bar__field").first()).toHaveText("Persisted DE");
    await expect(reloadedTitle.locator(".title-bar__field").nth(1)).toHaveText("Persisted EN");
  });

  test("Antworten slide is not editable", async ({ page }) => {
    const antSlide = page.locator('.slide[data-slide-id="antworten-s0"]');
    await antSlide.scrollIntoViewIfNeeded();

    const editableFields = antSlide.locator(".title-bar__field");
    await expect(editableFields).toHaveCount(0);
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
