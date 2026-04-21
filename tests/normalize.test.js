import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractQuestions, normalizeSavedQuiz, mergeAudioIntoImages, buildSlideDescriptors, AUDIO_DIMENSIONS } from "../quiz-core.js";

function makeQuiz(overrides) {
  return {
    date: "2026-01-01",
    rounds: [
      {
        name: "Round 1",
        description: { de: "", en: "" },
        questions: [
          { text: { de: "Frage 1", en: "Question 1" }, answers: { de: "Antwort 1", en: "Answer 1" } },
          { text: { de: "Frage 2", en: "Question 2" }, answers: { de: "Antwort 2", en: "Answer 2" } },
        ],
      },
      {
        name: "Round 2",
        description: { de: "", en: "" },
        questions: [
          { text: { de: "Frage 3", en: "Question 3" }, answers: { de: "Antwort 3", en: "Answer 3" } },
        ],
      },
      { name: "Round 3", description: { de: "", en: "" }, questions: [{ text: { de: "F", en: "Q" }, answers: { de: "A", en: "A" } }] },
      { name: "Round 4", description: { de: "", en: "" }, questions: [{ text: { de: "F", en: "Q" }, answers: { de: "A", en: "A" } }] },
      { name: "Name 10", description: { de: "", en: "" }, questions: [{ text: { de: "F", en: "Q" }, answers: { de: "A", en: "A" } }] },
      { name: "Jackpot!", description: { de: "", en: "" }, questions: [
        { text: { de: "J1", en: "J1" }, answers: { de: "JA1", en: "JA1" } },
        { text: { de: "J2", en: "J2" }, answers: { de: "JA2", en: "JA2" } },
        { text: { de: "J3", en: "J3" }, answers: { de: "JA3", en: "JA3" } },
        { text: { de: "J4", en: "J4" }, answers: { de: "JA4", en: "JA4" } },
      ] },
    ],
    ...overrides,
  };
}

// --- extractQuestions ---

describe("extractQuestions", () => {
  it("builds keyed map from quiz rounds", () => {
    const quiz = makeQuiz();
    const q = extractQuestions(quiz);

    assert.deepStrictEqual(q["r0q0"].text, { de: "Frage 1", en: "Question 1" });
    assert.deepStrictEqual(q["r0q1"].answers, { de: "Antwort 2", en: "Answer 2" });
    assert.deepStrictEqual(q["r1q0"].text, { de: "Frage 3", en: "Question 3" });
  });

  it("returns independent copies (not references to quiz objects)", () => {
    const quiz = makeQuiz();
    const q = extractQuestions(quiz);
    q["r0q0"].text.de = "CHANGED";
    assert.strictEqual(quiz.rounds[0].questions[0].text.de, "Frage 1");
  });
});

// --- normalizeSavedQuiz ---

