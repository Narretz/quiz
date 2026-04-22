import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { astToQuiz } from "../quiz-core.js";

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
