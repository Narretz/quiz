import { test, expect } from "@playwright/test";
import path from "path";
import { seedQuiz, buildSeedRecord } from "./seed.js";

const XLSX_PATH = path.resolve("tests/files/basic.xlsx");

test.describe("upload", () => {
  test("loads the page with upload button", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveText("Quiz Creator");
    await expect(page.locator("label .upload-btn")).toBeVisible();
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

  test("shows a main-menu error when upload fails to parse", async ({ page }) => {
    await page.goto("/");
    const fileInput = page.locator('input[type="file"][accept=".xlsx"]');
    // Feed a non-xlsx file — officeParser will throw.
    await fileInput.setInputFiles({ name: "broken.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from("not a real xlsx") });

    const errorBanner = page.locator(".main-status--error");
    await expect(errorBanner).toBeVisible({ timeout: 10_000 });
    await expect(errorBanner).toContainText("Error:");
    // Still on the home view (no slides were rendered).
    await expect(page.locator(".slide")).toHaveCount(0);
  });

  test("shows a main-menu error when a round is missing", async ({ page }) => {
    await page.goto("/");
    const fileInput = page.locator('input[type="file"][accept=".xlsx"]');
    await fileInput.setInputFiles(path.resolve("tests/files/missing-round.xlsx"));

    const errorBanner = page.locator(".main-status--error");
    await expect(errorBanner).toBeVisible({ timeout: 10_000 });
    await expect(errorBanner).toContainText("Expected 6 rounds, found 5");
    await expect(page.locator(".slide")).toHaveCount(0);
  });

  test("shows a main-menu error when the first round title is missing", async ({ page }) => {
    await page.goto("/");
    const fileInput = page.locator('input[type="file"][accept=".xlsx"]');
    await fileInput.setInputFiles(path.resolve("tests/files/missing-first-round-title.xlsx"));

    const errorBanner = page.locator(".main-status--error");
    await expect(errorBanner).toBeVisible({ timeout: 10_000 });
    await expect(errorBanner).toContainText("Expected 6 rounds, found 5");
    await expect(page.locator(".slide")).toHaveCount(0);
  });

  test("shows a main-menu error when a round has too many questions", async ({ page }) => {
    await page.goto("/");
    const fileInput = page.locator('input[type="file"][accept=".xlsx"]');
    await fileInput.setInputFiles(path.resolve("tests/files/too-many-questions.xlsx"));

    const errorBanner = page.locator(".main-status--error");
    await expect(errorBanner).toBeVisible({ timeout: 10_000 });
    await expect(errorBanner).toContainText("has 11 questions");
    await expect(page.locator(".slide")).toHaveCount(0);

    // Error banner includes a link to download the example xlsx.
    const exampleLink = errorBanner.locator("a[download]");
    await expect(exampleLink).toHaveAttribute("href", /example-quiz\.xlsx$/);
  });

  test("persists quiz and shows it in saved list", async ({ page }) => {
    await page.goto("/");
    const fileInput = page.locator('input[type="file"][accept=".xlsx"]');
    await fileInput.setInputFiles(XLSX_PATH);
    await expect(page.locator(".slide").first()).toBeVisible({ timeout: 10_000 });

    // Return to the main menu to see the saved-quizzes list.
    await page.locator(".home-btn").click();

    const options = page.locator(".saved-quizzes-select option[value]:not([value=''])");
    await expect(options).not.toHaveCount(0, { timeout: 5_000 });
  });
});

test.describe("main menu vs quiz view", () => {
  test("home view shows upload + saved select, hides quiz controls", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("label .upload-btn")).toBeVisible();
    await expect(page.locator(".howto")).toBeVisible();
    await expect(page.locator(".toc")).toHaveCount(0);
    await expect(page.locator(".home-btn")).toHaveCount(0);
  });

  test("quiz view hides upload + howto, shows home button", async ({ page }) => {
    await seedQuiz(page);
    await expect(page.locator("label .upload-btn")).toHaveCount(0);
    await expect(page.locator(".howto")).toHaveCount(0);
    await expect(page.locator(".saved-quizzes-select")).toHaveCount(0);
    await expect(page.locator(".home-btn")).toBeVisible();
  });

  test("home button returns to main menu and clears URL", async ({ page }) => {
    await seedQuiz(page);
    await expect(page.locator(".slide").first()).toBeVisible();

    await page.locator(".home-btn").click();

    await expect(page.locator("label .upload-btn")).toBeVisible();
    await expect(page.locator(".slide")).toHaveCount(0);
    expect(new URL(page.url()).searchParams.get("quiz")).toBeNull();
  });
});

test.describe("quiz name and date", () => {
  test.beforeEach(async ({ page }) => {
    await seedQuiz(page);
  });

  test("h1 falls back to the quiz id when no name is set", async ({ page }) => {
    const { id } = await buildSeedRecord();
    await expect(page.locator(".h1-quiz-name")).toHaveText(`— ${id}`);
  });

  test("editing name updates the h1 label and persists after reload", async ({ page }) => {
    const nameInput = page.locator(".setting-input--name");
    await nameInput.fill("Christmas Quiz");
    await nameInput.blur();

    await expect(page.locator(".h1-quiz-name")).toHaveText("— Christmas Quiz");

    // scheduleSave is debounced by 300ms — wait for it to flush before reload.
    await page.waitForTimeout(400);
    await page.reload();
    await page.locator(".slide").first().waitFor();
    await expect(page.locator(".h1-quiz-name")).toHaveText("— Christmas Quiz");
    await expect(page.locator(".setting-input--name")).toHaveValue("Christmas Quiz");
  });

  test("date input shows current quiz date and updates on change", async ({ page }) => {
    const { quiz } = await buildSeedRecord();
    const dateInput = page.locator(".setting-input--date");
    await expect(dateInput).toHaveValue(quiz.date);

    await dateInput.fill("2030-12-24");
    await dateInput.blur();

    await page.waitForTimeout(400);
    await page.reload();
    await page.locator(".slide").first().waitFor();
    await expect(page.locator(".setting-input--date")).toHaveValue("2030-12-24");
  });

  test("name input placeholder is the quiz id when name is empty", async ({ page }) => {
    const { id } = await buildSeedRecord();
    await expect(page.locator(".setting-input--name")).toHaveAttribute("placeholder", id);
  });
});

test.describe("new blank quiz", () => {
  test("creates 6 rounds (10+10+10+10+1+4 questions) with today's date", async ({ page }) => {
    await page.goto("/");
    await page.locator(".new-quiz-btn").click();

    await expect(page.locator(".slide").first()).toBeVisible({ timeout: 5_000 });

    const today = new Date().toISOString().split("T")[0];
    await expect(page.locator(".setting-input--date")).toHaveValue(today);

    // 5 intro + (11 title + 10 q) * 4 rounds + (11 title + 2 q) Name 10 round
    // with answers + antworten dividers + jackpot + break slides — just sanity check count and TOC labels.
    const tocLabels = await page.locator(".toc a").allTextContents();
    expect(tocLabels).toEqual([
      "Intro",
      "Round 1", "Round 2",
      "Round 1 Answers", "Round 2 Answers",
      "Round 3", "Round 4", "Name 10",
      "Round 3 Answers", "Round 4 Answers", "Name 10 Answers",
      "Jackpot!", "Jackpot! Answers",
    ]);
  });

  test("new quiz id uses today's date, appends (2) on collision", async ({ page }) => {
    await page.goto("/");
    await page.locator(".new-quiz-btn").click();
    await expect(page.locator(".slide").first()).toBeVisible({ timeout: 5_000 });

    const today = new Date().toISOString().split("T")[0];
    await expect.poll(() => new URL(page.url()).searchParams.get("quiz")).toBe(today);

    // Wait for the debounced save to flush so the second creation sees the collision.
    await page.waitForTimeout(400);
    // Go home and create a second blank — collision handling kicks in.
    await page.locator(".home-btn").click();
    await page.locator(".new-quiz-btn").click();
    await expect(page.locator(".slide").first()).toBeVisible({ timeout: 5_000 });

    await expect.poll(() => new URL(page.url()).searchParams.get("quiz")).toBe(`${today} (2)`);
  });
});

test.describe("saved quizzes select", () => {
  test("uses quiz.name when set, falls back to id otherwise", async ({ page }) => {
    await seedQuiz(page);
    const { id } = await buildSeedRecord();

    // Initially no name: option label == id.
    await page.locator(".home-btn").click();
    const select = page.locator(".saved-quizzes-select");
    await expect(select.locator(`option[value="${id}"]`)).toHaveText(id);

    // Load, set a name, reload the select via home button.
    await page.locator(".saved-quizzes-select").selectOption(id);
    await page.locator(".setting-input--name").fill("My Quiz");
    await page.locator(".setting-input--name").blur();
    // Wait for the debounced save to flush.
    await page.waitForTimeout(400);
    await page.locator(".home-btn").click();

    await expect(select.locator(`option[value="${id}"]`)).toHaveText("My Quiz");
  });

  test("selecting an option loads that quiz", async ({ page }) => {
    await seedQuiz(page);
    const { id } = await buildSeedRecord();
    await page.locator(".home-btn").click();

    await page.locator(".saved-quizzes-select").selectOption(id);

    await expect(page.locator(".slide").first()).toBeVisible({ timeout: 5_000 });
    await expect(page.locator(".home-btn")).toBeVisible();
  });
});