describe("normalizeSavedQuiz", () => {
  it("passes through a fully populated save unchanged", () => {
    const quiz = makeQuiz();
    const saved = {
      quiz,
      questions: { "r0q0": { text: { de: "custom", en: "custom" }, answers: { de: "a", en: "a" } } },
      descriptors: [{ type: "intro", id: "intro-0" }],
      images: { "r0q0:0": { data: "img" } },
      audio: { "r0q0:0": { data: "aud" } },
      manualOverrides: { "r0q0:0": { fontSize: 18 } },
      reveals: { "r0q0:1": true },
      style: { fontSize: 20, lineSpacing: 110, backgroundColor: "#11650b", textColor: "#FCFCFC" },
    };

    const result = normalizeSavedQuiz(saved);

    assert.strictEqual(result.quiz, quiz);
    assert.deepStrictEqual(result.questions, saved.questions);
    assert.deepStrictEqual(result.descriptors, saved.descriptors);
    // Audio merged into images: "r0q0:0" already occupied by image, so audio goes to "r0q0:0:1"
    assert.deepStrictEqual(result.images["r0q0:0"], { data: "img" });
    assert.deepStrictEqual(result.images["r0q0:0:1"], { data: "aud", ...AUDIO_DIMENSIONS, type: "audio" });
    assert.strictEqual(result.audio, undefined);
    assert.deepStrictEqual(result.manualOverrides, saved.manualOverrides);
    assert.deepStrictEqual(result.reveals, saved.reveals);
    assert.deepStrictEqual(result.style, saved.style);
  });

  it("preserves existing backgroundColor and textColor", () => {
    const quiz = makeQuiz();
    const saved = {
      quiz,
      descriptors: [],
      style: { fontSize: 20, lineSpacing: 110, backgroundColor: "#11650b", textColor: "#FCFCFC" },
    };
    const result = normalizeSavedQuiz(saved);

    assert.strictEqual(result.style.backgroundColor, "#11650b");
    assert.strictEqual(result.style.textColor, "#FCFCFC");
  });

  describe("backwards compatibility", () => {
    it("extracts questions from quiz when questions field is missing", () => {
      const quiz = makeQuiz();
      const saved = { quiz, descriptors: [] };
      const result = normalizeSavedQuiz(saved);

      assert.deepStrictEqual(result.questions["r0q0"].text, { de: "Frage 1", en: "Question 1" });
      assert.deepStrictEqual(result.questions["r1q0"].answers, { de: "Antwort 3", en: "Answer 3" });
    });

    it("regenerates descriptors when descriptors field is missing", () => {
      const quiz = makeQuiz();
      const saved = { quiz };
      const result = normalizeSavedQuiz(saved);

      assert.ok(result.descriptors.length > 0);
      assert.strictEqual(result.descriptors[0].type, "intro");
      const questionDescs = result.descriptors.filter((d) => d.type === "question");
      assert.ok(questionDescs.length > 0);
    });

    it("regenerated descriptors match buildSlideDescriptors output", () => {
      const quiz = makeQuiz();
      const saved = { quiz };
      const result = normalizeSavedQuiz(saved);
      const expected = buildSlideDescriptors(quiz);

      assert.deepStrictEqual(result.descriptors, expected);
    });

    it("defaults missing images/manualOverrides/reveals to empty objects", () => {
      const quiz = makeQuiz();
      const saved = { quiz, descriptors: [] };
      const result = normalizeSavedQuiz(saved);

      assert.deepStrictEqual(result.images, {});
      assert.deepStrictEqual(result.manualOverrides, {});
      assert.deepStrictEqual(result.reveals, {});
    });

    it("backfills jackpot flag on old question descriptors", () => {
      const quiz = makeQuiz();
      // Simulate an old save where descriptors were persisted without jackpot flag.
      const oldDescs = buildSlideDescriptors(quiz).map((d) => {
        if (d.type === "question" && d.jackpot) {
          const { jackpot, ...rest } = d;
          return rest;
        }
        return d;
      });
      const saved = { quiz, descriptors: oldDescs };
      const result = normalizeSavedQuiz(saved);
      const jackpotDescs = result.descriptors.filter((d) => d.type === "question" && d.id?.startsWith("r5q"));
      assert.ok(jackpotDescs.length > 0);
      assert.ok(jackpotDescs.every((d) => d.jackpot === true), "jackpot descriptors should be backfilled");
    });

    it("returns null style when style field is missing", () => {
      const quiz = makeQuiz();
      const saved = { quiz, descriptors: [] };
      const result = normalizeSavedQuiz(saved);

      assert.strictEqual(result.style, null);
    });

    it("fills in missing backgroundColor with white default", () => {
      const quiz = makeQuiz();
      const saved = { quiz, descriptors: [], style: { fontSize: 20, lineSpacing: 110 } };
      const result = normalizeSavedQuiz(saved);

      assert.strictEqual(result.style.backgroundColor, "#FFFFFF");
    });

    it("fills in missing textColor with black default", () => {
      const quiz = makeQuiz();
      const saved = { quiz, descriptors: [], style: { fontSize: 20, lineSpacing: 110 } };
      const result = normalizeSavedQuiz(saved);

      assert.strictEqual(result.style.textColor, "#000000");
    });

    it("migrates audio from separate field into images as type audio", () => {
      const quiz = makeQuiz();
      const saved = { quiz, descriptors: [], audio: { "r0q0:0": { data: "aud", name: "test.mp3", durationMs: 1000 } } };
      const result = normalizeSavedQuiz(saved);

      assert.deepStrictEqual(result.images["r0q0:0"], {
        data: "aud", name: "test.mp3", durationMs: 1000,
        ...AUDIO_DIMENSIONS, type: "audio",
      });
    });

    it("places migrated audio in second slot when first is occupied by image", () => {
      const quiz = makeQuiz();
      const saved = {
        quiz, descriptors: [],
        images: { "r0q0:0": { data: "img", width: 100, height: 100 } },
        audio: { "r0q0:0": { data: "aud", name: "test.mp3", durationMs: 500 } },
      };
      const result = normalizeSavedQuiz(saved);

      assert.deepStrictEqual(result.images["r0q0:0"], { data: "img", width: 100, height: 100 });
      assert.strictEqual(result.images["r0q0:0:1"].type, "audio");
      assert.strictEqual(result.images["r0q0:0:1"].data, "aud");
    });

    it("defaults jackpotSize to 0 when missing", () => {
      const quiz = makeQuiz();
      const saved = { quiz, descriptors: [] };
      const result = normalizeSavedQuiz(saved);
      assert.strictEqual(result.jackpotSize, 0);
    });

    it("defaults email to empty string when missing", () => {
      const quiz = makeQuiz();
      const saved = { quiz, descriptors: [] };
      const result = normalizeSavedQuiz(saved);
      assert.strictEqual(result.email, "");
    });

    it("preserves jackpotSize and email when present", () => {
      const quiz = makeQuiz();
      const saved = { quiz, descriptors: [], jackpotSize: 200, email: "quiz@test.de" };
      const result = normalizeSavedQuiz(saved);
      assert.strictEqual(result.jackpotSize, 200);
      assert.strictEqual(result.email, "quiz@test.de");
    });

    it("treats image entries without type field as images", () => {
      const quiz = makeQuiz();
      const saved = {
        quiz, descriptors: [],
        images: { "r0q0:0": { data: "img", width: 200, height: 150 } },
      };
      const result = normalizeSavedQuiz(saved);

      assert.strictEqual(result.images["r0q0:0"].type, undefined);
      assert.strictEqual(result.images["r0q0:0"].data, "img");
    });
  });
});

