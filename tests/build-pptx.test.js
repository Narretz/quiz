import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { buildPptx, buildSlideDescriptors, SLIDE_STYLE, DEFAULT_MONEY } from "../quiz-core.js";
import { INTRO_SLIDES } from "../lib/intro-slides.js";

// --- PptxGenJS spy ---

class SlideSpy {
  constructor() {
    this.background = null;
    this.texts = [];
    this.images = [];
    this.media = [];
  }
  addText(content, opts) { this.texts.push({ content, opts }); }
  addImage(opts) { this.images.push(opts); }
  addMedia(opts) { this.media.push(opts); }
}

class PptxSpy {
  constructor() {
    this.layout = null;
    this.theme = null;
    this.slides = [];
  }
  addSlide() {
    const s = new SlideSpy();
    this.slides.push(s);
    return s;
  }
}

// --- Fixtures ---

function makeQuiz() {
  return {
    date: "2026-01-01",
    rounds: [
      { name: "Round 1", description: { de: "", en: "" }, questions: [
        { text: { de: "Frage 1", en: "Question 1" }, answers: { de: "Antwort 1", en: "Answer 1" } },
        { text: { de: "Frage 2", en: "Question 2" }, answers: { de: "Antwort 2", en: "Answer 2" } },
      ] },
      { name: "Round 2", description: { de: "", en: "" }, questions: [
        { text: { de: "F3", en: "Q3" }, answers: { de: "A3", en: "A3" } },
      ] },
      { name: "Round 3", description: { de: "", en: "" }, questions: [
        { text: { de: "F", en: "Q" }, answers: { de: "A", en: "A" } },
      ] },
      { name: "Round 4", description: { de: "", en: "" }, questions: [
        { text: { de: "F", en: "Q" }, answers: { de: "A", en: "A" } },
      ] },
      { name: "Name 10", description: { de: "", en: "" }, questions: [
        { text: { de: "F", en: "Q" }, answers: { de: "A", en: "A" } },
      ] },
      { name: "Jackpot!", description: { de: "", en: "" }, questions: [
        { text: { de: "J1", en: "J1" }, answers: { de: "JA1", en: "JA1" } },
        { text: { de: "J2", en: "J2" }, answers: { de: "JA2", en: "JA2" } },
        { text: { de: "J3", en: "J3" }, answers: { de: "JA3", en: "JA3" } },
        { text: { de: "J4", en: "J4" }, answers: { de: "JA4", en: "JA4" } },
      ] },
    ],
  };
}

// --- Tests ---

