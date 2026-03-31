import { OfficeParser } from "officeparser";

async function parseQuiz(filePath) {
  const ast = await OfficeParser.parseOffice(filePath);
  // Find the quiz sheet: "Tabelle1", or fall back to the first sheet
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

    // Skip empty rows
    if (!firstText) continue;

    // Date row: first row, bold, only one cell, and looks like a number (Excel serial date)
    if (date === null && firstIsBold && cells.length === 1) {
      const serial = parseInt(firstText, 10);
      if (!isNaN(serial)) {
        // Convert Excel serial date to JS date (Excel epoch: 1900-01-01, with the 1900 leap year bug)
        const epoch = new Date(1899, 11, 30);
        date = new Date(epoch.getTime() + serial * 86400000)
          .toISOString()
          .split("T")[0];
        continue;
      }
    }

    // Round header: bold first cell, no answer columns filled
    const hasAnswerCols = cells.some(
      (c) => c.metadata.col >= 2 && c.text?.trim()
    );
    if (firstIsBold && !hasAnswerCols) {
      currentRound = { name: firstText, description: "", questions: [] };
      rounds.push(currentRound);
      continue;
    }

    if (!currentRound) continue;

    // Description: text in col A (and optionally col B for translation), but no answer columns
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

    // Question/answer row
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

export { parseQuiz };

// CLI: node parse-quiz.js <file.xlsx>
const isMain =
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (isMain && process.argv[2]) {
  parseQuiz(process.argv[2]).then((quiz) => {
    console.log(JSON.stringify(quiz, null, 2));
  });
}
