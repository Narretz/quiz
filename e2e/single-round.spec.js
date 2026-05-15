import { test, expect } from "@playwright/test";

test.describe("single-round quiz", () => {
  test("create button uses the number input to choose question count", async ({ page }) => {
    await page.goto("/");

    const input = page.locator(".single-round-create input[type='number']");
    await input.fill("3");

    const btn = page.locator(".new-single-round-btn");
    await expect(btn).toHaveText(/Create 3-question round/);
    await btn.click();

    await expect(page.locator(".slide").first()).toBeVisible({ timeout: 5_000 });

    // Slide layout: question phase (title + 3 questions) + answer phase (title + 3 answers), no Antworten divider.
    await expect(page.locator('.slide[data-slide-id="title-r0"]')).toHaveCount(1);
    await expect(page.locator('.slide[data-slide-id="title-r0-ans"]')).toHaveCount(1);
    await expect(page.locator('.slide[data-answers="0"][data-slide-id^="r0q"]')).toHaveCount(3);
    await expect(page.locator('.slide[data-answers="1"][data-slide-id^="r0q"]')).toHaveCount(3);

    // No intro slides, no Antworten divider, no goodbye/break/points/prizes/no-phones.
    await expect(page.locator('.slide[data-slide-id="intro-0"]')).toHaveCount(0);
    await expect(page.locator('.slide[data-slide-id^="antworten"]')).toHaveCount(0);
  });

  test("defaults to 10 questions and shows just one TOC entry", async ({ page }) => {
    await page.goto("/");
    await page.locator(".new-single-round-btn").click();
    await expect(page.locator(".slide").first()).toBeVisible({ timeout: 5_000 });

    await expect(page.locator('.slide[data-answers="0"][data-slide-id^="r0q"]')).toHaveCount(10);
    await expect(page.locator('.slide[data-answers="1"][data-slide-id^="r0q"]')).toHaveCount(10);

    const tocLabels = await page.locator(".toc a").allTextContents();
    expect(tocLabels).toEqual(["Round 1", "Round 1 Answers"]);
  });

  test("renaming the round updates the single TOC entry", async ({ page }) => {
    await page.goto("/");
    await page.locator(".single-round-create input[type='number']").fill("2");
    await page.locator(".new-single-round-btn").click();
    await expect(page.locator(".slide").first()).toBeVisible({ timeout: 5_000 });

    const titleField = page.locator('.slide[data-slide-id="title-r0"] .title-bar__field').first();
    await titleField.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("Quickfire");
    await titleField.press("Enter");

    const labels = await page.locator(".toc a").allTextContents();
    expect(labels).toEqual(["Quickfire", "Quickfire Answers"]);
  });

  test("persists shape after reload", async ({ page }) => {
    await page.goto("/");
    await page.locator(".single-round-create input[type='number']").fill("2");
    await page.locator(".new-single-round-btn").click();
    await expect(page.locator(".slide").first()).toBeVisible({ timeout: 5_000 });

    // Wait for debounced save
    await page.waitForTimeout(500);
    await page.reload();
    await page.locator(".slide").first().waitFor({ timeout: 10_000 });

    // Still no intros, still 2 questions in Q phase and 2 in A phase.
    await expect(page.locator('.slide[data-slide-id="intro-0"]')).toHaveCount(0);
    await expect(page.locator('.slide[data-answers="0"][data-slide-id^="r0q"]')).toHaveCount(2);
    await expect(page.locator('.slide[data-answers="1"][data-slide-id^="r0q"]')).toHaveCount(2);
  });

  test("jackpot and email inputs are hidden in single-round shape", async ({ page }) => {
    await page.goto("/");
    await page.locator(".new-single-round-btn").click();
    await expect(page.locator(".slide").first()).toBeVisible({ timeout: 5_000 });

    // Name + Date are still there
    await expect(page.locator(".setting-input--name")).toBeVisible();
    await expect(page.locator(".setting-input--date")).toBeVisible();

    // Jackpot and Email are gone
    await expect(page.locator(".setting-input--email")).toHaveCount(0);
    await expect(page.locator('.quiz-meta label:has-text("Jackpot")')).toHaveCount(0);
  });

  test("jackpot and email are not flagged by validation", async ({ page }) => {
    await page.goto("/");
    await page.locator(".single-round-create input[type='number']").fill("2");
    await page.locator(".new-single-round-btn").click();
    await expect(page.locator(".slide").first()).toBeVisible({ timeout: 5_000 });

    // Open validation
    await page.locator("button", { hasText: "Show Validation" }).click();

    const issueText = await page.locator(".validation-bar").innerText().catch(() => "");
    expect(issueText).not.toContain("Jackpot");
    expect(issueText).not.toContain("Email");
  });

  test("move buttons work within the single round", async ({ page }) => {
    await page.goto("/");
    await page.locator(".single-round-create input[type='number']").fill("3");
    await page.locator(".new-single-round-btn").click();
    await expect(page.locator(".slide").first()).toBeVisible({ timeout: 5_000 });

    // Type distinct text in q0 so we can verify the swap is identity-stable.
    const q0De = page.locator('.slide[data-slide-id="r0q0"][data-answers="0"] [lang="de"] .q-text__field');
    await q0De.scrollIntoViewIfNeeded();
    await q0De.click();
    await page.keyboard.type("Q-zero text");
    await q0De.evaluate((el) => el.blur());

    // Move r0q0 down via its image-actions bar.
    const q0Outer = page.locator('.slide-outer:has(.slide[data-slide-id="r0q0"][data-answers="0"])');
    await q0Outer.hover();
    await q0Outer.locator('.img-actions button[title="Move after next"]').click();

    // Slide id="r0q0" is now in position 2: shows num "2" and still owns the typed text.
    await expect(page.locator('.slide[data-slide-id="r0q0"] [lang="de"] .q-num').first()).toHaveText("2");
    await expect(page.locator('.slide[data-slide-id="r0q0"][data-answers="0"] [lang="de"] .q-text__field')).toHaveText("Q-zero text");
  });
});
