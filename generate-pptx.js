import PptxGenJS from "pptxgenjs";
import { buildPptx } from "./quiz-core.js";

export async function generatePptx(quiz, outFile) {
  const pptx = buildPptx(quiz, PptxGenJS);
  await pptx.writeFile({ fileName: outFile });
}
