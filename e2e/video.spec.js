import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs/promises";
import JSZip from "jszip";
import { seedQuiz } from "./seed.js";

const VIDEO = path.resolve("tests/files/portrait.mp4");

function questionOuter(page, id, answers = false) {
  return page.locator(`.slide-outer:has(.slide[data-slide-id="${id}"][data-answers="${answers ? 1 : 0}"])`);
}

function slideVideo(outer) {
  return outer.locator(".slide .slide-img-wrap video");
}

async function addAV(outer, filePath) {
  await outer.scrollIntoViewIfNeeded();
  await outer.hover();
  const avInput = outer.locator('.img-actions input[type="file"][accept="audio/*,video/*"]');
  await avInput.setInputFiles(filePath);
  await expect(slideVideo(outer)).toBeVisible({ timeout: 5_000 });
}

async function hoverAndClickButton(outer, buttonText) {
  await outer.scrollIntoViewIfNeeded();
  await outer.hover();
  const btn = outer.locator("button", { hasText: buttonText });
  await expect(btn.first()).toBeVisible();
  await btn.first().click();
}

test.describe("video", () => {
  test.beforeEach(async ({ page }) => {
    await seedQuiz(page);
  });

  test("+av button adds video to slide", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");
    await addAV(outer, VIDEO);

    const video = slideVideo(outer);
    await expect(video).toBeVisible();
    await expect(video).toHaveAttribute("controls", "");
  });

  test("remove button removes video from slide", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");
    await addAV(outer, VIDEO);
    await expect(slideVideo(outer)).toBeVisible();

    await hoverAndClickButton(outer, "remove media");
    await expect(slideVideo(outer)).not.toBeVisible();
  });

  test("+av button disappears after adding video", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");
    await addAV(outer, VIDEO);

    await outer.scrollIntoViewIfNeeded();
    await outer.hover();
    const avBtn = outer.locator(".img-actions button", { hasText: "+av" });
    await expect(avBtn).not.toBeVisible();
  });

  test("+av reappears after removing video", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");
    await addAV(outer, VIDEO);
    await hoverAndClickButton(outer, "remove media");

    await outer.scrollIntoViewIfNeeded();
    await outer.hover();
    const avBtn = outer.locator(".img-actions button", { hasText: "+av" });
    await expect(avBtn).toBeVisible();
  });

  test("video is NOT linked from question to answer", async ({ page }) => {
    const question = questionOuter(page, "r0q0", false);
    const answer = questionOuter(page, "r0q0", true);

    await addAV(question, VIDEO);
    await expect(slideVideo(question)).toBeVisible();

    // Answer slide should NOT have video
    await answer.scrollIntoViewIfNeeded();
    await expect(slideVideo(answer)).not.toBeVisible();
  });

  test("video frame is extracted as preview image on answer slide", async ({ page }) => {
    const question = questionOuter(page, "r0q0", false);
    const answer = questionOuter(page, "r0q0", true);

    await addAV(question, VIDEO);

    // Answer slide should get a still frame (an <img>, not a <video>)
    await answer.scrollIntoViewIfNeeded();
    await expect(answer.locator(".slide .slide-img-wrap img")).toBeVisible({ timeout: 5_000 });
    await expect(slideVideo(answer)).not.toBeVisible();
  });

  test("removing video also removes frame from answer slide", async ({ page }) => {
    const question = questionOuter(page, "r0q0", false);
    const answer = questionOuter(page, "r0q0", true);

    await addAV(question, VIDEO);
    await answer.scrollIntoViewIfNeeded();
    await expect(answer.locator(".slide .slide-img-wrap img")).toBeVisible({ timeout: 5_000 });

    // Remove video from question
    await hoverAndClickButton(question, "remove media");

    // Frame should be removed from answer too
    await answer.scrollIntoViewIfNeeded();
    await expect(answer.locator(".slide .slide-img-wrap")).toHaveCount(0);
  });

  test("removing video preserves user-added image on answer slide", async ({ page }) => {
    const question = questionOuter(page, "r0q0", false);
    const answer = questionOuter(page, "r0q0", true);

    // Add video to question (frame auto-extracted to answer slot 0)
    await addAV(question, VIDEO);
    await answer.scrollIntoViewIfNeeded();
    await expect(answer.locator(".slide .slide-img-wrap img")).toBeVisible({ timeout: 5_000 });

    // Add a separate image to answer slot 1
    await answer.hover();
    const imgInput = answer.locator('.img-actions input[type="file"][accept="image/*"]');
    await imgInput.setInputFiles(path.resolve("tests/files/image-landscape.webp"));
    await expect(answer.locator(".slide .slide-img-wrap")).toHaveCount(2, { timeout: 5_000 });

    // Remove video from question
    await hoverAndClickButton(question, "remove media");

    // Frame removed, but user-added image should survive
    await answer.scrollIntoViewIfNeeded();
    await expect(answer.locator(".slide .slide-img-wrap")).toHaveCount(1);
    await expect(answer.locator(".slide .slide-img-wrap img")).toBeVisible();
  });

  test("video frame is NOT added to answer when answer already has an image", async ({ page }) => {
    const question = questionOuter(page, "r0q0", false);
    const answer = questionOuter(page, "r0q0", true);

    // Add image to answer first
    await answer.scrollIntoViewIfNeeded();
    await answer.hover();
    const imgInput = answer.locator('.img-actions input[type="file"][accept="image/*"]');
    await imgInput.setInputFiles(path.resolve("tests/files/image-landscape.webp"));
    await expect(answer.locator(".slide .slide-img-wrap img")).toBeVisible({ timeout: 5_000 });

    // Now add video to question
    await addAV(question, VIDEO);

    // Answer should still have exactly 1 image (the original, not the frame)
    await answer.scrollIntoViewIfNeeded();
    await expect(answer.locator(".slide .slide-img-wrap")).toHaveCount(1);
  });

  test("video coexists with image in two slots", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");

    // Add image first
    await outer.scrollIntoViewIfNeeded();
    await outer.hover();
    const imgInput = outer.locator('.img-actions input[type="file"][accept="image/*"]');
    await imgInput.setInputFiles(path.resolve("tests/files/image-landscape.webp"));
    await expect(outer.locator(".slide .slide-img-wrap").first()).toBeVisible({ timeout: 5_000 });

    // Add video
    await addAV(outer, VIDEO);

    // Both slots occupied
    const wraps = outer.locator(".slide .slide-img-wrap");
    await expect(wraps).toHaveCount(2);
    await expect(slideVideo(outer)).toBeVisible();
  });

  test("per-slot remove on video keeps image", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");

    // Add image first
    await outer.scrollIntoViewIfNeeded();
    await outer.hover();
    const imgInput = outer.locator('.img-actions input[type="file"][accept="image/*"]');
    await imgInput.setInputFiles(path.resolve("tests/files/image-landscape.webp"));
    await expect(outer.locator(".slide .slide-img-wrap").first()).toBeVisible({ timeout: 5_000 });

    // Add video
    await addAV(outer, VIDEO);
    await expect(outer.locator(".slide .slide-img-wrap")).toHaveCount(2);

    // Remove only the video via its per-slot button
    const videoWrap = outer.locator(".slide .slide-img-wrap:has(video)");
    await videoWrap.hover();
    await videoWrap.locator("button", { hasText: "remove" }).first().click();

    // Video gone, image stays
    await expect(slideVideo(outer)).not.toBeVisible();
    await expect(outer.locator(".slide .slide-img-wrap img")).toBeVisible();
  });

  test("downloaded PPTX has click-to-play timing and cover frame for video", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");
    await addAV(outer, VIDEO);
    // wait for cover extraction to finish (mirrored on answer slide as an <img>)
    await expect(questionOuter(page, "r0q0", true).locator(".slide .slide-img-wrap img")).toBeVisible({ timeout: 5_000 });

    await page.locator("button", { hasText: "Validate" }).click();
    const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
    await page.locator("button", { hasText: "Download .pptx" }).click();
    const download = await downloadPromise;
    const pptxPath = await download.path();
    const zip = await JSZip.loadAsync(await fs.readFile(pptxPath));

    // Find the slide that embeds the video (r0q0 question slide)
    const slidePaths = Object.keys(zip.files).filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p));
    let videoSlideXml = null;
    for (const p of slidePaths) {
      const xml = await zip.files[p].async("string");
      if (xml.includes("a:videoFile") && xml.includes("ppaction://media")) {
        videoSlideXml = xml;
        break;
      }
    }
    expect(videoSlideXml, "a slide should embed the video").not.toBeNull();

    // Click-to-play timing: mediacall / playFrom(0.0) targeting the Media shape.
    // Without this, PowerPoint treats click/spacebar as "advance slide" instead of "play video".
    expect(videoSlideXml).toMatch(/<p:timing>/);
    expect(videoSlideXml).toMatch(/presetClass="mediacall"/);
    expect(videoSlideXml).toMatch(/cmd="playFrom\(0\.0\)"/);
    // The video file reference must remain a videoFile (not renamed to audioFile like audio slides)
    expect(videoSlideXml).not.toMatch(/<a:audioFile/);
  });

  test("ghost answer bar hides while pointer is over the video", async ({ page }) => {
    // The ghost bar sits at the bottom of the slide and overlaps the video's
    // controls. Hide it whenever the pointer is inside the video element so
    // it never blocks play/pause/seek interactions.
    const outer = questionOuter(page, "r0q0", false);
    await addAV(outer, VIDEO);
    await outer.scrollIntoViewIfNeeded();
    await outer.hover();

    const ghostBar = outer.locator(".answer-bar--ghost");
    await expect(ghostBar).toBeVisible();

    await outer.locator("video").hover();
    await expect(ghostBar).not.toBeVisible();

    // Move off the video (but still over the slide) — bar should reappear
    await outer.hover({ position: { x: 10, y: 10 } });
    await expect(ghostBar).toBeVisible();
  });

  test("video persists after page reload", async ({ page }) => {
    const outer = questionOuter(page, "r0q0");
    await addAV(outer, VIDEO);
    await expect(slideVideo(outer)).toBeVisible();

    // Wait for frame extraction + save to complete
    const answer = questionOuter(page, "r0q0", true);
    await expect(answer.locator(".slide .slide-img-wrap img")).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(500);
    await page.reload();
    await page.locator(".slide").first().waitFor({ timeout: 10_000 });

    const outerAfter = questionOuter(page, "r0q0");
    await outerAfter.scrollIntoViewIfNeeded();
    await expect(slideVideo(outerAfter)).toBeVisible();
  });
});