describe("buildPptx", () => {
  let quiz, descriptors, questions;

  beforeEach(() => {
    quiz = makeQuiz();
    descriptors = buildSlideDescriptors(quiz);
    questions = {};
    quiz.rounds.forEach((round, ri) => {
      round.questions.forEach((q, qi) => {
        questions[`r${ri}q${qi}`] = { text: { ...q.text }, answers: { ...q.answers } };
      });
    });
  });

  it("creates one slide per descriptor", () => {
    const pptx = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions);
    assert.strictEqual(pptx.slides.length, descriptors.length);
  });

  it("sets background color on every slide", () => {
    const pptx = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions);
    const bgColor = SLIDE_STYLE.backgroundColor.replace("#", "");
    for (const slide of pptx.slides) {
      assert.deepStrictEqual(slide.background, { color: bgColor });
    }
  });

  it("renders title slide text", () => {
    const titleIdx = descriptors.findIndex((d) => d.type === "title" && d.text.de === "Round 1");
    const pptx = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions);
    const slide = pptx.slides[titleIdx];
    const titleText = slide.texts.find((t) => t.content === "Round 1");
    assert.ok(titleText, "title text should be present");
    assert.ok(titleText.opts.bold);
  });

  it("renders bilingual title with EN text when present", () => {
    const titleIdx = descriptors.findIndex((d) => d.type === "title" && d.text.de === "Round 1");
    descriptors[titleIdx] = { ...descriptors[titleIdx], text: { de: "Runde 1", en: "Round 1" } };
    const pptx = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions);
    const slide = pptx.slides[titleIdx];
    const deText = slide.texts.find((t) => t.content === "Runde 1");
    const enText = slide.texts.find((t) => t.content === "Round 1");
    assert.ok(deText, "DE title text should be present");
    assert.ok(enText, "EN title text should be present");
  });

  it("renders bilingual subtitle on Antworten slide", () => {
    const antIdx = descriptors.findIndex((d) => d.type === "title" && d.text.de === "Antworten");
    const pptx = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions);
    const slide = pptx.slides[antIdx];
    const subText = slide.texts.find((t) => typeof t.content === "string" && t.content.includes("Bitte tauscht") && t.content.includes("Please swap"));
    assert.ok(subText, "Antworten subtitle should contain both DE and EN");
  });

  it("renders question text with number prefix", () => {
    const qIdx = descriptors.findIndex((d) => d.type === "question" && d.id === "r0q0" && !d.withAnswers);
    const pptx = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions);
    const slide = pptx.slides[qIdx];
    const deText = slide.texts.find((t) => Array.isArray(t.content) && t.content.some((r) => r.text?.includes("Frage 1")));
    assert.ok(deText, "DE question text should be present");
    const numRun = deText.content.find((r) => r.text?.includes("1"));
    assert.ok(numRun?.options?.bold, "number should be bold");
  });

  it("renders EN text block for questions", () => {
    const qIdx = descriptors.findIndex((d) => d.type === "question" && d.id === "r0q0" && !d.withAnswers);
    const pptx = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions);
    const slide = pptx.slides[qIdx];
    const enText = slide.texts.find((t) => Array.isArray(t.content) && t.content.some((r) => r.text?.includes("Question 1")));
    assert.ok(enText, "EN question text should be present");
    const numRun = enText.content.find((r) => r.text?.includes("1"));
    assert.ok(numRun?.options?.bold, "number should be bold");
  });

  it("renders answer bar on answer slides", () => {
    const aIdx = descriptors.findIndex((d) => d.type === "question" && d.id === "r0q0" && d.withAnswers);
    const pptx = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions);
    const slide = pptx.slides[aIdx];
    const answerText = slide.texts.find((t) => typeof t.content === "string" && t.content.includes("Antwort 1"));
    assert.ok(answerText, "answer bar should be present");
    assert.ok(answerText.opts.fill, "answer bar should have fill color");
  });

  it("places image on slide when provided", () => {
    const images = { "r0q0:0": { data: "data:image/png;base64,abc", width: 800, height: 600 } };
    const pptx = buildPptx(descriptors, PptxSpy, images, {}, {}, {}, questions);
    const qIdx = descriptors.findIndex((d) => d.type === "question" && d.id === "r0q0" && !d.withAnswers);
    const slide = pptx.slides[qIdx];
    assert.ok(slide.images.length > 0, "question slide should have an image");
  });

  it("embeds audio as media when provided", () => {
    const audio = { "r0q0:0": { data: "data:audio/mpeg;base64,abc", name: "clip.mp3", durationMs: 5000 } };
    const pptx = buildPptx(descriptors, PptxSpy, {}, {}, audio, {}, questions);
    const qIdx = descriptors.findIndex((d) => d.type === "question" && d.id === "r0q0" && !d.withAnswers);
    const slide = pptx.slides[qIdx];
    assert.strictEqual(slide.media.length, 1);
    assert.strictEqual(slide.media[0].type, "audio");
  });

  it("passes video cover frame to addMedia when provided", () => {
    const images = { "r0q0:0": { data: "data:video/mp4;base64,vid", type: "video", width: 1280, height: 720, cover: "data:image/png;base64,frame" } };
    const pptx = buildPptx(descriptors, PptxSpy, images, {}, {}, {}, questions);
    const qIdx = descriptors.findIndex((d) => d.type === "question" && d.id === "r0q0" && !d.withAnswers);
    const slide = pptx.slides[qIdx];
    const videoMedia = slide.media.find((m) => m.type === "video");
    assert.ok(videoMedia, "video should be added as media");
    assert.strictEqual(videoMedia.cover, "data:image/png;base64,frame");
  });

  it("omits video cover when entry has none", () => {
    const images = { "r0q0:0": { data: "data:video/mp4;base64,vid", type: "video", width: 1280, height: 720 } };
    const pptx = buildPptx(descriptors, PptxSpy, images, {}, {}, {}, questions);
    const qIdx = descriptors.findIndex((d) => d.type === "question" && d.id === "r0q0" && !d.withAnswers);
    const slide = pptx.slides[qIdx];
    const videoMedia = slide.media.find((m) => m.type === "video");
    assert.ok(videoMedia);
    assert.strictEqual(videoMedia.cover, undefined);
  });

  it("normalizes audio/mpeg to audio/mp3 for pptxgenjs", () => {
    const audio = { "r0q0:0": { data: "data:audio/mpeg;base64,abc", name: "clip.mp3", durationMs: 5000 } };
    const pptx = buildPptx(descriptors, PptxSpy, {}, {}, audio, {}, questions);
    const qIdx = descriptors.findIndex((d) => d.type === "question" && d.id === "r0q0" && !d.withAnswers);
    const slide = pptx.slides[qIdx];
    assert.ok(slide.media[0].data.startsWith("audio/mp3"), "should normalize MIME type");
    assert.ok(!slide.media[0].data.startsWith("data:"), "should strip data: prefix");
  });

  describe("jackpotSize and email options", () => {
    it("replaces {money} in rules slide with jackpotSize", () => {
      const rulesIdx = descriptors.findIndex((d) => d.type === "intro" && d.data?.id === "rules");
      const pptx = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions, { jackpotSize: 250 });
      const slide = pptx.slides[rulesIdx];
      const has250 = slide.texts.some((t) =>
        Array.isArray(t.content)
          ? t.content.some((r) => r.text?.includes("250"))
          : typeof t.content === "string" && t.content.includes("250")
      );
      assert.ok(has250, "rules slide should contain jackpot amount 250");
    });

    it("uses 0 as default when jackpotSize not provided", () => {
      const rulesIdx = descriptors.findIndex((d) => d.type === "intro" && d.data?.id === "rules");
      const pptx = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions);
      const slide = pptx.slides[rulesIdx];
      const has0 = slide.texts.some((t) =>
        Array.isArray(t.content)
          ? t.content.some((r) => r.text?.includes("0 €"))
          : false
      );
      assert.ok(has0, "rules slide should show 0 € by default");
    });

    it("adds email to goodbye slide when provided", () => {
      const goodbyeIdx = descriptors.findIndex((d) => d.type === "intro" && d.data?.id === "goodbye");
      const pptx = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions, { email: "quiz@test.de" });
      const slide = pptx.slides[goodbyeIdx];
      const hasEmail = slide.texts.some((t) =>
        Array.isArray(t.content)
          ? t.content.some((r) => r.text?.includes("quiz@test.de"))
          : typeof t.content === "string" && t.content.includes("quiz@test.de")
      );
      assert.ok(hasEmail, "goodbye slide should contain email address");
    });

    it("does not add email section to goodbye slide when email is empty", () => {
      const goodbyeIdx = descriptors.findIndex((d) => d.type === "intro" && d.data?.id === "goodbye");
      const pptx = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions);
      const slide = pptx.slides[goodbyeIdx];
      const hasEmailPlaceholder = slide.texts.some((t) =>
        Array.isArray(t.content)
          ? t.content.some((r) => r.text?.includes("{email}"))
          : false
      );
      assert.ok(!hasEmailPlaceholder, "goodbye slide should not contain {email} placeholder");
    });

    it("adds jackpot subtitle to Jackpot! title slides when jackpotSize > 0", () => {
      const jackpotTitleIdx = descriptors.findIndex((d) => d.type === "title" && d.text.de === "Jackpot!");
      const pptx = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions, { jackpotSize: 300 });
      const slide = pptx.slides[jackpotTitleIdx];

      const hasSubtitle = slide.texts.some((t) =>
        typeof t.content === "string" && t.content.includes(`ca. ${300 + DEFAULT_MONEY} €`)
      );
      assert.ok(hasSubtitle, `Jackpot title should show ca. ${300 + DEFAULT_MONEY} €`);
    });

    it("does add jackpot subtitle with DEFAULT_MONEY when jackpotSize is 0", () => {
      const jackpotTitleIdx = descriptors.findIndex((d) => d.type === "title" && d.text.de === "Jackpot!");
      const pptx = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions);
      const slide = pptx.slides[jackpotTitleIdx];
      const hasSubtitle = slide.texts.some((t) =>
        typeof t.content === "string" && t.content.includes(`ca. ${DEFAULT_MONEY} €`)
      );
      assert.ok(hasSubtitle, "Jackpot title should have subtitle when jackpotSize is 0");
    });
  });

  describe("reveal (click-to-show answer)", () => {
    it("tags jackpot answer slides with objectName=reveal-answer by default", () => {
      const pptx = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions);
      const jackpotIdx = descriptors.findIndex((d) => d.type === "question" && d.id === "r5q0" && d.withAnswers);
      const slide = pptx.slides[jackpotIdx];
      const answerText = slide.texts.find((t) => t.opts.objectName === "reveal-answer");
      assert.ok(answerText, "jackpot answer slide should tag its answer bar");
    });

    it("does not tag non-jackpot answer slides by default", () => {
      const pptx = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions);
      const aIdx = descriptors.findIndex((d) => d.type === "question" && d.id === "r0q0" && d.withAnswers);
      const slide = pptx.slides[aIdx];
      const tagged = slide.texts.find((t) => t.opts.objectName === "reveal-answer");
      assert.ok(!tagged, "non-jackpot answer bar should not be tagged");
    });

    it("respects explicit reveal=true for a non-jackpot answer slide", () => {
      const pptx = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions, { reveals: { "r0q0:1": true } });
      const aIdx = descriptors.findIndex((d) => d.type === "question" && d.id === "r0q0" && d.withAnswers);
      const slide = pptx.slides[aIdx];
      const tagged = slide.texts.find((t) => t.opts.objectName === "reveal-answer");
      assert.ok(tagged, "explicit reveal should tag the answer bar");
    });

    it("respects explicit reveal=false for a jackpot answer slide", () => {
      const pptx = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions, { reveals: { "r5q0:1": false } });
      const jackpotIdx = descriptors.findIndex((d) => d.type === "question" && d.id === "r5q0" && d.withAnswers);
      const slide = pptx.slides[jackpotIdx];
      const tagged = slide.texts.find((t) => t.opts.objectName === "reveal-answer");
      assert.ok(!tagged, "explicit reveal=false should un-tag the jackpot answer bar");
    });

    it("tags the golden-rules image with reveal-answer when reveal=image and image present", () => {
      const grIdx = descriptors.findIndex((d) => d.type === "intro" && d.data?.id === "golden-rules");
      const fakeImg = { data: "data:image/png;base64,abc", width: 800, height: 600 };
      const images = { "intro-3:0": fakeImg };
      const pptx = buildPptx(descriptors, PptxSpy, images, {}, {}, {}, questions);
      const slide = pptx.slides[grIdx];
      const tagged = slide.images.find((i) => i.objectName === "reveal-answer");
      assert.ok(tagged, "golden-rules image should be tagged for click-to-reveal");
    });

    it("does not tag golden-rules when no image is present", () => {
      const grIdx = descriptors.findIndex((d) => d.type === "intro" && d.data?.id === "golden-rules");
      const pptx = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions);
      const slide = pptx.slides[grIdx];
      const tagged = slide.images.find((i) => i.objectName === "reveal-answer");
      assert.ok(!tagged, "no image means nothing to tag");
    });

    it("tags the begin slide text with reveal-answer when reveal=lines", () => {
      const beginIdx = descriptors.findIndex((d) => d.type === "intro" && d.data?.id === "begin");
      const pptx = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions);
      const slide = pptx.slides[beginIdx];
      const tagged = slide.texts.find((t) => t.opts.objectName === "reveal-answer");
      assert.ok(tagged, "begin slide text should be tagged for click-to-reveal");
    });
  });

  describe("image-below-text positioning", () => {
    const fakeImg = { data: "data:image/png;base64,abc", width: 800, height: 600 };
    const lineH = (pts) => (pts / 72) * 1.2;

    it("no-phones intro: text box height derives from font size, image below", () => {
      const noPhonesIdx = descriptors.findIndex((d) => d.type === "intro" && d.data?.id === "no-phones");
      assert.ok(noPhonesIdx !== -1, "no-phones descriptor should exist");
      const images = { [`no-phones:0`]: fakeImg };
      const pptx = buildPptx(descriptors, PptxSpy, images, {}, {}, {}, questions);
      const slide = pptx.slides[noPhonesIdx];

      const textEl = slide.texts.find((t) => Array.isArray(t.content) && t.content.some((r) => r.text?.includes("NO PHONES!")));
      assert.ok(textEl, "NO PHONES! text should be present");
      const expectedH = lineH(50);
      assert.ok(Math.abs(textEl.opts.h - expectedH) < 0.01,
        `text box height ${textEl.opts.h} should be ~${expectedH.toFixed(3)} (derived from 50pt)`);
      assert.strictEqual(textEl.opts.y, SLIDE_STYLE.pad, "text should start at pad");

      assert.ok(slide.images.length > 0, "should have an image");
      const img = slide.images[0];
      const expectedImgTop = SLIDE_STYLE.pad + expectedH + SLIDE_STYLE.pad;
      assert.ok(Math.abs(img.y - expectedImgTop) < 0.01,
        `image y=${img.y.toFixed(3)} should be ~${expectedImgTop.toFixed(3)} (textBottom + pad)`);
    });

    it("title slide with image: text box height derives from font size", () => {
      const titleIdx = descriptors.findIndex((d) => d.type === "title" && d.text.de === "Round 1");
      const images = { [`${descriptors[titleIdx].id}:0`]: fakeImg };
      const pptx = buildPptx(descriptors, PptxSpy, images, {}, {}, {}, questions);
      const slide = pptx.slides[titleIdx];

      const deText = slide.texts.find((t) => t.content === "Round 1");
      assert.ok(deText, "DE title should exist");
      const expectedTitleH = lineH(SLIDE_STYLE.title.fontSize);
      assert.ok(Math.abs(deText.opts.h - expectedTitleH) < 0.01,
        `title box height ${deText.opts.h} should be ~${expectedTitleH.toFixed(3)} (derived from ${SLIDE_STYLE.title.fontSize}pt)`);

      assert.ok(slide.images.length > 0, "should have an image");
      const img = slide.images[0];
      assert.ok(img.y > deText.opts.y + deText.opts.h,
        `image y=${img.y.toFixed(3)} should be below text bottom ${(deText.opts.y + deText.opts.h).toFixed(3)}`);
    });

    it("begin-style intro without image: centered layout unaffected", () => {
      const noPhonesIdx = descriptors.findIndex((d) => d.type === "intro" && d.data?.id === "no-phones");
      const pptx = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions);
      const slide = pptx.slides[noPhonesIdx];

      const textEl = slide.texts.find((t) => Array.isArray(t.content) && t.content.some((r) => r.text?.includes("NO PHONES!")));
      assert.ok(textEl, "NO PHONES! text should be present");
      assert.strictEqual(textEl.opts.h, "100%", "without image, text box should be 100% height (centered)");
    });

    it("passes per-line outline and highlight through to addText runs", () => {
      const noPhonesIdx = descriptors.findIndex((d) => d.type === "intro" && d.data?.id === "no-phones");
      const noPhonesData = descriptors[noPhonesIdx].data;
      const pptx = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions);
      const slide = pptx.slides[noPhonesIdx];

      const textEl = slide.texts.find((t) => Array.isArray(t.content) && t.content.some((r) => r.text?.includes("NO PHONES!")));
      const run = textEl.content.find((r) => r.text?.includes("NO PHONES!"));
      assert.deepStrictEqual(run.options.outline, noPhonesData.lines[0].outline,
        "outline from template should be on the run");
    });
  });

  describe("description slide positioning", () => {
    it("uses overrides enY for DE/EN text box heights", () => {
      const descDescs = [
        ...descriptors.slice(0, 5),
        { type: "description", text: { de: "Lange Beschreibung", en: "Long description" }, id: "desc-r0" },
        ...descriptors.slice(5),
      ];
      const customEnY = 3.2;
      const overrides = { "desc-r0:0": { enY: customEnY } };
      const pptx = buildPptx(descDescs, PptxSpy, {}, overrides, {}, {}, questions);
      const descIdx = descDescs.findIndex((d) => d.type === "description");
      const slide = pptx.slides[descIdx];

      const deText = slide.texts.find((t) => t.content === "Lange Beschreibung");
      assert.ok(deText, "DE description text should exist");
      assert.strictEqual(deText.opts.y, SLIDE_STYLE.pad);
      assert.ok(Math.abs(deText.opts.h - (customEnY - SLIDE_STYLE.pad)) < 0.001,
        `DE height ${deText.opts.h} should equal enY - pad = ${customEnY - SLIDE_STYLE.pad}`);

      const enText = slide.texts.find((t) => t.content === "Long description");
      assert.ok(enText, "EN description text should exist");
      assert.strictEqual(enText.opts.y, customEnY);
      const expectedEnH = SLIDE_STYLE.height - SLIDE_STYLE.pad - customEnY;
      assert.ok(Math.abs(enText.opts.h - expectedEnH) < 0.001,
        `EN height ${enText.opts.h} should equal H - pad - enY = ${expectedEnH}`);
    });

    it("falls back to default enY=2.5 without overrides", () => {
      const descDescs = [
        ...descriptors.slice(0, 5),
        { type: "description", text: { de: "Kurz", en: "Short" }, id: "desc-r0" },
        ...descriptors.slice(5),
      ];
      const pptx = buildPptx(descDescs, PptxSpy, {}, {}, {}, {}, questions);
      const descIdx = descDescs.findIndex((d) => d.type === "description");
      const slide = pptx.slides[descIdx];

      const enText = slide.texts.find((t) => t.content === "Short");
      assert.ok(enText);
      assert.strictEqual(enText.opts.y, 2.5);
      assert.ok(Math.abs(enText.opts.h - (SLIDE_STYLE.height - SLIDE_STYLE.pad - 2.5)) < 0.001);
    });
  });

  describe("golden-rules layout", () => {
    const grData = INTRO_SLIDES.find((s) => s.id === "golden-rules");
    const grLines = grData.sections[0].lines;
    const fakeImg = { data: "data:image/png;base64,abc", width: 800, height: 600 };

    function ruleTexts(slide) {
      return slide.texts.filter((t) =>
        Array.isArray(t.content) && /^\d\./.test(t.content[0]?.text || "")
      );
    }
    function titleText(slide) {
      return slide.texts.find((t) => t.content === grData.title.text);
    }

    it("uses lineHeight and defaultFontSize from template data without image", () => {
      const grIdx = descriptors.findIndex((d) => d.type === "intro" && d.data?.id === "golden-rules");
      assert.ok(grIdx !== -1, "golden-rules descriptor should exist");
      const pptx = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions);
      const slide = pptx.slides[grIdx];

      const rules = ruleTexts(slide);
      assert.strictEqual(rules.length, grLines.length, `should have ${grLines.length} rule text boxes`);
      assert.ok(Math.abs(rules[0].opts.y - grData.sectionStartY) < 0.01,
        `first rule y ${rules[0].opts.y} should equal sectionStartY ${grData.sectionStartY}`);
      const rH = rules[1].opts.y - rules[0].opts.y;
      assert.ok(Math.abs(rH - grData.lineHeight) < 0.01,
        `rule spacing ${rH} should equal lineHeight ${grData.lineHeight}`);
      assert.strictEqual(rules[0].content[0].options.fontSize, grData.defaultFontSize);
      assert.strictEqual(rules[0].opts.valign, "middle", "rules should be vertically centered in their box");
    });

    it("uses compactWhenImage overrides when image is present", () => {
      const grIdx = descriptors.findIndex((d) => d.type === "intro" && d.data?.id === "golden-rules");
      const images = { "intro-3:0": fakeImg };
      const pptx = buildPptx(descriptors, PptxSpy, images, {}, {}, {}, questions);
      const slide = pptx.slides[grIdx];
      const compact = grData.compactWhenImage;

      const rules = ruleTexts(slide);
      assert.strictEqual(rules.length, grLines.length);
      assert.ok(Math.abs(rules[0].opts.y - compact.sectionStartY) < 0.01,
        `first rule y ${rules[0].opts.y} should equal compact.sectionStartY ${compact.sectionStartY}`);
      const rH = rules[1].opts.y - rules[0].opts.y;
      assert.ok(Math.abs(rH - compact.lineHeight) < 0.01,
        `rule spacing ${rH} should equal compact.lineHeight ${compact.lineHeight}`);
      assert.strictEqual(rules[0].content[0].options.fontSize, compact.defaultFontSize);
    });

    it("keeps title at titleY in both image and no-image modes", () => {
      const grIdx = descriptors.findIndex((d) => d.type === "intro" && d.data?.id === "golden-rules");

      const noImg = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions);
      const titleNoImg = titleText(noImg.slides[grIdx]);
      assert.ok(titleNoImg, "title text should render");
      assert.ok(Math.abs(titleNoImg.opts.y - grData.titleY) < 0.01);

      const withImg = buildPptx(descriptors, PptxSpy, { "intro-3:0": fakeImg }, {}, {}, {}, questions);
      const titleWithImg = titleText(withImg.slides[grIdx]);
      assert.ok(Math.abs(titleWithImg.opts.y - grData.titleY) < 0.01,
        "title should stay at titleY when image is added (compactWhenImage prevents shift)");
    });

    it("places image below the rules block", () => {
      const grIdx = descriptors.findIndex((d) => d.type === "intro" && d.data?.id === "golden-rules");
      const images = { "intro-3:0": fakeImg };
      const pptx = buildPptx(descriptors, PptxSpy, images, {}, {}, {}, questions);
      const slide = pptx.slides[grIdx];
      const compact = grData.compactWhenImage;

      assert.strictEqual(slide.images.length, 1, "should add one image");
      const expectedTextBottom = compact.sectionStartY + grLines.length * compact.lineHeight;
      const expectedImgTop = expectedTextBottom + SLIDE_STYLE.pad;
      assert.ok(slide.images[0].y >= expectedImgTop - 0.01,
        `image y ${slide.images[0].y} should be >= ${expectedImgTop} (textBottom + pad)`);
    });
  });

  describe("rules style with image", () => {
    const fakeImg = { data: "data:image/png;base64,abc", width: 800, height: 600 };

    it("uses titleY and sectionStartY from template when no image", () => {
      const rulesIdx = descriptors.findIndex((d) => d.type === "intro" && d.data?.id === "rules");
      const rulesData = descriptors[rulesIdx].data;
      const pptx = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions);
      const slide = pptx.slides[rulesIdx];

      const title = slide.texts.find((t) => t.content === rulesData.title.text);
      assert.ok(title, "title should render");
      assert.strictEqual(title.opts.y, rulesData.titleY, "title y should equal template titleY");
      assert.strictEqual(slide.images.length, 0, "no image should be added");
    });

    it("moves title to pad and shifts sections up when image present", () => {
      const rulesIdx = descriptors.findIndex((d) => d.type === "intro" && d.data?.id === "rules");
      const rulesData = descriptors[rulesIdx].data;
      const pptx = buildPptx(descriptors, PptxSpy, { "intro-1:0": fakeImg }, {}, {}, {}, questions);
      const slide = pptx.slides[rulesIdx];

      const title = slide.texts.find((t) => t.content === rulesData.title.text);
      assert.strictEqual(title.opts.y, SLIDE_STYLE.pad, "title should move to pad with image");

      const lineBlocks = slide.texts.filter((t) => Array.isArray(t.content));
      assert.ok(lineBlocks.length > 0, "should have line text blocks");
      const minLineY = Math.min(...lineBlocks.map((t) => t.opts.y));
      assert.ok(minLineY < rulesData.sectionStartY,
        `first line y ${minLineY} should be above template sectionStartY ${rulesData.sectionStartY} when image present`);
    });

    it("places image below text bottom", () => {
      const rulesIdx = descriptors.findIndex((d) => d.type === "intro" && d.data?.id === "rules");
      const pptx = buildPptx(descriptors, PptxSpy, { "intro-1:0": fakeImg }, {}, {}, {}, questions);
      const slide = pptx.slides[rulesIdx];

      assert.strictEqual(slide.images.length, 1, "should add one image");
      const textBottoms = slide.texts
        .filter((t) => typeof t.opts.y === "number" && typeof t.opts.h === "number")
        .map((t) => t.opts.y + t.opts.h);
      const maxTextBottom = Math.max(...textBottoms);
      assert.ok(slide.images[0].y >= maxTextBottom - 0.01,
        `image y ${slide.images[0].y} should be >= text bottom ${maxTextBottom}`);
    });

    it("filters out sections whose showIf var is empty (goodbye email)", () => {
      const goodbyeIdx = descriptors.findIndex((d) => d.type === "intro" && d.data?.id === "goodbye");
      const pptx = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions, { email: "" });
      const slide = pptx.slides[goodbyeIdx];

      const hasEmailLine = slide.texts.some((t) =>
        Array.isArray(t.content) && t.content.some((r) => r.text?.includes("{email}"))
      );
      assert.ok(!hasEmailLine, "{email} placeholder line should be filtered when email empty");
    });
  });

  describe("format style layout", () => {
    it("renders underlined title at template titleY", () => {
      const formatIdx = descriptors.findIndex((d) => d.type === "intro" && d.data?.id === "format");
      const formatData = descriptors[formatIdx].data;
      const pptx = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions);
      const slide = pptx.slides[formatIdx];

      const title = slide.texts.find((t) => t.content === formatData.title.text);
      assert.ok(title, "title should render");
      assert.strictEqual(title.opts.y, formatData.titleY);
      assert.ok(title.opts.underline, "title should be underlined");
    });

    it("renders one text block per section at sectionStartY + i*sectionGap", () => {
      const formatIdx = descriptors.findIndex((d) => d.type === "intro" && d.data?.id === "format");
      const formatData = descriptors[formatIdx].data;
      const pptx = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions);
      const slide = pptx.slides[formatIdx];

      const sections = slide.texts.filter((t) => Array.isArray(t.content));
      assert.strictEqual(sections.length, formatData.sections.length, "one text block per section");
      sections.sort((a, b) => a.opts.y - b.opts.y);
      sections.forEach((sec, si) => {
        const expectedY = formatData.sectionStartY + si * formatData.sectionGap;
        assert.ok(Math.abs(sec.opts.y - expectedY) < 0.01,
          `section ${si} y ${sec.opts.y} should equal ${expectedY}`);
      });
    });

    it("prepends bullet to the first run of each line", () => {
      const formatIdx = descriptors.findIndex((d) => d.type === "intro" && d.data?.id === "format");
      const formatData = descriptors[formatIdx].data;
      const pptx = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions);
      const slide = pptx.slides[formatIdx];

      const sections = slide.texts.filter((t) => Array.isArray(t.content));
      const bullet = formatData.sections[0].bullet;
      sections.forEach((sec, si) => {
        const expectedBullets = formatData.sections[si].lines.length;
        const bulletRuns = sec.content.filter((r) => r.text?.startsWith(bullet + " "));
        assert.strictEqual(bulletRuns.length, expectedBullets,
          `section ${si} should have ${expectedBullets} bulleted lines, got ${bulletRuns.length}`);
      });
    });

    it("applies contentPad to x and width", () => {
      const formatIdx = descriptors.findIndex((d) => d.type === "intro" && d.data?.id === "format");
      const formatData = descriptors[formatIdx].data;
      const cp = formatData.contentPad || 0;
      assert.ok(cp > 0, "test assumes template has contentPad > 0");
      const pptx = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions);
      const slide = pptx.slides[formatIdx];

      const sec = slide.texts.find((t) => Array.isArray(t.content));
      assert.ok(Math.abs(sec.opts.x - (SLIDE_STYLE.pad + cp)) < 0.01,
        `x ${sec.opts.x} should equal pad + contentPad (${SLIDE_STYLE.pad + cp})`);
      assert.ok(Math.abs(sec.opts.w - (SLIDE_STYLE.width - 2 * SLIDE_STYLE.pad - 2 * cp)) < 0.01,
        `w ${sec.opts.w} should equal W - 2*(pad + contentPad)`);
    });
  });

  describe("begin style multi-group layout", () => {
    const lineH = (pts) => (pts / 72) * 1.2;

    it("renders two text blocks for points slide (marginTop creates a group break)", () => {
      const pointsIdx = descriptors.findIndex((d) => d.type === "intro" && d.data?.id === "points");
      assert.ok(pointsIdx !== -1, "points descriptor should exist");
      const pptx = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions);
      const slide = pptx.slides[pointsIdx];

      assert.strictEqual(slide.texts.length, 2, "marginTop on second line should split into two text blocks");
    });

    it("vertically centers the multi-group block accounting for marginTop", () => {
      const pointsIdx = descriptors.findIndex((d) => d.type === "intro" && d.data?.id === "points");
      const pointsData = descriptors[pointsIdx].data;
      const pptx = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions);
      const slide = pptx.slides[pointsIdx];

      const blocks = [...slide.texts].sort((a, b) => a.opts.y - b.opts.y);
      const h0 = lineH(pointsData.lines[0].fontSize);
      const h1 = lineH(pointsData.lines[1].fontSize);
      const margin = pointsData.lines[1].marginTop;
      const totalH = h0 + h1 + margin;
      const expectedY0 = (SLIDE_STYLE.height - totalH) / 2;
      const expectedY1 = expectedY0 + h0 + margin;

      assert.ok(Math.abs(blocks[0].opts.y - expectedY0) < 0.01,
        `first block y ${blocks[0].opts.y} should equal (H - totalH)/2 = ${expectedY0}`);
      assert.ok(Math.abs(blocks[1].opts.y - expectedY1) < 0.01,
        `second block y ${blocks[1].opts.y} should equal y0 + h0 + marginTop = ${expectedY1}`);
    });

    it("merges lines without marginTop into a single centered block (intro-4 begin)", () => {
      const beginIdx = descriptors.findIndex((d) => d.type === "intro" && d.data?.id === "begin");
      const pptx = buildPptx(descriptors, PptxSpy, {}, {}, {}, {}, questions);
      const slide = pptx.slides[beginIdx];

      assert.strictEqual(slide.texts.length, 1, "lines without marginTop should share one text block");
      assert.strictEqual(slide.texts[0].opts.h, "100%", "single-group block uses 100% height for centering");
      const allText = slide.texts[0].content.map((r) => r.text).join("");
      assert.ok(allText.includes("Lasst uns anfangen"), "DE line should be present");
      assert.ok(allText.includes("Let us begin"), "EN line should be present");
    });
  });

  describe("backwards compatibility", () => {
    it("reads question from desc.q when questions map has no entry", () => {
      const descs = descriptors.map((d) => {
        if (d.type === "question" && d.id === "r0q0") {
          return { ...d, q: { text: { de: "Alt-Frage", en: "Old-Question" }, answers: { de: "Alt-A", en: "Old-A" } } };
        }
        return d;
      });
      // Pass empty questions map — should fall back to desc.q
      const pptx = buildPptx(descs, PptxSpy, {}, {}, {}, {}, {});
      const qIdx = descs.findIndex((d) => d.type === "question" && d.id === "r0q0" && !d.withAnswers);
      const slide = pptx.slides[qIdx];
      const deText = slide.texts.find((t) => Array.isArray(t.content) && t.content.some((r) => r.text?.includes("Alt-Frage")));
      assert.ok(deText, "should fall back to desc.q for DE text");
    });

    it("prefers questions map over desc.q", () => {
      const descs = descriptors.map((d) => {
        if (d.type === "question" && d.id === "r0q0") {
          return { ...d, q: { text: { de: "Alt-Frage", en: "Old-Question" }, answers: { de: "Alt-A", en: "Old-A" } } };
        }
        return d;
      });
      const pptx = buildPptx(descs, PptxSpy, {}, {}, {}, {}, questions);
      const qIdx = descs.findIndex((d) => d.type === "question" && d.id === "r0q0" && !d.withAnswers);
      const slide = pptx.slides[qIdx];
      const deText = slide.texts.find((t) => Array.isArray(t.content) && t.content.some((r) => r.text?.includes("Frage 1")));
      assert.ok(deText, "should use questions map, not desc.q");
    });

    it("renders intro slide when descriptor has id but no style field", () => {
      const oldIntroDesc = {
        type: "intro",
        introIndex: 0,
        data: { ...INTRO_SLIDES[0], style: undefined },
        id: "intro-0",
      };
      // data.id = "welcome" should be used as style fallback
      assert.strictEqual(oldIntroDesc.data.id, "welcome");
      const pptx = buildPptx([oldIntroDesc], PptxSpy, {}, {}, {}, {}, {});
      const slide = pptx.slides[0];
      const titleText = slide.texts.find((t) => t.content === "Pub Quiz");
      assert.ok(titleText, "welcome intro should render via data.id fallback");
    });

    it("renders intro slide normally when style field is present", () => {
      const introDesc = {
        type: "intro",
        introIndex: 0,
        data: INTRO_SLIDES[0],
        id: "intro-0",
      };
      assert.strictEqual(introDesc.data.style, "welcome");
      const pptx = buildPptx([introDesc], PptxSpy, {}, {}, {}, {}, {});
      const slide = pptx.slides[0];
      const titleText = slide.texts.find((t) => t.content === "Pub Quiz");
      assert.ok(titleText, "welcome intro should render via data.style");
    });
  });
});