describe("mergeAudioIntoImages", () => {
  it("returns images unchanged when no audio", () => {
    const images = { "r0q0:0": { data: "img" } };
    assert.deepStrictEqual(mergeAudioIntoImages(images, {}), images);
    assert.deepStrictEqual(mergeAudioIntoImages(images, null), images);
  });

  it("merges audio into empty slot", () => {
    const result = mergeAudioIntoImages({}, { "r0q0:0": { data: "aud" } });
    assert.deepStrictEqual(result["r0q0:0"], { data: "aud", ...AUDIO_DIMENSIONS, type: "audio" });
  });

  it("puts audio in second slot when first is taken", () => {
    const images = { "r0q0:0": { data: "img" } };
    const result = mergeAudioIntoImages(images, { "r0q0:0": { data: "aud" } });
    assert.strictEqual(result["r0q0:0"].data, "img");
    assert.strictEqual(result["r0q0:0:1"].data, "aud");
    assert.strictEqual(result["r0q0:0:1"].type, "audio");
  });

  it("does not overwrite existing second slot", () => {
    const images = { "r0q0:0": { data: "img1" }, "r0q0:0:1": { data: "img2" } };
    const result = mergeAudioIntoImages(images, { "r0q0:0": { data: "aud" } });
    assert.strictEqual(result["r0q0:0"].data, "img1");
    assert.strictEqual(result["r0q0:0:1"].data, "img2");
  });
});
