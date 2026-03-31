#!/usr/bin/env node
import { program } from "commander";
import { parseQuiz } from "./parse-quiz.js";
import { generatePptx } from "./generate-pptx.js";

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString()));
    process.stdin.on("error", reject);
  });
}

program.name("quiz").description("Quiz XLSX parser and PPTX generator");

program
  .command("parse")
  .description("Parse an XLSX quiz file to JSON")
  .argument("<file>", "path to .xlsx file")
  .action(async (file) => {
    const quiz = await parseQuiz(file);
    console.log(JSON.stringify(quiz, null, 2));
  });

program
  .command("generate")
  .description("Generate a PPTX from quiz JSON")
  .argument("[file]", "path to .xlsx or .json file (omit to read JSON from stdin)")
  .option("-o, --output <path>", "output .pptx path")
  .action(async (file, opts) => {
    let quiz;
    let defaultOut = "quiz.pptx";

    if (file?.endsWith(".xlsx")) {
      quiz = await parseQuiz(file);
      defaultOut = file.replace(/\.xlsx$/i, ".pptx");
    } else if (file) {
      const { readFileSync } = await import("fs");
      quiz = JSON.parse(readFileSync(file, "utf-8"));
      defaultOut = file.replace(/\.json$/i, ".pptx");
    } else {
      quiz = JSON.parse(await readStdin());
    }

    const outFile = opts.output || defaultOut;
    await generatePptx(quiz, outFile);
    console.error("Written to", outFile);
  });

program.parse();
