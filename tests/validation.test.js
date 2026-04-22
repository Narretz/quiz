import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSlideDescriptors, extractQuestions } from "../quiz-core.js";
import { validateQuiz, messages } from "../lib/validation.js";

function fullQuiz(overrides = {}) {
  const base = {
    date: "2026-01-01",
    rounds: [
      { name: "Music", description: { de: "", en: "" }, questions: Array.from({ length: 10 }, (_, i) =>
        ({ text: { de: `Frage ${i + 1} hier ist ein langer Text`, en: `Question ${i + 1} here is long text` }, answers: { de: `Antwort${i + 1}`, en: `Answer${i + 1}` } })) },
      { name: "Movies", description: { de: "", en: "" }, questions: Array.from({ length: 10 }, (_, i) =>
        ({ text: { de: `Frage2 ${i} hier ist ein Text`, en: `Question2 ${i} here is a text` }, answers: { de: `Zwei${i}`, en: `Two${i}` } })) },
      { name: "Sports", description: { de: "", en: "" }, questions: Array.from({ length: 10 }, (_, i) =>
        ({ text: { de: `Frage3 ${i} lange Text`, en: `Question3 ${i} longer text` }, answers: { de: `Drei${i}`, en: `Three${i}` } })) },
      { name: "Trivia", description: { de: "", en: "" }, questions: Array.from({ length: 10 }, (_, i) =>
        ({ text: { de: `Frage4 ${i} viel Text`, en: `Question4 ${i} more text` }, answers: { de: `Vier${i}`, en: `Four${i}` } })) },
      { name: "Name 10", description: { de: "", en: "" }, questions: Array.from({ length: 10 }, (_, i) =>
        ({ text: { de: `Nenne 10 Dinge ${i}`, en: `Name 10 things ${i}` }, answers: { de: "", en: "" } })) },
      { name: "Jackpot!", description: { de: "", en: "" }, questions: Array.from({ length: 4 }, (_, i) =>
        ({ text: { de: `Jackpot ${i} lange Frage`, en: `Jackpot ${i} long question` }, answers: { de: `Gold${i}`, en: `Gold${i}` } })) },
    ],
  };
  return { ...base, ...overrides };
}

function inputs(quiz, extras = {}) {
  return {
    descriptors: buildSlideDescriptors(quiz),
    questions: extractQuestions(quiz),
    images: {},
    quiz,
    jackpotSize: 50,
    email: "me@example.com",
    ...extras,
  };
}

function findIssue(issues, substring) {
  return issues.find((i) => i.message.includes(substring));
}

