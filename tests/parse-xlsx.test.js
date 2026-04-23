import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { astToQuiz, normalizeQuizStructure } from "../quiz-core.js";

// --- AST builders (mimic officeparser output) ---

function cell(col, text, { bold = false } = {}) {
  const c = {
    text,
    metadata: { col },
    children: [],
  };
  if (bold) c.children.push({ formatting: { bold: true } });
  return c;
}

function row(...cells) {
  return { children: cells };
}

function sheet(rows, sheetName = "Tabelle1") {
  return {
    content: [{
      metadata: { sheetName },
      children: rows,
    }],
  };
}

// --- Tests ---

describe("astToQuiz", () => {
  it("parses Excel serial date from bold single-cell row", () => {
    const ast = sheet([
      row(cell(0, "46035", { bold: true })),   // 2026-01-12
      row(cell(0, "Round 1", { bold: true })),
      row(cell(0, "Q1"), cell(1, "Q1en"), cell(2, "A1"), cell(3, "A1en")),
    ]);
    const quiz = astToQuiz(ast);
    assert.strictEqual(quiz.date, "2026-01-12");
  });

  it("returns null date when no serial date row exists", () => {
    const ast = sheet([
      row(cell(0, "Round 1", { bold: true })),
      row(cell(0, "Q1"), cell(1, ""), cell(2, "A1")),
    ]);
    const quiz = astToQuiz(ast);
    assert.strictEqual(quiz.date, null);
  });

  it("parses a round header from bold row without answer columns", () => {
    const ast = sheet([
      row(cell(0, "Music", { bold: true })),
      row(cell(0, "Who sang?"), cell(1, "Who sang en?"), cell(2, "Beatles"), cell(3, "Beatles")),
    ]);
    const quiz = astToQuiz(ast);
    assert.strictEqual(quiz.rounds.length, 1);
    assert.strictEqual(quiz.rounds[0].name, "Music");
  });

  it("parses questions with de/en text and de/en answers", () => {
    const ast = sheet([
      row(cell(0, "Round 1", { bold: true })),
      row(cell(0, "Frage"), cell(1, "Question"), cell(2, "Antwort"), cell(3, "Answer")),
    ]);
    const quiz = astToQuiz(ast);
    const q = quiz.rounds[0].questions[0];
    assert.deepStrictEqual(q.text, { de: "Frage", en: "Question" });
    assert.deepStrictEqual(q.answers, { de: "Antwort", en: "Answer" });
  });

  it("preserves newlines in question text", () => {
    const ast = sheet([
      row(cell(0, "Round 1", { bold: true })),
      row(cell(0, "Zeile 1\nZeile 2"), cell(1, "Line 1\nLine 2"), cell(2, "A"), cell(3, "A")),
    ]);
    const quiz = astToQuiz(ast);
    const q = quiz.rounds[0].questions[0];
    assert.strictEqual(q.text.de, "Zeile 1\nZeile 2");
    assert.strictEqual(q.text.en, "Line 1\nLine 2");
  });

  it("converts newlines to spaces in answer text", () => {
    const ast = sheet([
      row(cell(0, "Round 1", { bold: true })),
      row(cell(0, "F"), cell(1, "Q"), cell(2, "Ant\nwort"), cell(3, "An\nswer")),
    ]);
    const quiz = astToQuiz(ast);
    const q = quiz.rounds[0].questions[0];
    assert.strictEqual(q.answers.de, "Ant wort");
    assert.strictEqual(q.answers.en, "An swer");
  });

  it("defaults EN answer to DE answer when col 3 is empty", () => {
    const ast = sheet([
      row(cell(0, "R1", { bold: true })),
      row(cell(0, "Frage"), cell(1, "Question"), cell(2, "Antwort")),
    ]);
    const quiz = astToQuiz(ast);
    const q = quiz.rounds[0].questions[0];
    assert.strictEqual(q.answers.en, "Antwort");
  });

  it("defaults EN answer to DE answer when col 3 is whitespace", () => {
    const ast = sheet([
      row(cell(0, "R1", { bold: true })),
      row(cell(0, "F"), cell(1, "Q"), cell(2, "Ja"), cell(3, "  ")),
    ]);
    const quiz = astToQuiz(ast);
    assert.strictEqual(quiz.rounds[0].questions[0].answers.en, "Ja");
  });

  it("parses round description from non-bold rows without answer columns", () => {
    const ast = sheet([
      row(cell(0, "Round 1", { bold: true })),
      row(cell(0, "Beschreibung Zeile 1"), cell(1, "Description line 1")),
      row(cell(0, "Beschreibung Zeile 2"), cell(1, "Description line 2")),
      row(cell(0, "F"), cell(1, "Q"), cell(2, "A"), cell(3, "A")),
    ]);
    const quiz = astToQuiz(ast);
    assert.strictEqual(quiz.rounds[0].description.de, "Beschreibung Zeile 1\nBeschreibung Zeile 2");
    assert.strictEqual(quiz.rounds[0].description.en, "Description line 1\nDescription line 2");
  });

  it("handles description with DE only (no EN column)", () => {
    const ast = sheet([
      row(cell(0, "R1", { bold: true })),
      row(cell(0, "Nur deutsch")),
      row(cell(0, "F"), cell(1, "Q"), cell(2, "A")),
    ]);
    const quiz = astToQuiz(ast);
    assert.strictEqual(quiz.rounds[0].description.de, "Nur deutsch");
    assert.strictEqual(quiz.rounds[0].description.en, "");
  });

  it("parses multiple rounds", () => {
    const ast = sheet([
      row(cell(0, "Round 1", { bold: true })),
      row(cell(0, "F1"), cell(1, "Q1"), cell(2, "A1")),
      row(cell(0, "Round 2", { bold: true })),
      row(cell(0, "F2"), cell(1, "Q2"), cell(2, "A2")),
      row(cell(0, "F3"), cell(1, "Q3"), cell(2, "A3")),
    ]);
    const quiz = astToQuiz(ast);
    assert.strictEqual(quiz.rounds.length, 2);
    assert.strictEqual(quiz.rounds[0].questions.length, 1);
    assert.strictEqual(quiz.rounds[1].questions.length, 2);
  });

  it("skips empty rows", () => {
    const ast = sheet([
      row(cell(0, "R1", { bold: true })),
      row(cell(0, "")),
      row(cell(0, "  ")),
      row(cell(0, "F"), cell(1, "Q"), cell(2, "A")),
    ]);
    const quiz = astToQuiz(ast);
    assert.strictEqual(quiz.rounds[0].questions.length, 1);
  });

  it("ignores rows before first round header", () => {
    const ast = sheet([
      row(cell(0, "46023", { bold: true })),
      row(cell(0, "stray text")),
      row(cell(0, "Round 1", { bold: true })),
      row(cell(0, "F"), cell(1, "Q"), cell(2, "A")),
    ]);
    const quiz = astToQuiz(ast);
    assert.strictEqual(quiz.rounds.length, 1);
    assert.strictEqual(quiz.rounds[0].questions.length, 1);
  });

  it("uses first sheet when Tabelle1 is not found", () => {
    const ast = {
      content: [{
        metadata: { sheetName: "OtherSheet" },
        children: [
          row(cell(0, "R1", { bold: true })),
          row(cell(0, "F"), cell(1, "Q"), cell(2, "A")),
        ],
      }],
    };
    const quiz = astToQuiz(ast);
    assert.strictEqual(quiz.rounds.length, 1);
  });

  it("prefers Tabelle1 when multiple sheets exist", () => {
    const ast = {
      content: [
        {
          metadata: { sheetName: "OtherSheet" },
          children: [
            row(cell(0, "Wrong", { bold: true })),
            row(cell(0, "F"), cell(1, "Q"), cell(2, "A")),
          ],
        },
        {
          metadata: { sheetName: "Tabelle1" },
          children: [
            row(cell(0, "Right", { bold: true })),
            row(cell(0, "F"), cell(1, "Q"), cell(2, "A")),
          ],
        },
      ],
    };
    const quiz = astToQuiz(ast);
    assert.strictEqual(quiz.rounds[0].name, "Right");
  });

  describe("Name 10 round", () => {
    it("clears answers on penultimate round matching 'Name 10'", () => {
      const ast = sheet([
        row(cell(0, "R1", { bold: true })),
        row(cell(0, "F"), cell(1, "Q"), cell(2, "A")),
        row(cell(0, "Name 10", { bold: true })),
        row(cell(0, "F"), cell(1, "Q"), cell(2, "should be cleared")),
        row(cell(0, "Last Round", { bold: true })),
        row(cell(0, "F"), cell(1, "Q"), cell(2, "A")),
      ]);
      const quiz = astToQuiz(ast);
      const name10 = quiz.rounds[1];
      assert.deepStrictEqual(name10.questions[0].answers, { de: "", en: "" });
    });

    it("is case insensitive", () => {
      const ast = sheet([
        row(cell(0, "R1", { bold: true })),
        row(cell(0, "F"), cell(1, "Q"), cell(2, "A")),
        row(cell(0, "NAME 10", { bold: true })),
        row(cell(0, "F"), cell(1, "Q"), cell(2, "should be cleared")),
        row(cell(0, "Last", { bold: true })),
        row(cell(0, "F"), cell(1, "Q"), cell(2, "A")),
      ]);
      const quiz = astToQuiz(ast);
      assert.deepStrictEqual(quiz.rounds[1].questions[0].answers, { de: "", en: "" });
    });

    it("tolerates missing space: 'Name10'", () => {
      const ast = sheet([
        row(cell(0, "R1", { bold: true })),
        row(cell(0, "F"), cell(1, "Q"), cell(2, "A")),
        row(cell(0, "Name10", { bold: true })),
        row(cell(0, "F"), cell(1, "Q"), cell(2, "should be cleared")),
        row(cell(0, "Last", { bold: true })),
        row(cell(0, "F"), cell(1, "Q"), cell(2, "A")),
      ]);
      const quiz = astToQuiz(ast);
      assert.deepStrictEqual(quiz.rounds[1].questions[0].answers, { de: "", en: "" });
    });

    it("does not clear answers on non-penultimate rounds", () => {
      const ast = sheet([
        row(cell(0, "Name 10", { bold: true })),
        row(cell(0, "F"), cell(1, "Q"), cell(2, "original answer")),
        row(cell(0, "R2", { bold: true })),
        row(cell(0, "F"), cell(1, "Q"), cell(2, "A")),
        row(cell(0, "Last", { bold: true })),
        row(cell(0, "F"), cell(1, "Q"), cell(2, "A")),
      ]);
      const quiz = astToQuiz(ast);
      assert.strictEqual(quiz.rounds[0].questions[0].answers.de, "original answer");
    });
  });

  describe("Jackpot round", () => {
    it("renames last round to Jackpot! when it has exactly 4 questions", () => {
      const ast = sheet([
        row(cell(0, "R1", { bold: true })),
        row(cell(0, "F"), cell(1, "Q"), cell(2, "A")),
        row(cell(0, "Bonus", { bold: true })),
        row(cell(0, "J1"), cell(1, "J1"), cell(2, "JA1")),
        row(cell(0, "J2"), cell(1, "J2"), cell(2, "JA2")),
        row(cell(0, "J3"), cell(1, "J3"), cell(2, "JA3")),
        row(cell(0, "J4"), cell(1, "J4"), cell(2, "JA4")),
      ]);
      const quiz = astToQuiz(ast);
      assert.strictEqual(quiz.rounds.at(-1).name, "Jackpot!");
    });

    it("does not rename last round when it has != 4 questions", () => {
      const ast = sheet([
        row(cell(0, "R1", { bold: true })),
        row(cell(0, "F"), cell(1, "Q"), cell(2, "A")),
        row(cell(0, "Bonus", { bold: true })),
        row(cell(0, "J1"), cell(1, "J1"), cell(2, "JA1")),
        row(cell(0, "J2"), cell(1, "J2"), cell(2, "JA2")),
        row(cell(0, "J3"), cell(1, "J3"), cell(2, "JA3")),
      ]);
      const quiz = astToQuiz(ast);
      assert.strictEqual(quiz.rounds.at(-1).name, "Bonus");
    });

    it("does not rename when there is only one round", () => {
      const ast = sheet([
        row(cell(0, "Solo", { bold: true })),
        row(cell(0, "J1"), cell(1, "J1"), cell(2, "JA1")),
        row(cell(0, "J2"), cell(1, "J2"), cell(2, "JA2")),
        row(cell(0, "J3"), cell(1, "J3"), cell(2, "JA3")),
        row(cell(0, "J4"), cell(1, "J4"), cell(2, "JA4")),
      ]);
      const quiz = astToQuiz(ast);
      assert.strictEqual(quiz.rounds[0].name, "Solo");
    });
  });
});

