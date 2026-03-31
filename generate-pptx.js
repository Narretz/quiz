import PptxGenJS from "pptxgenjs";
import { parseQuiz } from "./parse-quiz.js";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node generate-pptx.js <path-to-xlsx>");
  process.exit(1);
}

const quiz = await parseQuiz(filePath);
const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_16x9";

function addTitleSlide(text) {
  pptx.addSlide().addText(text, {
    x: 0,
    y: 0,
    w: "100%",
    h: "100%",
    fontSize: 40,
    bold: true,
    align: "center",
    valign: "middle",
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

      // Question number top-left
      slide.addText(String(i + 1), {
        x: 0.3,
        y: 0.2,
        w: 0.8,
        h: 0.5,
        fontSize: 24,
        bold: true,
      });

      if (q) {
        slide.addText(q.text.de, {
          x: 0.5,
          y: 1,
          w: 9,
          h: 1.75,
          fontSize: 16,
          valign: "top",
        });
        if (q.text.en) {
          slide.addText(q.text.en, {
            x: 0.5,
            y: 2.75,
            w: 9,
            h: 1.75,
            fontSize: 16,
            valign: "top",
          });
        }
      }

      if (withAnswers && q) {
        const answer =
          q.answers.de === q.answers.en
            ? q.answers.de
            : `${q.answers.de} / ${q.answers.en}`;
        slide.addText(answer, {
          x: 0.5,
          y: 4.8,
          w: 9,
          h: 0.7,
          fontSize: 20,
          bold: true,
          align: "center",
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

// Slide 1: Date
addTitleSlide(quiz.date);

// First two rounds, then next three, then the rest
addSection(quiz.rounds.slice(0, 2));
addSection(quiz.rounds.slice(2, 5));
addSection(quiz.rounds.slice(5));

const outFile = filePath.replace(/\.xlsx$/i, ".pptx");
await pptx.writeFile({ fileName: outFile });
console.log("Written to", outFile);
