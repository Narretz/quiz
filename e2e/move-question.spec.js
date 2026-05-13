import { test, expect } from "@playwright/test";
import path from "path";
import { seedQuiz } from "./seed.js";

function outer(page, id, answers = false) {
  return page.locator(`.slide-outer:has(.slide[data-slide-id="${id}"][data-answers="${answers ? 1 : 0}"])`);
}

function upBtn(o) { return o.locator('.img-actions button[title="Move before previous"]'); }
function downBtn(o) { return o.locator('.img-actions button[title="Move after next"]'); }

function numAt(page, id, answers = false) {
  return outer(page, id, answers).locator('.slide [lang="de"] .q-num').first().innerText();
}

async function clickMove(o, dir) {
  await o.scrollIntoViewIfNeeded();
  await o.hover();
  await (dir === "up" ? upBtn(o) : downBtn(o)).click();
}

test.describe("move question", () => {
  test.beforeEach(async ({ page }) => {
    await seedQuiz(page);
  });

  test("move buttons appear only on question slides", async ({ page }) => {
    // Question slide: both buttons present
    const q = outer(page, "r0q0");
    await q.scrollIntoViewIfNeeded();
    await q.hover();
    await expect(upBtn(q)).toHaveCount(1);
    await expect(downBtn(q)).toHaveCount(1);

    // Answer slide: also present
    const a = outer(page, "r0q0", true);
    await a.scrollIntoViewIfNeeded();
    await a.hover();
    await expect(upBtn(a)).toHaveCount(1);
    await expect(downBtn(a)).toHaveCount(1);

    // Round title slide: no move buttons
    const title = page.locator('.slide-outer:has(.slide[data-slide-id="title-r0"])');
    await title.scrollIntoViewIfNeeded();
    await title.hover();
    await expect(title.locator('.img-actions button[title="Move before previous"]')).toHaveCount(0);
    await expect(title.locator('.img-actions button[title="Move after next"]')).toHaveCount(0);

    // Antworten divider: no move buttons
    const ant = page.locator('.slide-outer:has(.slide[data-slide-id="antworten-s0"])');
    await ant.scrollIntoViewIfNeeded();
    await ant.hover();
    await expect(ant.locator('.img-actions button[title="Move before previous"]')).toHaveCount(0);

    // Intro slide that has media support (golden-rules, descIdx=3): no move buttons either
    const intro = page.locator('.slide-outer[data-desc-idx="3"]');
    await intro.scrollIntoViewIfNeeded();
    await intro.hover();
    await expect(intro.locator('.img-actions button[title="Move before previous"]')).toHaveCount(0);
  });

  test("up is disabled at first question, down is disabled at last", async ({ page }) => {
    // r0 has 10 questions (q0..q9)
    const first = outer(page, "r0q0");
    await first.scrollIntoViewIfNeeded();
    await first.hover();
    await expect(upBtn(first)).toBeDisabled();
    await expect(downBtn(first)).toBeEnabled();

    const last = outer(page, "r0q9");
    await last.scrollIntoViewIfNeeded();
    await last.hover();
    await expect(upBtn(last)).toBeEnabled();
    await expect(downBtn(last)).toBeDisabled();
  });

  test("down on last question of round does not cross into the next round", async ({ page }) => {
    // r0q9 is the last question in round 0. Round 1 questions follow in the descriptor array.
    // Even though the next descriptor is a question, it belongs to a different round, so down must be disabled.
    const last = outer(page, "r0q9");
    await last.scrollIntoViewIfNeeded();
    await last.hover();
    await expect(downBtn(last)).toBeDisabled();
  });

  test("move down swaps the question with its next sibling", async ({ page }) => {
    // Capture original DE text of q0 and q1
    const q0DeOriginal = await outer(page, "r0q0").locator('[lang="de"] .q-text__field').innerText();
    const q1DeOriginal = await outer(page, "r0q1").locator('[lang="de"] .q-text__field').innerText();
    expect(q0DeOriginal).not.toBe(q1DeOriginal);

    await clickMove(outer(page, "r0q0"), "down");

    // After move, the slide with data-slide-id="r0q0" should display num "2"
    // and the slide with data-slide-id="r0q1" should display num "1".
    expect(await numAt(page, "r0q0")).toBe("2");
    expect(await numAt(page, "r0q1")).toBe("1");

    // Text content stays with its id (it's keyed by id, not position)
    await expect(outer(page, "r0q0").locator('[lang="de"] .q-text__field')).toHaveText(q0DeOriginal);
    await expect(outer(page, "r0q1").locator('[lang="de"] .q-text__field')).toHaveText(q1DeOriginal);

    // DOM order: the slide that is now "1" must come before the slide that is now "2"
    const order = await page.locator('.slide[data-slide-id^="r0q"][data-answers="0"]').evaluateAll(
      (els) => els.slice(0, 2).map((el) => el.getAttribute("data-slide-id"))
    );
    expect(order).toEqual(["r0q1", "r0q0"]);
  });

  test("moving question phase also moves the answer phase", async ({ page }) => {
    await clickMove(outer(page, "r0q0"), "down");

    // Question phase order: r0q1, r0q0
    const qOrder = await page.locator('.slide[data-slide-id^="r0q"][data-answers="0"]').evaluateAll(
      (els) => els.slice(0, 2).map((el) => el.getAttribute("data-slide-id"))
    );
    expect(qOrder).toEqual(["r0q1", "r0q0"]);

    // Answer phase order: also r0q1, r0q0
    const aOrder = await page.locator('.slide[data-slide-id^="r0q"][data-answers="1"]').evaluateAll(
      (els) => els.slice(0, 2).map((el) => el.getAttribute("data-slide-id"))
    );
    expect(aOrder).toEqual(["r0q1", "r0q0"]);

    // Numbering on answer phase is also positional
    expect(await numAt(page, "r0q0", true)).toBe("2");
    expect(await numAt(page, "r0q1", true)).toBe("1");
  });

  test("moving from the answer slide also moves the question slide", async ({ page }) => {
    // Trigger the move from the answer-phase slide
    await clickMove(outer(page, "r0q0", true), "down");

    const qOrder = await page.locator('.slide[data-slide-id^="r0q"][data-answers="0"]').evaluateAll(
      (els) => els.slice(0, 2).map((el) => el.getAttribute("data-slide-id"))
    );
    expect(qOrder).toEqual(["r0q1", "r0q0"]);
  });

  test("move up reverses move down", async ({ page }) => {
    await clickMove(outer(page, "r0q0"), "down");
    expect(await numAt(page, "r0q0")).toBe("2");

    // Now r0q0 is at position 2, click up to swap back
    await clickMove(outer(page, "r0q0"), "up");
    expect(await numAt(page, "r0q0")).toBe("1");
    expect(await numAt(page, "r0q1")).toBe("2");

    const order = await page.locator('.slide[data-slide-id^="r0q"][data-answers="0"]').evaluateAll(
      (els) => els.slice(0, 2).map((el) => el.getAttribute("data-slide-id"))
    );
    expect(order).toEqual(["r0q0", "r0q1"]);
  });

  test("image stays with its question after a move", async ({ page }) => {
    // Add image to r0q0
    const q0 = outer(page, "r0q0");
    await q0.scrollIntoViewIfNeeded();
    await q0.hover();
    await q0.locator('.img-actions input[type="file"][accept="image/*"]').setInputFiles(
      path.resolve("tests/files/image-landscape.webp"),
    );
    await expect(q0.locator(".slide-img-wrap").first()).toBeVisible({ timeout: 5_000 });

    // Move r0q0 down — image should still be on the slide with data-slide-id="r0q0"
    await clickMove(outer(page, "r0q0"), "down");

    // The same slide (id r0q0) still has its image
    await expect(outer(page, "r0q0").locator(".slide-img-wrap").first()).toBeVisible();
    // And r0q1 (now at position 1) has no image
    await expect(outer(page, "r0q1").locator(".slide-img-wrap")).toHaveCount(0);
  });

  test("move persists after reload", async ({ page }) => {
    await clickMove(outer(page, "r0q0"), "down");
    await page.waitForTimeout(500); // wait for scheduleSave debounce

    await page.reload();
    await page.locator(".slide").first().waitFor({ timeout: 10_000 });

    expect(await numAt(page, "r0q0")).toBe("2");
    expect(await numAt(page, "r0q1")).toBe("1");

    const order = await page.locator('.slide[data-slide-id^="r0q"][data-answers="0"]').evaluateAll(
      (els) => els.slice(0, 2).map((el) => el.getAttribute("data-slide-id"))
    );
    expect(order).toEqual(["r0q1", "r0q0"]);
  });
});
