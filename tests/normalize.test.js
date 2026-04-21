import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractQuestions, normalizeSavedQuiz, buildSlideDescriptors } from "../quiz-core.js";

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
      style: { fontSize: 20, lineSpacing: 110, backgroundColor: "#11650b", textColor: "#FCFCFC" },
    };

    const result = normalizeSavedQuiz(saved);

    assert.strictEqual(result.quiz, quiz);
    assert.deepStrictEqual(result.questions, saved.questions);
    assert.deepStrictEqual(result.descriptors, saved.descriptors);
    assert.deepStrictEqual(result.images, saved.images);
    assert.deepStrictEqual(result.audio, saved.audio);
    assert.deepStrictEqual(result.manualOverrides, saved.manualOverrides);
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

    it("defaults missing images/audio/manualOverrides to empty objects", () => {
      const quiz = makeQuiz();
      const saved = { quiz, descriptors: [] };
      const result = normalizeSavedQuiz(saved);

      assert.deepStrictEqual(result.images, {});
      assert.deepStrictEqual(result.audio, {});
      assert.deepStrictEqual(result.manualOverrides, {});
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
  });
});
