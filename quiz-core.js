/**
 * Shared quiz logic — no Node-specific imports.
 * Used by both CLI (parse-quiz.js, generate-pptx.js) and browser (index.html).
 */

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

export function buildPptx(quiz, PptxGenJS) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";

  function addTitleSlide(text) {
    pptx.addSlide().addText(text, {
      x: 0, y: 0, w: "100%", h: "100%",
      fontSize: 40, bold: true, align: "center", valign: "middle",
    });
  }

  function addQuestionSlides(rounds, withAnswers) {
    for (const round of rounds) {
      addTitleSlide(round.name);
      const questions = round.questions;
      const count = questions.length === 0 ? 10 : questions.length;
      for (let i = 0; i < count; i++) {
        const slide = pptx.addSlide();
        const q = questions[i];
        slide.addText(String(i + 1), {
          x: 0.3, y: 0.2, w: 0.8, h: 0.5, fontSize: 24, bold: true,
        });
        if (q) {
          slide.addText(q.text.de, {
            x: 0.5, y: 1, w: 9, h: 1.75, fontSize: 16, valign: "top",
          });
          if (q.text.en) {
            slide.addText(q.text.en, {
              x: 0.5, y: 2.75, w: 9, h: 1.75, fontSize: 16, valign: "top",
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
            fontSize: 20, bold: true, align: "center",
          });
        }
      }
    }
  }

  function addSection(rounds) {
    addQuestionSlides(rounds, false);
    addTitleSlide("Break");
    addTitleSlide("Answers");
    addQuestionSlides(rounds, true);
  }

  addTitleSlide(quiz.date);
  addSection(quiz.rounds.slice(0, 2));
  addSection(quiz.rounds.slice(2, 5));
  addSection(quiz.rounds.slice(5));

  return pptx;
}