describe("normalizeQuizStructure", () => {
  function makeRound(name, qCount) {
    return {
      name,
      description: { de: "", en: "" },
      questions: Array.from({ length: qCount }, () => ({
        text: { de: "Q", en: "Q" },
        answers: { de: "A", en: "A" },
      })),
    };
  }

  function goodQuiz() {
    return {
      date: "2026-01-01",
      rounds: [
        makeRound("R1", 10),
        makeRound("R2", 10),
        makeRound("R3", 10),
        makeRound("R4", 10),
        makeRound("Name 10", 1),
        makeRound("Jackpot!", 4),
      ],
    };
  }

  it("accepts a valid 6-round quiz unchanged", () => {
    const quiz = goodQuiz();
    normalizeQuizStructure(quiz);
    assert.deepStrictEqual(quiz.rounds.map((r) => r.questions.length), [10, 10, 10, 10, 1, 4]);
  });

  it("fills placeholder rounds up to target counts", () => {
    const quiz = goodQuiz();
    quiz.rounds[1].questions = [];
    quiz.rounds[3].questions = [];
    quiz.rounds[4].questions = [];
    quiz.rounds[5].questions = [];
    normalizeQuizStructure(quiz);
    assert.deepStrictEqual(quiz.rounds.map((r) => r.questions.length), [10, 10, 10, 10, 1, 4]);
    // Filled questions are empty
    assert.deepStrictEqual(quiz.rounds[1].questions[0], { text: { de: "", en: "" }, answers: { de: "", en: "" } });
  });

  it("fills a partially-populated round up to target", () => {
    const quiz = goodQuiz();
    quiz.rounds[0].questions = quiz.rounds[0].questions.slice(0, 5);
    normalizeQuizStructure(quiz);
    assert.strictEqual(quiz.rounds[0].questions.length, 10);
    // Existing five are preserved with their text
    assert.strictEqual(quiz.rounds[0].questions[4].text.de, "Q");
    // New five are empty
    assert.strictEqual(quiz.rounds[0].questions[5].text.de, "");
  });

  it("throws with round summary when there are fewer than 6 rounds", () => {
    const quiz = goodQuiz();
    quiz.rounds = quiz.rounds.slice(0, 4);
    assert.throws(
      () => normalizeQuizStructure(quiz),
      (err) => {
        assert.match(err.message, /Expected 6 rounds, found 4/);
        assert.match(err.message, /"R1" \(10 q\)/);
        assert.match(err.message, /"R4" \(10 q\)/);
        assert.match(err.message, /bold title row/);
        return true;
      },
    );
  });

  it("throws when there are more than 6 rounds", () => {
    const quiz = goodQuiz();
    quiz.rounds.push(makeRound("Extra", 0));
    assert.throws(() => normalizeQuizStructure(quiz), /Expected 6 rounds, found 7/);
  });

  it("throws with '(none)' when there are no rounds at all", () => {
    assert.throws(
      () => normalizeQuizStructure({ rounds: [] }),
      /Expected 6 rounds, found 0: \(none\)/,
    );
  });

  it("throws when a regular round has more than 10 questions", () => {
    const quiz = goodQuiz();
    quiz.rounds[2].questions.push({ text: { de: "Extra", en: "Extra" }, answers: { de: "", en: "" } });
    assert.throws(
      () => normalizeQuizStructure(quiz),
      /Round 3 \("R3"\) has 11 questions; expected at most 10/,
    );
  });

  it("throws when Name 10 round has more than 1 question", () => {
    const quiz = goodQuiz();
    quiz.rounds[4].questions.push({ text: { de: "Extra", en: "Extra" }, answers: { de: "", en: "" } });
    assert.throws(
      () => normalizeQuizStructure(quiz),
      /Round 5 \("Name 10"\) has 2 questions; expected at most 1/,
    );
  });

  it("throws when Jackpot round has more than 4 questions", () => {
    const quiz = goodQuiz();
    quiz.rounds[5].questions.push({ text: { de: "Extra", en: "Extra" }, answers: { de: "", en: "" } });
    assert.throws(
      () => normalizeQuizStructure(quiz),
      /Round 6 \("Jackpot!"\) has 5 questions; expected at most 4/,
    );
  });
});
