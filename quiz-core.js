/**
 * Shared quiz logic — no Node-specific imports.
 * Used by both CLI (parse-quiz.js, generate-pptx.js) and browser (index.html).
 */

/** Slide dimensions and font sizes — single source of truth for PPTX and preview. */
export const SLIDE_STYLE = {
  width: 10,       // inches (LAYOUT_16x9)
  height: 5.625,   // inches
  title:    { fontSize: 40 },
  num:      { fontSize: 24 },
  question: { fontSize: 16 },
  answer:   { fontSize: 20 },
};

export function astToQuiz(ast) {
  const sheet =
    ast.content.find((s) => s.metadata.sheetName === "Tabelle1") ??
    ast.content[0];

  let date = null;
  const rounds = [];
  let currentRound = null;

  for (const row of sheet.children) {
    const cells = row.children;
    const firstCell = cells[0];
    const firstText = firstCell?.text?.trim() ?? "";
    const firstIsBold = firstCell?.children?.some(
      (n) => n.formatting?.bold
    );

    if (!firstText) continue;

    if (date === null && firstIsBold && cells.length === 1) {
      const serial = parseInt(firstText, 10);
      if (!isNaN(serial)) {
        const epoch = new Date(1899, 11, 30);
        date = new Date(epoch.getTime() + serial * 86400000)
          .toISOString()
          .split("T")[0];
        continue;
      }
    }

    const hasAnswerCols = cells.some(
      (c) => c.metadata.col >= 2 && c.text?.trim()
    );
    if (firstIsBold && !hasAnswerCols) {
      currentRound = { name: firstText, description: "", questions: [] };
      rounds.push(currentRound);
      continue;
    }

    if (!currentRound) continue;

    if (!hasAnswerCols) {
      const dePart = firstText;
      const enPart =
        cells.find((c) => c.metadata.col === 1)?.text?.trim() ?? "";
      const desc = enPart ? `${dePart}\n${enPart}` : dePart;
      currentRound.description = currentRound.description
        ? currentRound.description + "\n" + desc
        : desc;
      continue;
    }

    const de = firstText;
    const en = cells.find((c) => c.metadata.col === 1)?.text?.trim() ?? "";
    const deAnswer =
      cells.find((c) => c.metadata.col === 2)?.text?.trim() ?? "";
    const enAnswer =
      cells.find((c) => c.metadata.col === 3)?.text?.trim() || deAnswer;

    currentRound.questions.push({
      text: { de, en },
      answers: { de: deAnswer, en: enAnswer },
    });
  }

  return { date, rounds };
}

/**
 * Returns a flat list of slide descriptors with stable IDs.
 * Used by both the preview and the PPTX builder.
 */
export function buildSlideDescriptors(quiz) {
  const slides = [];

  function addTitle(text) {
    slides.push({ type: "title", text, id: null });
  }

  function addQuestions(rounds, withAnswers) {
    for (const round of rounds) {
      addTitle(round.name);
      const questions = round.questions;
      const count = questions.length === 0 ? 10 : questions.length;
      for (let i = 0; i < count; i++) {
        const q = questions[i];
        // ID ties question and answer slides together for image sharing
        const id = `${round.name}:${i}`;
        const s = { type: "question", id, num: i + 1, q, withAnswers };
        slides.push(s);
      }
    }
  }

  function addSection(rounds) {
    addQuestions(rounds, false);
    addTitle("Break");
    addTitle("Answers");
    addQuestions(rounds, true);
  }

  addTitle(quiz.date);
  addSection(quiz.rounds.slice(0, 2));
  addSection(quiz.rounds.slice(2, 5));
  addSection(quiz.rounds.slice(5));
  return slides;
}

/**
 * @param {object} quiz
 * @param {function} PptxGenJS - constructor
 * @param {Record<string, string>} [images] - map of slide ID to base64 data URI
 */
export function buildPptx(quiz, PptxGenJS, images = {}) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  const descriptors = buildSlideDescriptors(quiz);

  for (const desc of descriptors) {
    const slide = pptx.addSlide();

    if (desc.type === "title") {
      slide.addText(desc.text, {
        x: 0, y: 0, w: "100%", h: "100%",
        fontSize: SLIDE_STYLE.title.fontSize, bold: true, align: "center", valign: "middle",
      });
      continue;
    }

    const { q, num, withAnswers, id } = desc;
    const hasImage = id && images[id];
    const textW = hasImage ? 4.8 : 9;

    slide.addText(String(num), {
      x: 0.3, y: 0.2, w: 0.8, h: 0.5, fontSize: SLIDE_STYLE.num.fontSize, bold: true,
    });

    if (q) {
      slide.addText(q.text.de, {
        x: 0.5, y: 1, w: textW, h: 1.75, fontSize: SLIDE_STYLE.question.fontSize, valign: "top",
      });
      if (q.text.en) {
        slide.addText(q.text.en, {
          x: 0.5, y: 2.75, w: textW, h: 1.75, fontSize: SLIDE_STYLE.question.fontSize, valign: "top",
        });
      }
    }

    if (withAnswers && q) {
      const answer =
        q.answers.de === q.answers.en
          ? q.answers.de
          : `${q.answers.de} / ${q.answers.en}`;
      slide.addText(answer, {
        x: 0.5, y: 4.8, w: 9, h: 0.7,
        fontSize: SLIDE_STYLE.answer.fontSize, bold: true, align: "center",
      });
    }

    if (hasImage) {
      slide.addImage({
        data: images[id],
        x: 5.5, y: 0.5, w: 4, h: 3,
        sizing: { type: "contain", w: 4, h: 3 },
      });
    }
  }

  return pptx;
}
