import { OfficeParser } from "officeparser";
import { astToQuiz, buildSlideDescriptors, extractQuestions, SLIDE_STYLE } from "../quiz-core.js";
import path from "path";

const XLSX_PATH = path.resolve("0112.xlsx");
let _cached = null;

export async function buildSeedRecord() {
  if (_cached) return _cached;
  const ast = await OfficeParser.parseOffice(XLSX_PATH);
  const quiz = astToQuiz(ast);
  const id = quiz.date || "test-quiz";
  _cached = {
    id,
    quiz,
    questions: extractQuestions(quiz),
    descriptors: buildSlideDescriptors(quiz),
    images: {},
    audio: {},
    manualOverrides: {},
    style: {
      fontSize: SLIDE_STYLE.question.fontSize,
      lineSpacing: SLIDE_STYLE.question.lineSpacing,
      backgroundColor: SLIDE_STYLE.backgroundColor,
      textColor: SLIDE_STYLE.textColor,
    },
    savedAt: Date.now(),
  };
  return _cached;
}

export async function seedQuiz(page) {
  const record = await buildSeedRecord();
  // Navigate to origin first so we can access its IndexedDB
  await page.goto("/");
  await page.evaluate((rec) => {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("quiz-app", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("quizzes", { keyPath: "id" });
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("quizzes", "readwrite");
        tx.objectStore("quizzes").put(rec);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  }, record);
  // Navigate with quiz param to load from IDB
  await page.goto(`/?quiz=${encodeURIComponent(record.id)}`);
  await page.locator(".slide").first().waitFor({ timeout: 10_000 });
}
