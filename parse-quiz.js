import { OfficeParser } from "officeparser";
import { astToQuiz } from "./quiz-core.js";

export async function parseQuiz(filePath) {
  const ast = await OfficeParser.parseOffice(filePath);
  return astToQuiz(ast);
}
