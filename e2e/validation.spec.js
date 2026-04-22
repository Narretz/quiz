import { test, expect } from "@playwright/test";
import { seedQuiz } from "./seed.js";

test.describe("validation bar", () => {
  test.beforeEach(async ({ page }) => {
    await seedQuiz(page);
  });

  test("is hidden by default, appears after clicking Validate, enables Download", async ({ page }) => {
    await expect(page.locator(".validation-bar")).toHaveCount(0);
    await expect(page.locator("button", { hasText: "Show Validation" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Download .pptx" })).toBeDisabled();

    await page.locator("button", { hasText: "Show Validation" }).click();
    await expect(page.locator(".validation-bar")).toBeVisible();
    await expect(page.locator("button", { hasText: "Download .pptx" })).toBeEnabled();
  });

  test("Validate button toggles validation", async ({ page }) => {
    await page.locator("button", { hasText: "Show Validation" }).click();
    await expect(page.locator("button", { hasText: "Show Validation" })).toHaveCount(0);
    await expect(page.locator("button", { hasText: "Hide Validation" })).toBeEnabled();
    await expect(page.locator(".validation-bar")).toBeVisible();
    await expect(page.locator("button", { hasText: "Hide Validation" })).toBeEnabled();
    await page.locator("button", { hasText: "Hide Validation" }).click();
    await expect(page.locator(".validation-bar")).toHaveCount(0);
  });

  test("dismisses when the × button is clicked", async ({ page }) => {
    await page.locator("button", { hasText: "Show Validation" }).click();
    await expect(page.locator(".validation-bar")).toBeVisible();
    await page.locator(".validation-bar__dismiss").click();
    await expect(page.locator(".validation-bar")).toHaveCount(0);
  });

  test("shows severity counts and issue list", async ({ page }) => {
    await page.locator("button", { hasText: "Show Validation" }).click();
    const bar = page.locator(".validation-bar");
    await expect(bar).toBeVisible();
    // Seeded quiz has unset jackpot + email + no images on titles -> at least info pills
    await expect(bar.locator(".vb-pill--info")).toBeVisible();
    // Placeholder rounds (Weihnachtslieder, Lego Ideas) have 10 empty question slides each -> danger
    await expect(bar.locator(".vb-pill--danger")).toBeVisible();
    const items = bar.locator(".vb-issue");
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
  });

  test("issues are sorted by severity (danger → warning → info)", async ({ page }) => {
    // Inject an answer-in-question leak to force a danger issue
    await seedQuiz(page, {
      questions: {
        "r0q0": {
          text: { de: "Wo ist Burgermeister?", en: "Where is Burgermeister?" },
        },
      },
    });
    await page.locator("button", { hasText: "Show Validation" }).click();
    const bar = page.locator(".validation-bar");
    await expect(bar).toBeVisible();

    const badges = await bar.locator(".vb-issue__badge").allTextContents();
    const rank = { danger: 0, warning: 1, info: 2 };
    for (let i = 1; i < badges.length; i++) {
      expect(rank[badges[i]]).toBeGreaterThanOrEqual(rank[badges[i - 1]]);
    }
    expect(badges[0]).toBe("danger");
  });

  test("clicking an issue scrolls its slide into view", async ({ page }) => {
    await page.locator("button", { hasText: "Show Validation" }).click();
    const bar = page.locator(".validation-bar");
    await expect(bar).toBeVisible();

    // Click the first issue that targets a slide we can identify
    const firstIssue = bar.locator(".vb-issue").first();
    await firstIssue.click();

    // The issue should now be "active" (highlighted)
    await expect(firstIssue).toHaveClass(/vb-issue--active/);
  });

  test("prev/next buttons navigate through issues", async ({ page }) => {
    await page.locator("button", { hasText: "Show Validation" }).click();
    const bar = page.locator(".validation-bar");
    const cursor = bar.locator(".validation-bar__cursor");
    const total = await bar.locator(".vb-issue").count();
    if (total < 2) test.skip(true, "needs at least 2 issues");

    await expect(cursor).toContainText(`1 / ${total}`);
    await bar.locator(".validation-bar__nav button", { hasText: "Next" }).click();
    await expect(cursor).toContainText(`2 / ${total}`);
    await bar.locator(".validation-bar__nav button", { hasText: "Prev" }).click();
    await expect(cursor).toContainText(`1 / ${total}`);
    // Wraps around: prev on first should go to last
    await bar.locator(".validation-bar__nav button", { hasText: "Prev" }).click();
    await expect(cursor).toContainText(`${total} / ${total}`);
  });

  test("updates live as the user edits", async ({ page }) => {
    // DE leaks the answer, EN does not — editing DE alone fully resolves the issue.
    await seedQuiz(page, {
      questions: {
        "r0q0": {
          text: { de: "Wo isst Burgermeister heute?", en: "Where to eat today?" },
          answers: { de: "Burgermeister", en: "Burgermeister" },
        },
      },
    });
    await page.locator("button", { hasText: "Show Validation" }).click();
    const bar = page.locator(".validation-bar");
    const leakIssue = bar.locator(".vb-issue--danger", { hasText: "Burgermeister" });
    await expect(leakIssue).toBeVisible();

    // Fix: rewrite DE without the answer word
    const deField = page.locator('.slide[data-slide-id="r0q0"][data-answers="0"] [lang="de"] .q-text__field');
    await deField.scrollIntoViewIfNeeded();
    await deField.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("Wo isst man heute?");
    await deField.evaluate((el) => el.blur());

    await expect(leakIssue).toHaveCount(0);
  });

  test("setting jackpot removes the jackpot-not-set info", async ({ page }) => {
    await page.locator("button", { hasText: "Show Validation" }).click();
    const bar = page.locator(".validation-bar");
    await expect(bar).toBeVisible();
    await expect(bar.locator(".vb-issue", { hasText: "Jackpot size is not set" })).toBeVisible();

    const jackpotInput = page.locator('.setting-input[type="number"]');
    await jackpotInput.fill("150");
    await jackpotInput.press("Enter");

    await expect(bar.locator(".vb-issue", { hasText: "Jackpot size is not set" })).toHaveCount(0);
  });

  test("email format validation fires when invalid, clears when valid", async ({ page }) => {
    await page.locator("button", { hasText: "Show Validation" }).click();
    const bar = page.locator(".validation-bar");

    const emailInput = page.locator(".setting-input--email");

    // Retry the fill+commit: the input is controlled by a signal, and a stray
    // Preact re-render between fill() and the change event can reset the DOM
    // value before the handler reads it. Blurring fires a native change.
    await expect(async () => {
      await emailInput.fill("not-an-email");
      await emailInput.blur();
      await expect(bar.locator(".vb-issue", { hasText: "Email format looks invalid" })).toBeVisible({ timeout: 1000 });
    }).toPass();

    await expect(async () => {
      await emailInput.fill("quiz@example.com");
      await emailInput.blur();
      await expect(bar.locator(".vb-issue", { hasText: "Email format looks invalid" })).toHaveCount(0, { timeout: 1000 });
      await expect(bar.locator(".vb-issue", { hasText: "Email is not set" })).toHaveCount(0, { timeout: 1000 });
    }).toPass();
  });

  test("debug Validate checkbox shows the bar live without downloading", async ({ page }) => {
    await page.goto(`/?quiz=${encodeURIComponent("2025-11-30")}&debug=true`);
    await page.locator(".slide").first().waitFor({ timeout: 10_000 });

    await expect(page.locator(".validation-bar")).toHaveCount(0);

    const checkbox = page.locator(".style-controls label", { hasText: "Validate" }).locator("input[type=checkbox]");
    await checkbox.check();

    await expect(page.locator(".validation-bar")).toBeVisible();
    await checkbox.uncheck();
    await expect(page.locator(".validation-bar")).toHaveCount(0);
  });

  test("Validate checkbox state persists across reloads", async ({ page }) => {
    await page.goto(`/?quiz=${encodeURIComponent("2025-11-30")}&debug=true`);
    await page.locator(".slide").first().waitFor({ timeout: 10_000 });

    const checkbox = page.locator(".style-controls label", { hasText: "Validate" }).locator("input[type=checkbox]");
    await checkbox.check();
    await expect(page.locator(".validation-bar")).toBeVisible();

    // Allow the async db write to land, then reload.
    await page.waitForTimeout(1000);
    await page.reload();
    await page.locator(".slide").first().waitFor({ timeout: 10_000 });

    await expect(page.locator(".validation-bar")).toBeVisible();
    await expect(checkbox).toBeChecked();

    // Toggle off and verify the off state persists too.
    await checkbox.uncheck();
    await page.waitForTimeout(1000);
    await page.reload();
    await page.locator(".slide").first().waitFor({ timeout: 10_000 });
    await expect(page.locator(".validation-bar")).toHaveCount(0);
    await expect(page.locator(".style-controls label", { hasText: "Validate" }).locator("input[type=checkbox]")).not.toBeChecked();
  });
});