describe("validateQuiz", () => {
  describe("danger: answer in question text", () => {
    it("flags when DE answer appears as whole word in DE question", () => {
      const quiz = fullQuiz();
      quiz.rounds[0].questions[0] = {
        text: { de: "Welche Stadt ist Paris die Hauptstadt?", en: "Which city is it?" },
        answers: { de: "Paris", en: "Paris" },
      };
      const issues = validateQuiz(inputs(quiz));
      const issue = findIssue(issues, messages.ANSWER_IN_QUESTION);
      assert.ok(issue, "should flag answer leak");
      assert.equal(issue.severity, "danger");
    });

    it("flags when EN answer appears in EN question", () => {
      const quiz = fullQuiz();
      quiz.rounds[0].questions[0] = {
        text: { de: "Hauptstadt?", en: "Paris is the capital of what country?" },
        answers: { de: "Frankreich", en: "France" },
      };
      // EN answer 'France' doesn't appear. Swap:
      quiz.rounds[0].questions[0].answers = { de: "Paris", en: "Paris" };
      const issues = validateQuiz(inputs(quiz));
      assert.ok(findIssue(issues, messages.ANSWER_IN_QUESTION));
    });

    it("does not flag short (<3 char) answers to avoid multiple-choice false positives", () => {
      const quiz = fullQuiz();
      quiz.rounds[0].questions[0] = {
        text: { de: "A oder B oder C? Was ist richtig?", en: "A or B or C? Which is right?" },
        answers: { de: "A", en: "A" },
      };
      const issues = validateQuiz(inputs(quiz));
      assert.equal(findIssue(issues, messages.ANSWER_IN_QUESTION), undefined);
    });

    it("still flags 3-letter answers that appear in the question", () => {
      const quiz = fullQuiz();
      quiz.rounds[0].questions[0] = {
        text: { de: "Die EDV ist was genau?", en: "What exactly is EDV?" },
        answers: { de: "EDV", en: "EDV" },
      };
      const issues = validateQuiz(inputs(quiz));
      assert.ok(findIssue(issues, messages.ANSWER_IN_QUESTION));
    });

    it("does not flag multiple-choice answers whose options are listed in the question", () => {
      const quiz = fullQuiz();
      quiz.rounds[0].questions[0] = {
        text: {
          de: "Welche Stadt ist die Hauptstadt? A) Paris B) Chicago C) Miami",
          en: "Which is the capital? A) Paris B) Chicago C) Miami",
        },
        answers: { de: "B) Chicago", en: "B) Chicago" },
      };
      const issues = validateQuiz(inputs(quiz));
      assert.equal(findIssue(issues, messages.ANSWER_IN_QUESTION), undefined);
    });

    it("handles lowercase and '.'/':' MC markers", () => {
      const quiz = fullQuiz();
      quiz.rounds[0].questions[0] = {
        text: {
          de: "Welche? a. Paris b. Chicago c. Miami",
          en: "Which? a. Paris b. Chicago c. Miami",
        },
        answers: { de: "b. Chicago", en: "b. Chicago" },
      };
      const issues = validateQuiz(inputs(quiz));
      assert.equal(findIssue(issues, messages.ANSWER_IN_QUESTION), undefined);

      quiz.rounds[0].questions[0] = {
        text: {
          de: "Welche? A: Paris B: Chicago",
          en: "Which? A: Paris B: Chicago",
        },
        answers: { de: "B: Chicago", en: "B: Chicago" },
      };
      const issues2 = validateQuiz(inputs(quiz));
      assert.equal(findIssue(issues2, messages.ANSWER_IN_QUESTION), undefined);
    });

    it("still flags an MC-style answer when the question only has an unrelated letter marker", () => {
      // Answer "B) Chicago" but question only has "Z) ..." — the answer's own letter
      // is not listed in the question, so this isn't a real MC question.
      const quiz = fullQuiz();
      quiz.rounds[0].questions[0] = {
        text: {
          de: "Die Antwort ist B) Chicago. Z) siehe Fußnote.",
          en: "The answer is B) Chicago. Z) see footnote.",
        },
        answers: { de: "B) Chicago", en: "B) Chicago" },
      };
      const issues = validateQuiz(inputs(quiz));
      assert.ok(findIssue(issues, messages.ANSWER_IN_QUESTION));
    });

    it("still flags an MC-style answer when the question has no other options", () => {
      // Answer looks like MC but question doesn't list alternatives → genuine leak.
      const quiz = fullQuiz();
      quiz.rounds[0].questions[0] = {
        text: {
          de: "Die Antwort auf diese Frage ist B) Chicago, oder?",
          en: "The answer is B) Chicago, right?",
        },
        answers: { de: "B) Chicago", en: "B) Chicago" },
      };
      const issues = validateQuiz(inputs(quiz));
      assert.ok(findIssue(issues, messages.ANSWER_IN_QUESTION));
    });

    it("does not flag substring matches inside other words", () => {
      const quiz = fullQuiz();
      quiz.rounds[0].questions[0] = {
        text: { de: "Berliner Luft schmeckt gut, oder nicht?", en: "Does Berliner Luft taste good?" },
        answers: { de: "Berlin", en: "Berlin" },
      };
      const issues = validateQuiz(inputs(quiz));
      assert.equal(findIssue(issues, messages.ANSWER_IN_QUESTION), undefined);
    });

    it("flags answer leak only once and links to the answer slide", () => {
      const quiz = fullQuiz();
      quiz.rounds[0].questions[0] = {
        text: { de: "Paris ist wo?", en: "Paris where?" },
        answers: { de: "Paris", en: "Paris" },
      };
      const descriptors = buildSlideDescriptors(quiz);
      const issues = validateQuiz({
        descriptors,
        questions: extractQuestions(quiz),
        images: {},
        quiz,
        jackpotSize: 50,
        email: "me@example.com",
      });
      const leaks = issues.filter((i) => i.message.includes(messages.ANSWER_IN_QUESTION));
      assert.equal(leaks.length, 1);
      const target = descriptors[leaks[0].descIdx];
      assert.equal(target.type, "question");
      assert.equal(target.id, "r0q0");
      assert.equal(target.withAnswers, true);
      assert.match(leaks[0].label, /\(answer\)/);
    });
  });

  describe("warning: missing content", () => {
    it("flags question slide with no text and no media", () => {
      const quiz = fullQuiz();
      quiz.rounds[0].questions[0] = { text: { de: "", en: "" }, answers: { de: "A", en: "A" } };
      const issues = validateQuiz(inputs(quiz));
      assert.ok(findIssue(issues, messages.QUESTION_NO_CONTENT));
    });

    it("does not flag question slide when it has media", () => {
      const quiz = fullQuiz();
      quiz.rounds[0].questions[0] = { text: { de: "", en: "" }, answers: { de: "A", en: "A" } };
      const images = { "r0q0:0": { data: "x", width: 10, height: 10 } };
      const issues = validateQuiz(inputs(quiz, { images }));
      assert.equal(findIssue(issues, messages.QUESTION_NO_CONTENT), undefined);
    });

    it("flags answer slide with no answer and same media as question", () => {
      const quiz = fullQuiz();
      quiz.rounds[0].questions[0] = { text: { de: "Frage lang genug hier", en: "Long question here" }, answers: { de: "", en: "" } };
      const images = {
        "r0q0:0": { data: "same", width: 10, height: 10 },
        "r0q0:1": { data: "same", width: 10, height: 10 },
      };
      const issues = validateQuiz(inputs(quiz, { images }));
      assert.ok(findIssue(issues, messages.ANSWER_NO_TEXT_NO_DISTINCT_MEDIA));
    });

    it("does not flag answer slide with distinct media", () => {
      const quiz = fullQuiz();
      quiz.rounds[0].questions[0] = { text: { de: "Frage lang genug hier", en: "Long question here" }, answers: { de: "", en: "" } };
      const images = {
        "r0q0:0": { data: "q", width: 10, height: 10 },
        "r0q0:1": { data: "a", width: 10, height: 10 },
      };
      const issues = validateQuiz(inputs(quiz, { images }));
      assert.equal(findIssue(issues, messages.ANSWER_NO_TEXT_NO_DISTINCT_MEDIA), undefined);
      assert.equal(findIssue(issues, messages.ANSWER_NO_TEXT_OR_MEDIA), undefined);
    });

    it("does not say 'distinct from the question' when question has text but no media", () => {
      const quiz = fullQuiz();
      quiz.rounds[0].questions[0] = { text: { de: "Frage lang genug hier", en: "Long question here" }, answers: { de: "", en: "" } };
      const issues = validateQuiz(inputs(quiz));
      assert.ok(findIssue(issues, messages.ANSWER_NO_TEXT_OR_MEDIA));
      assert.equal(findIssue(issues, messages.ANSWER_NO_TEXT_NO_DISTINCT_MEDIA), undefined);
    });

    it("uses a simpler message for answer slide when the question is also empty", () => {
      const quiz = fullQuiz();
      quiz.rounds[0].questions[0] = { text: { de: "", en: "" }, answers: { de: "", en: "" } };
      const issues = validateQuiz(inputs(quiz));
      assert.ok(findIssue(issues, messages.ANSWER_NO_TEXT_OR_MEDIA));
      assert.equal(findIssue(issues, messages.ANSWER_NO_TEXT_NO_DISTINCT_MEDIA), undefined);
      assert.ok(findIssue(issues, messages.QUESTION_NO_CONTENT));
    });

    it("skips Name 10 answer-empty warnings", () => {
      const quiz = fullQuiz();
      const issues = validateQuiz(inputs(quiz));
      const emptyAns = issues.filter((i) =>
        i.message === messages.ANSWER_NO_TEXT_OR_MEDIA || i.message === messages.ANSWER_NO_TEXT_NO_DISTINCT_MEDIA
      );
      assert.equal(emptyAns.length, 0);
    });
  });

  describe("warning: missing language on question", () => {
    it("flags when DE is present but EN is missing", () => {
      const quiz = fullQuiz();
      quiz.rounds[0].questions[0] = { text: { de: "Eine Frage hier", en: "" }, answers: { de: "A", en: "A" } };
      const issues = validateQuiz(inputs(quiz));
      assert.ok(findIssue(issues, messages.EN_TRANSLATION_MISSING));
    });

    it("flags when EN is present but DE is missing", () => {
      const quiz = fullQuiz();
      quiz.rounds[0].questions[0] = { text: { de: "", en: "A question here" }, answers: { de: "A", en: "A" } };
      const issues = validateQuiz(inputs(quiz));
      assert.ok(findIssue(issues, messages.DE_TRANSLATION_MISSING));
    });

    it("does not flag answer slides for missing language in question", () => {
      const quiz = fullQuiz();
      quiz.rounds[0].questions[0] = { text: { de: "Frage hier lang", en: "" }, answers: { de: "A", en: "A" } };
      const issues = validateQuiz(inputs(quiz));
      const missing = issues.filter((i) => i.message === messages.EN_TRANSLATION_MISSING || i.message === messages.DE_TRANSLATION_MISSING);
      assert.equal(missing.length, 1);
    });
  });

  describe("info: jackpot and email", () => {
    it("flags missing jackpot size", () => {
      const quiz = fullQuiz();
      const issues = validateQuiz(inputs(quiz, { jackpotSize: 0 }));
      const issue = findIssue(issues, messages.JACKPOT_NOT_SET);
      assert.ok(issue);
      assert.equal(issue.severity, "info");
      assert.equal(issue.target, '.setting-input[type="number"]');
    });

    it("flags missing email", () => {
      const quiz = fullQuiz();
      const issues = validateQuiz(inputs(quiz, { email: "" }));
      const issue = findIssue(issues, messages.EMAIL_NOT_SET);
      assert.ok(issue);
      assert.equal(issue.target, ".setting-input--email");
    });

    it("flags invalid email format", () => {
      const quiz = fullQuiz();
      const issues = validateQuiz(inputs(quiz, { email: "not-an-email" }));
      const issue = findIssue(issues, messages.EMAIL_INVALID);
      assert.ok(issue);
      assert.equal(issue.target, ".setting-input--email");
    });

    it("does not flag valid email", () => {
      const quiz = fullQuiz();
      const issues = validateQuiz(inputs(quiz, { email: "foo@bar.baz" }));
      assert.equal(findIssue(issues, messages.EMAIL_INVALID), undefined);
    });
  });

  describe("info: missing title and extra slide images", () => {
    it("flags round title slides without images", () => {
      const quiz = fullQuiz();
      const issues = validateQuiz(inputs(quiz));
      const titleIssues = issues.filter((i) => i.message === messages.TITLE_NO_IMAGE);
      assert.ok(titleIssues.length > 0);
    });

    it("flags extra slides without images", () => {
      const quiz = fullQuiz();
      const issues = validateQuiz(inputs(quiz));
      const extraIssues = issues.filter((i) => i.message === messages.SPECIAL_SLIDE_NO_IMAGE);
      // break-1, points, break-2, prizes, no-phones, goodbye + intro-3 (golden-rules), intro-4 (begin) = 8
      assert.ok(extraIssues.length >= 6);
    });

    it("uses the configured label for fixed slides", () => {
      const quiz = fullQuiz();
      const issues = validateQuiz(inputs(quiz));
      const labels = issues.filter((i) => i.message === messages.SPECIAL_SLIDE_NO_IMAGE).map((i) => i.label);
      assert.ok(labels.includes("2 Golden Rules"));
      assert.ok(labels.includes("Let us begin"));
      assert.ok(labels.includes("Break 1"));
      assert.ok(labels.includes("Points 1"));
      assert.ok(labels.includes("Break 2"));
      assert.ok(labels.includes("Points 2"));
      assert.ok(labels.includes("No Phones"));
      assert.ok(labels.includes("Goodbye"));
    });

    it("does not flag intros 0-2 (no image support)", () => {
      const quiz = fullQuiz();
      const issues = validateQuiz(inputs(quiz));
      const intro012 = issues.filter((i) =>
        i.message === messages.SPECIAL_SLIDE_NO_IMAGE && ["welcome", "rules", "format"].includes(i.label)
      );
      assert.equal(intro012.length, 0);
    });

    it("does not flag title slide when image is present", () => {
      const quiz = fullQuiz();
      const images = {
        "title-r0:0": { data: "x", width: 10, height: 10 },
        "title-r0-ans:0": { data: "x", width: 10, height: 10 },
      };
      const issues = validateQuiz(inputs(quiz, { images }));
      const forR0 = issues.filter((i) => i.message === messages.TITLE_NO_IMAGE && /Music/.test(i.label));
      assert.equal(forR0.length, 0);
    });

    it("labels Antworten divider slides as Answers 1 and Answers 2", () => {
      const quiz = fullQuiz();
      const issues = validateQuiz(inputs(quiz));
      const labels = issues.filter((i) => i.message === messages.TITLE_NO_IMAGE).map((i) => i.label);
      assert.ok(labels.includes("Answers 1"));
      assert.ok(labels.includes("Answers 2"));
    });

    it("shows round name string (not [object Object]) for bilingual title descriptors", () => {
      const quiz = fullQuiz();
      const issues = validateQuiz(inputs(quiz));
      const titleIssues = issues.filter((i) => i.message === messages.TITLE_NO_IMAGE);
      for (const issue of titleIssues) {
        assert.ok(!issue.label.includes("[object"), `label should not contain [object: got "${issue.label}"`);
        assert.ok(issue.label.length > 0, "label should not be empty");
      }
      const r1 = titleIssues.find((i) => i.label === "Music");
      assert.ok(r1, "should use DE text from bilingual title as label");
    });

    it("flags default round names (Round 1..4) from a blank quiz", () => {
      const quiz = fullQuiz({
        rounds: [
          { name: "Round 1", description: { de: "", en: "" }, questions: [] },
          { name: "Round 2", description: { de: "", en: "" }, questions: [] },
          { name: "Round 3", description: { de: "", en: "" }, questions: [] },
          { name: "Round 4", description: { de: "", en: "" }, questions: [] },
          { name: "Name 10", description: { de: "", en: "" }, questions: [] },
          { name: "Jackpot!", description: { de: "", en: "" }, questions: [] },
        ],
      });
      const issues = validateQuiz(inputs(quiz));
      const defaults = issues.filter((i) => i.message === messages.TITLE_DEFAULT_NAME);
      assert.equal(defaults.length, 4);
      assert.deepEqual(defaults.map((i) => i.label).sort(), ["Round 1", "Round 2", "Round 3", "Round 4"]);
    });

    it("does not flag Name 10 or Jackpot! titles as default names", () => {
      const quiz = fullQuiz();
      const issues = validateQuiz(inputs(quiz));
      const defaults = issues.filter((i) => i.message === messages.TITLE_DEFAULT_NAME);
      assert.equal(defaults.length, 0);
    });

    it("clears the default-name flag once user renames the round", () => {
      const quiz = fullQuiz({
        rounds: [
          { name: "Music", description: { de: "", en: "" }, questions: [] },
          { name: "Round 2", description: { de: "", en: "" }, questions: [] },
          { name: "Round 3", description: { de: "", en: "" }, questions: [] },
          { name: "Round 4", description: { de: "", en: "" }, questions: [] },
          { name: "Name 10", description: { de: "", en: "" }, questions: [] },
          { name: "Jackpot!", description: { de: "", en: "" }, questions: [] },
        ],
      });
      const issues = validateQuiz(inputs(quiz));
      const defaults = issues.filter((i) => i.message === messages.TITLE_DEFAULT_NAME);
      assert.equal(defaults.length, 3);
      assert.ok(!defaults.some((i) => i.label === "Music"));
    });

    it("never flags round title answer slides (mirror the question-phase title)", () => {
      const quiz = fullQuiz();
      const issues = validateQuiz(inputs(quiz));
      const answerTitleIssues = issues.filter((i) =>
        i.message === messages.TITLE_NO_IMAGE && /\(answers\)/.test(i.label)
      );
      assert.equal(answerTitleIssues.length, 0);
    });
  });

  describe("warning: round description missing translation", () => {
    it("flags description with DE only", () => {
      const quiz = fullQuiz();
      quiz.rounds[0].description = { de: "Nur Deutsch", en: "" };
      const issues = validateQuiz(inputs(quiz));
      assert.ok(findIssue(issues, messages.EN_DESCRIPTION_MISSING));
    });

    it("flags description with EN only (after user edits DE to empty)", () => {
      const quiz = fullQuiz();
      quiz.rounds[0].description = { de: "Deutsche Beschreibung", en: "English only" };
      const descs = buildSlideDescriptors(quiz);
      // Simulate user clearing DE text on the description slide
      for (const d of descs) {
        if (d.id === "desc-r0") d.text = { de: "", en: "English only" };
      }
      const issues = validateQuiz({
        descriptors: descs,
        questions: extractQuestions(quiz),
        images: {},
        quiz,
        jackpotSize: 50,
        email: "me@example.com",
      });
      assert.ok(findIssue(issues, messages.DE_DESCRIPTION_MISSING));
    });

    it("does not flag rounds without any description", () => {
      const quiz = fullQuiz();
      const issues = validateQuiz(inputs(quiz));
      const descIssues = issues.filter((i) => i.message === messages.EN_DESCRIPTION_MISSING || i.message === messages.DE_DESCRIPTION_MISSING);
      assert.equal(descIssues.length, 0);
    });
  });

  describe("warning: jackpot media without text", () => {
    it("flags jackpot question with media but no text", () => {
      const quiz = fullQuiz();
      quiz.rounds[5].questions[0] = { text: { de: "", en: "" }, answers: { de: "Gold0", en: "Gold0" } };
      const images = { "r5q0:0": { data: "x", width: 10, height: 10 } };
      const issues = validateQuiz(inputs(quiz, { images }));
      const issue = findIssue(issues, messages.JACKPOT_NO_TEXT);
      assert.ok(issue);
      assert.equal(issue.severity, "warning");
    });

    it("does not flag jackpot question with text and media", () => {
      const quiz = fullQuiz();
      const images = { "r5q0:0": { data: "x", width: 10, height: 10 } };
      const issues = validateQuiz(inputs(quiz, { images }));
      assert.equal(findIssue(issues, messages.JACKPOT_NO_TEXT), undefined);
    });

    it("does not flag non-jackpot question with media but no text", () => {
      const quiz = fullQuiz();
      quiz.rounds[0].questions[0] = { text: { de: "", en: "" }, answers: { de: "A", en: "A" } };
      const images = { "r0q0:0": { data: "x", width: 10, height: 10 } };
      const issues = validateQuiz(inputs(quiz, { images }));
      assert.equal(findIssue(issues, messages.JACKPOT_NO_TEXT), undefined);
    });

    it("does not flag jackpot question without media (already caught by no-content)", () => {
      const quiz = fullQuiz();
      quiz.rounds[5].questions[0] = { text: { de: "", en: "" }, answers: { de: "Gold0", en: "Gold0" } };
      const issues = validateQuiz(inputs(quiz));
      assert.equal(findIssue(issues, messages.JACKPOT_NO_TEXT), undefined);
      assert.ok(findIssue(issues, messages.QUESTION_NO_CONTENT));
    });
  });

  describe("warning: text overflow", () => {
    it("flags questions whose fit result marks overflow=true", () => {
      const quiz = fullQuiz();
      const slideOverrides = { "r0q0:0": { overflow: true } };
      const issues = validateQuiz(inputs(quiz, { slideOverrides }));
      const issue = findIssue(issues, messages.TEXT_OVERFLOW);
      assert.ok(issue, "should flag overflow");
      assert.equal(issue.severity, "warning");
    });

    it("does not flag when fit result has overflow=false or missing", () => {
      const quiz = fullQuiz();
      const slideOverrides = { "r0q0:0": { fontSize: 18, overflow: false } };
      const issues = validateQuiz(inputs(quiz, { slideOverrides }));
      assert.equal(findIssue(issues, messages.TEXT_OVERFLOW), undefined);
    });

    it("does not flag empty-question slides even if overflow marked", () => {
      const quiz = fullQuiz();
      quiz.rounds[0].questions[0] = { text: { de: "", en: "" }, answers: { de: "A", en: "A" } };
      const images = { "r0q0:0": { data: "x", width: 10, height: 10 } };
      const slideOverrides = { "r0q0:0": { overflow: true } };
      const issues = validateQuiz(inputs(quiz, { images, slideOverrides }));
      assert.equal(findIssue(issues, messages.TEXT_OVERFLOW), undefined);
    });
  });

  describe("info: very short question text", () => {
    it("flags short DE text", () => {
      const quiz = fullQuiz();
      quiz.rounds[0].questions[0] = { text: { de: "Hi", en: "Long enough question text here" }, answers: { de: "A", en: "A" } };
      const issues = validateQuiz(inputs(quiz));
      assert.ok(findIssue(issues, "Very short question text"));
    });

    it("does not flag when both lengths are >= 10", () => {
      const quiz = fullQuiz();
      const issues = validateQuiz(inputs(quiz));
      const shortIssues = issues.filter((i) => i.message.startsWith("Very short"));
      assert.equal(shortIssues.length, 0);
    });
  });

  describe("sorting", () => {
    it("sorts by severity: danger, warning, info", () => {
      const quiz = fullQuiz();
      quiz.rounds[0].questions[0] = { text: { de: "Paris ist wo?", en: "Paris is where?" }, answers: { de: "Paris", en: "Paris" } };
      quiz.rounds[0].questions[1] = { text: { de: "Frage hier lang", en: "" }, answers: { de: "A", en: "A" } };
      const issues = validateQuiz(inputs(quiz, { jackpotSize: 0 }));
      const severities = issues.map((i) => i.severity);
      const seen = { danger: false, warning: false, info: false };
      let lastRank = -1;
      const rank = { danger: 0, warning: 1, info: 2 };
      for (const s of severities) {
        assert.ok(rank[s] >= lastRank, `severity out of order: ${severities.join(",")}`);
        lastRank = rank[s];
        seen[s] = true;
      }
      assert.ok(seen.danger && seen.warning && seen.info);
    });
  });

  it("returns empty list for a fully clean quiz", () => {
    const quiz = fullQuiz();
    const images = {};
    // Add images to every title + extra slide + round description
    const descs = buildSlideDescriptors(quiz);
    for (const d of descs) {
      if (d.type === "title" || (d.type === "intro" && (d.introIndex == null || d.introIndex >= 3))) {
        images[`${d.id}:0`] = { data: `img-${d.id}`, width: 10, height: 10 };
      }
    }
    const issues = validateQuiz(inputs(quiz, { images }));
    assert.deepEqual(issues, []);
  });
});
